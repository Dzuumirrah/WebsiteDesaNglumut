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
  if (!fs.existsSync(dir)) { addError(`  ⚠ Folder _data/${name} tidak ada`); return []; }
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => parseFrontmatter(fs.readFileSync(path.join(dir, f), 'utf8')))
    .filter(d => Object.keys(d).length > 0)
    .sort((a, b) => (a.urutan || a.nomor || 0) - (b.urutan || b.nomor || 0));
}

// ── Escape karakter regex ─────────────────────────────────────
function esc(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// ── Escape HTML attribute values to prevent injection ────────
function escapeAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── Escape HTML content to prevent injection ─────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Escape string for JavaScript string literal ───────────────
function escapeJs(str) {
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/</g, '\\x3c')
    .replace(/>/g, '\\x3e');
}

const IS_DEV = !process.env.NETLIFY;// ── Fallback foto jika belum diupload ────────────────────────
function f(
  val,
  fallback = 'assets/img_placeholder1.jpg',
  label = ''
) {
  // kosong → fallback
  if (!val || String(val).trim() === '') {
    addWarning(
      `${label || 'image'} kosong, pakai fallback`
    );

    return fallback;
  }

  const cleaned =
    String(val).replace(/^\//, '');

  const fullPath =
    path.join(ROOT, cleaned);

  const exists =
    fs.existsSync(fullPath);

  // file ada
  if (exists) {
    return val;
  }

  // development mode:
  // pakai fallback otomatis
  if (IS_DEV) {
    addWarning(
      `[DEV] file tidak ditemukan: ${val}
→ fallback: ${fallback}`
    );

    return fallback;
  }

  // production build di Netlify
  addWarning(
    `[PROD] file tidak ditemukan: ${val}
→ fallback dipakai`
  );

  return fallback;
}
function copyAdminFiles() {
  if (!fs.existsSync(ADMIN_SRC)) {
    addError('  Warning: public/admin tidak ditemukan');
    return false;
  }
  
  fs.cpSync(ADMIN_SRC, ADMIN_OUT, { recursive: true });
  return true;
}

// ── Inject: ganti atribut di dalam blok marker ───────────────
// Marker: <!-- CMS:KEY --> ... <img src="..." alt="..."> ... <!-- /CMS:KEY -->
function injectAttr(html, key, attr, val) {
  const O = `<!-- CMS:${key} -->`, C = `<!-- /CMS:${key} -->`;
  if (!html.includes(O)) { 
    addError(`  ⚠ Marker CMS:${key} tidak ditemukan`); 
    return html; 
  }
  const escapedVal = escapeAttr(val);
  return html.replace(
    new RegExp(`(${esc(O)}[\\s\\S]*?)${attr}="[^"]*"([\\s\\S]*?${esc(C)})`, 'g'),
    `$1${attr}="${escapedVal}"$2`
  );
}
// ── Inject: ganti teks/nilai di antara marker inline ─────────
// Marker: <!-- CMS:KEY -->nilai lama<!-- /CMS:KEY -->
function injectVal(html, key, value) {
  const safeValue = escapeHtml(value ?? '');
  
  const re = new RegExp(
    `<!--\\s*CMS:${escapeRegex(key)}\\s*-->[\\s\\S]*?<!--\\s*\\/CMS:${escapeRegex(key)}\\s*-->`,
    'g'
  );
  if (!html.match(re)) {
    addError(
      `Marker tidak ditemukan: CMS:${key}`
    );
    return html;
  }
  return html.replace(
    re,
    `<!-- CMS:${key} -->${safeValue}<!-- /CMS:${key} -->`
  );
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
// Error 
const buildErrors = [];
const buildWarnings = [];

function addError(msg) {
  buildErrors.push(msg);
  console.error(`❌ ${msg}`);
}

function addWarning(msg) {
  buildWarnings.push(msg);
  addError(`⚠ ${msg}`);
}
function validateFacility(fac) {
  // const id = fac.id || '(tanpa-id)';

  // const required = [
  //   'id',
  //   'nama',
  //   'tag',
  //   'deskripsi'
  // ];

  // for (const field of required) {
  //   if (
  //     fac[field] === undefined ||
  //     fac[field] === ''
  //   ) {
  //     addError(
  //       `Fasilitas "${id}" missing field: ${field}`
  //     );
  //   }
  // }

  // // Validasi poster
  // if (fac.poster_enabled === true) {
  //   let posterFound = false;

  //   for (let i = 1; i <= 5; i++) {
  //     const foto = fac[`poster_${i}_foto`];
  //     const judul = fac[`poster_${i}_judul`];

  //     if (foto) {
  //       posterFound = true;

  //       const cleaned =
  //         String(foto).replace(/^\//, '');

  //       const fullPath =
  //         path.join(ROOT, cleaned);

  //       if (!fs.existsSync(fullPath)) {
  //         addWarning(
  //           `Poster file tidak ditemukan (${id}): ${foto}`
  //         );
  //       }

  //       if (!judul) {
  //         addWarning(
  //           `Poster ${i} pada "${id}" tidak punya judul`
  //         );
  //       }
  //     }
  //   }

  //   if (!posterFound) {
  //     addError(
  //       `"${id}" poster_enabled=true tapi tidak ada poster_*_foto`
  //     );
  //   }
  // }
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
   validateFacility(fac);
  const id = fac.id;
  const fb = facilityFallbacks[id] || [];
  
  // Inject foto fasilitas (3 gambar di carousel)
  html = injectAttr(html,`fac-${id}-foto1`,'src',f(fac.foto_1,fb[0],`${id} foto_1`));
  html = injectAttr(html,`fac-${id}-foto2`,'src',f(fac.foto_2,fb[1],`${id} foto_2`));
  html = injectAttr(html,`fac-${id}-foto3`,'src',f(fac.foto_3,fb[2],`${id} foto_3`));
  
  
  // Inject nama, tag, deskripsi
  html = injectVal (html, `fac-${id}-nama`,  fac.nama      || '');
  html = injectVal (html, `fac-${id}-tag`,   fac.tag       || '');
  html = injectVal (html, `fac-${id}-desc`,  fac.deskripsi || '');
  // ── Poster modal ─────────────────────────
  const posterEnabled = fac.poster_enabled === true;
  html = injectVal(html,`fac-${id}-poster-class`,posterEnabled ? '' : 'poster-hidden');

  if (posterEnabled) {
    const posters = [];
    for (let i = 1; i <= 5; i++) {
      const foto = fac[`poster_${i}_foto`];
      const judul = fac[`poster_${i}_judul`];

      if (foto) {
        posters.push({
          title: judul || fac.nama || `Poster ${i}`,
          src: f(foto)
        });
      }
    }

    // fallback jika poster kosong
    if (posters.length === 0) {
      posters.push({
        title: fac.nama || id,
        src: f(fac.foto_1)
      });
    }
     html = injectVal(
      html,
      `fac-${id}-poster-data`,
      encodeURIComponent(JSON.stringify(posters.map(p => ({
        ...p,
        title: escapeHtml(p.title)
      }))))
    );

  }
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
  // Sanitize phone number: only allow digits and +
  const cleanPhone = String(kontak.whatsapp).replace(/[^0-9+]/g, '');
  html = injectVal(html, 'kontak-wa-js', escapeJs(cleanPhone));
}
if (kontak.jam_buka)         html = injectVal(html, 'kontak-jam',   kontak.jam_buka);
if (kontak.hari_operasional) html = injectVal(html, 'kontak-hari',  kontak.hari_operasional);
if (kontak.alamat)           html = injectVal(html, 'kontak-alamat',kontak.alamat);

// ── 6. SOSMED LINKS ──────────────────────────────────────────
console.log('📱 Sosmed...');
if (kontak.instagram) html = injectVal(html, 'sosmed-ig-href', kontak.instagram);
if (kontak.tiktok)    html = injectVal(html, 'sosmed-tt-href', kontak.tiktok);

// ── Tulis output ─────────────────────────────────────────────
// if (buildErrors.length > 0) {
//   console.error('\n════════════════════════════');
//   console.error('❌ CMS BUILD FAILED');
//   console.error('════════════════════════════');

//   buildErrors.forEach(err =>
//     console.error(`• ${err}`)
//   );

//   process.exit(1);
// }
fs.writeFileSync(HTML_OUT, html, 'utf8');
console.log('📄 index.html berhasil di-generate');

if (copyAdminFiles()) {
  console.log('🛠️  Admin CMS berhasil di-generate ke admin/');
}

console.log('\n✅ Build selesai!\n');
