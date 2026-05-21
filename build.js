/**
 * build.js — Nglumut CMS Build Script
 * ─────────────────────────────────────────────────────────────
 * Dijalankan otomatis oleh Netlify sebelum publish (lihat netlify.toml).
 *
 * Cara kerja:
 *   1. Baca index.template.html
 *   2. Baca semua _data/ (frontmatter YAML + kontak.json)
 *   3. Replace konten di antara marker <!-- CMS:KEY --> ... <!-- /CMS:KEY -->
 *   4. Tulis hasil ke index.html (yang di-publish Netlify)
 *
 * Tidak butuh dependency eksternal — murni Node.js built-in.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// build.js ada di root repo, jadi __dirname = root
const ROOT     = path.resolve(__dirname);
const DATA_DIR = path.join(ROOT, '_data');
const HTML_IN  = path.join(ROOT, 'index.template.html');
const HTML_OUT = path.join(ROOT, 'index.html');
const ADMIN_SRC = path.join(ROOT, 'public', 'admin');
const ADMIN_OUT = path.join(ROOT, 'admin');

const facilityFallbacks = {
  'sabo-dam': [
    'assets/sabo-dam1.jpg',
    'assets/sabo-dam2.jpg',
    'assets/sabo-dam3.jpg'
  ],
  'tubing': [
    'assets/tubing-1.jpeg',
    'assets/tubing-1.jpeg',
    'assets/tubing-1.jpeg'
  ],
  'outbound': [
    'assets/outbound.jpg',
    'assets/outbound.jpg',
    'assets/outbound.jpg'
  ],
  'greenhouse': [
    'assets/greenhouse1.jpg',
    'assets/greenhouse2.jpg',
    'assets/greenhouse3.jpg'
  ]
};

// ── Parse frontmatter YAML sederhana (tanpa library) ─────────
function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const data = {};
  match[1].split('\n').forEach(line => {
    const m = line.match(/^([\w_]+):\s*(.+)$/);
    if (!m) return;
    let val = m[2].trim().replace(/^["']|["']$/g, '');
    if (val === 'true')  val = true;
    else if (val === 'false') val = false;
    else if (!isNaN(val) && val !== '') val = Number(val);
    data[m[1]] = val;
  });
  return data;
}

// ── Baca folder _data/<name>, sort by urutan/nomor ───────────
function readFolder(name) {
  const dir = path.join(DATA_DIR, name);
  if (!fs.existsSync(dir)) { console.warn(`  ⚠ Folder _data/${name} tidak ada`); return []; }
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => parseFrontmatter(fs.readFileSync(path.join(dir, f), 'utf8')))
    .filter(d => Object.keys(d).length > 0)
    .sort((a, b) => (a.urutan || a.nomor || 0) - (b.urutan || b.nomor || 0));
}

// ── Escape karakter regex ─────────────────────────────────────
function esc(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// ── Fallback foto jika belum diupload ────────────────────────
function f(val, fallback = 'assets/img_placeholder1.jpg') {
  if (!val || String(val).trim() === '') {
    return fallback;
  }

  const cleaned = String(val).replace(/^\//, '');
  const fullPath = path.join(ROOT, cleaned);

  return fs.existsSync(fullPath)
    ? val
    : fallback;
}

function copyAdminFiles() {
  if (!fs.existsSync(ADMIN_SRC)) {
    console.warn('  Warning: public/admin tidak ditemukan');
    return false;
  }

  fs.cpSync(ADMIN_SRC, ADMIN_OUT, { recursive: true });
  return true;
}

// ── Inject: ganti atribut di dalam blok marker ───────────────
// Marker: <!-- CMS:KEY --> ... <img src="..." alt="..."> ... <!-- /CMS:KEY -->
function injectAttr(html, key, attr, val) {
  const O = `<!-- CMS:${key} -->`, C = `<!-- /CMS:${key} -->`;
  if (!html.includes(O)) { console.warn(`  ⚠ Marker CMS:${key} tidak ditemukan`); return html; }
  return html.replace(
    new RegExp(`(${esc(O)}[\\s\\S]*?)${attr}="[^"]*"([\\s\\S]*?${esc(C)})`, 'g'),
    `$1${attr}="${val}"$2`
  );
}

// ── Inject: ganti teks/nilai di antara marker inline ─────────
// Marker: <!-- CMS:KEY -->nilai lama<!-- /CMS:KEY -->
function injectVal(html, key, val) {
  const O = `<!-- CMS:${key} -->`, C = `<!-- /CMS:${key} -->`;
  if (!html.includes(O)) { console.warn(`  ⚠ Marker CMS:${key} tidak ditemukan`); return html; }
  return html.replace(new RegExp(`${esc(O)}[\\s\\S]*?${esc(C)}`, 'g'), `${O}${val}${C}`);
}

// ════════════════════════════════════════════════════════════════
//  MAIN
// ════════════════════════════════════════════════════════════════
console.log('🔨 Nglumut Build Script\n');

if (!fs.existsSync(HTML_IN)) {
  console.error('❌ ERROR: index.template.html tidak ditemukan!');
  console.error('   Pastikan file index.template.html ada di root repo.');
  process.exit(1);
}

let html = fs.readFileSync(HTML_IN, 'utf8');

// Baca semua data
const hero      = readFolder('hero');
const galeri    = readFolder('galeri');
const fasilitas = readFolder('fasilitas');
const sejarah   = readFolder('sejarah');
const kontakFile = path.join(DATA_DIR, 'pengaturan', 'kontak.json');
const kontak = fs.existsSync(kontakFile)
  ? JSON.parse(fs.readFileSync(kontakFile, 'utf8')) : {};

// ── 1. HERO SLIDES ───────────────────────────────────────────
console.log('📸 Hero slides...');
hero.forEach(s => {
  html = injectAttr(html, `hero-slide-${s.urutan}`, 'src', f(s.foto));
  html = injectAttr(html, `hero-slide-${s.urutan}`, 'alt', s.judul || `Hero ${s.urutan}`);
});

// ── 2. GALERI ────────────────────────────────────────────────
console.log('🖼️  Galeri...');
galeri.forEach(g => {
  if (g.aktif === false) return;
  html = injectAttr(html, `galeri-${g.urutan}`, 'src', f(g.foto));
  html = injectAttr(html, `galeri-${g.urutan}`, 'alt', g.judul || `Galeri ${g.urutan}`);
  if (g.judul)      html = injectVal(html, `galeri-${g.urutan}-judul`, g.judul);
  if (g.keterangan) html = injectVal(html, `galeri-${g.urutan}-ket`,   g.keterangan);
});

// ── 3. FASILITAS (nama, tag, desc, 3 foto, poster) ───────────
console.log('🎯 Fasilitas...');
fasilitas.forEach(fac => {
  const id = fac.id;
  const fb = facilityFallbacks[id] || [];
  html = injectAttr(html, `fac-${id}-foto1`, 'src', f(fac.foto_1, fb[0]));
  html = injectAttr(html, `fac-${id}-foto2`, 'src', f(fac.foto_2, fb[1]));
  html = injectAttr(html, `fac-${id}-foto3`, 'src', f(fac.foto_3, fb[2]));
  html = injectVal (html, `fac-${id}-nama`,  fac.nama      || '');
  html = injectVal (html, `fac-${id}-tag`,   fac.tag       || '');
  html = injectVal (html, `fac-${id}-desc`,  fac.deskripsi || '');
  // Poster modal
  html = injectVal(html, `fac-${id}-poster-src`,   f(fac.foto_1));
  html = injectVal(html, `fac-${id}-poster-title`, fac.nama || id);
});

// ── 4. SEJARAH MODAL ─────────────────────────────────────────
console.log('📜 Sejarah...');
sejarah.forEach(s => {
  html = injectAttr(html, `sejarah-${s.id}`, 'src', f(s.foto));
  html = injectAttr(html, `sejarah-${s.id}`, 'alt', s.judul_bagian || s.id);
});

// ── 5. KONTAK ────────────────────────────────────────────────
console.log('📞 Kontak...');
if (kontak.whatsapp) {
  html = injectVal(html, 'kontak-wa-display', `+${kontak.whatsapp}`);
  html = injectVal(html, 'kontak-wa-js',      kontak.whatsapp);
}
if (kontak.jam_buka)         html = injectVal(html, 'kontak-jam',   kontak.jam_buka);
if (kontak.hari_operasional) html = injectVal(html, 'kontak-hari',  kontak.hari_operasional);
if (kontak.alamat)           html = injectVal(html, 'kontak-alamat',kontak.alamat);

// ── 6. SOSMED LINKS ──────────────────────────────────────────
console.log('📱 Sosmed...');
if (kontak.instagram) html = injectVal(html, 'sosmed-ig-href', kontak.instagram);
if (kontak.tiktok)    html = injectVal(html, 'sosmed-tt-href', kontak.tiktok);

// ── Tulis output ─────────────────────────────────────────────
fs.writeFileSync(HTML_OUT, html, 'utf8');
console.log('📄 index.html berhasil di-generate');

if (copyAdminFiles()) {
  console.log('🛠️  Admin CMS berhasil di-generate ke admin/');
}

console.log('\n✅ Build selesai!\n');
