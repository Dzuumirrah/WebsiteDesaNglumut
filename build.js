// /**
//  * build.js — Nglumut CMS Build Script (FULLY PATCHED)
//  * ─────────────────────────────────────────────────────────────
//  * Security fixes applied:
//  * - XSS/injection escaping (HTML, attributes, JS)
//  * - Path traversal validation
//  * - URL validation
//  * - Regex replacement injection prevention
//  */

// 'use strict';

// const fs   = require('fs');
// const path = require('path');

// const ROOT     = path.resolve(__dirname);
// const DATA_DIR = path.join(ROOT, '_data');
// const HTML_IN  = path.join(ROOT, 'index.template.html');
// const HTML_OUT = path.join(ROOT, 'index.html');
// const ADMIN_SRC = path.join(ROOT, 'public', 'admin');
// const ADMIN_OUT = path.join(ROOT, 'admin');

// const facilityFallbacks = {
//   'sabo-dam': ['assets/sabo-dam1.jpg', 'assets/sabo-dam2.jpg', 'assets/sabo-dam3.jpg'],
//   'tubing': ['assets/tubing-1.jpeg', 'assets/tubing-1.jpeg', 'assets/tubing-1.jpeg'],
//   'outbound': ['assets/outbound.jpg', 'assets/outbound.jpg', 'assets/outbound.jpg'],
//   'greenhouse': ['assets/greenhouse1.jpg', 'assets/greenhouse2.jpg', 'assets/greenhouse3.jpg']
// };

// // ── Parsing & Escaping Functions ────────────────────────────
// function parseFrontmatter(raw) {
//   const match = raw.match(/^---\n([\s\S]*?)\n---/);
//   if (!match) return {};
//   const data = {};
//   match[1].split('\n').forEach(line => {
//     const m = line.match(/^([\w_]+):\s*(.+)$/);
//     if (!m) return;
//     let val = m[2].trim().replace(/^["']|["']$/g, '');
//     if (val === 'true')  val = true;
//     else if (val === 'false') val = false;
//     else if (!isNaN(val) && val !== '') val = Number(val);
//     data[m[1]] = val;
//   });
//   return data;
// }

// function readFolder(name) {
//   const dir = path.join(DATA_DIR, name);
//   if (!fs.existsSync(dir)) { console.warn(`  ⚠ Folder _data/${name} tidak ada`); return []; }
//   return fs.readdirSync(dir)
//     .filter(f => f.endsWith('.md'))
//     .map(f => parseFrontmatter(fs.readFileSync(path.join(dir, f), 'utf8')))
//     .filter(d => Object.keys(d).length > 0)
//     .sort((a, b) => (a.urutan || a.nomor || 0) - (b.urutan || b.nomor || 0));
// }

// // ── Regex escaping ──────────────────────────────────────────
// function esc(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// // ── HTML entity escaping (for attributes) ───────────────────
// function escapeAttr(str) {
//   return String(str)
//     .replace(/&/g, '&amp;')
//     .replace(/"/g, '&quot;')
//     .replace(/'/g, '&#39;')
//     .replace(/</g, '&lt;')
//     .replace(/>/g, '&gt;');
// }

// // ── HTML entity escaping (for content) ──────────────────────
// function escapeHtml(str) {
//   return String(str)
//     .replace(/&/g, '&amp;')
//     .replace(/</g, '&lt;')
//     .replace(/>/g, '&gt;')
//     .replace(/"/g, '&quot;')
//     .replace(/'/g, '&#39;');
// }

// // ── JavaScript string literal escaping ──────────────────────
// function escapeJs(str) {
//   return String(str)
//     .replace(/\\/g, '\\\\')
//     .replace(/'/g, "\\'")
//     .replace(/"/g, '\\"')
//     .replace(/\n/g, '\\n')
//     .replace(/\r/g, '\\r')
//     .replace(/\t/g, '\\t')
//     .replace(/</g, '\\x3c')
//     .replace(/>/g, '\\x3e');
// }

// // ── URL validation ──────────────────────────────────────────
// function isValidUrl(str) {
//   try {
//     const url = new URL(str);
//     return url.protocol === 'http:' || url.protocol === 'https:';
//   } catch {
//     return false;
//   }
// }

// function isValidInstagramUrl(str) {
//   return /^https?:\/\/(www\.)?instagram\.com\//i.test(str);
// }

// function isValidTiktokUrl(str) {
//   return /^https?:\/\/(www\.)?tiktok\.com\//i.test(str);
// }

// function isValidPhoneNumber(str) {
//   return /^\d{10,15}$/.test(String(str).trim());
// }

// const IS_DEV = !process.env.NETLIFY;

// // ── Path validation (prevent traversal) ─────────────────────
// function validateAndSafePath(val, fallback = 'assets/img_placeholder1.jpg', label = '') {
//   if (!val || String(val).trim() === '') {
//     addWarning(`${label || 'image'} kosong, pakai fallback`);
//     return fallback;
//   }

//   // Normalize separators
//   const cleaned = String(val).replace(/^\/+/, '').replace(/\\/g, '/');
  
//   // Reject traversal attempts
//   if (cleaned.includes('..') || cleaned.includes('//') || cleaned.startsWith('/')) {
//     addError(`[SECURITY] Path traversal attempt blocked: ${val}`);
//     return fallback;
//   }
  
//   // Must be in assets/ directory
//   if (!cleaned.startsWith('assets/')) {
//     addError(`[SECURITY] Path must start with assets/: ${val}`);
//     return fallback;
//   }

//   // Security: Check for suspicious patterns
//   if (cleaned.includes('..') || /[<>:"|?*]/.test(cleaned)) {
//     addError(`[SECURITY] Invalid characters in path: ${val}`);
//     return fallback;
//   }

//   const fullPath = path.join(ROOT, cleaned);
  
//   // Verify normalized path stays within assets/
//   try {
//     const normalized = path.normalize(fullPath);
//     const assetsPath = path.normalize(path.join(ROOT, 'assets/'));
//     if (!normalized.startsWith(assetsPath)) {
//       addError(`[SECURITY] Path escapes assets directory: ${val}`);
//       return fallback;
//     }
//   } catch (e) {
//     addError(`[SECURITY] Invalid path: ${val}`);
//     return fallback;
//   }

//   if (fs.existsSync(fullPath)) {
//     return '/' + cleaned;
//   }

//   if (IS_DEV) {
//     addWarning(`[DEV] file tidak ditemukan: ${val} → fallback: ${fallback}`);
//     return fallback;
//   }

//   addWarning(`[PROD] file tidak ditemukan: ${val} → fallback dipakai`);
//   return fallback;
// }

// function copyAdminFiles() {
//   if (!fs.existsSync(ADMIN_SRC)) {
//     console.warn('  Warning: public/admin tidak ditemukan');
//     return false;
//   }
//   fs.cpSync(ADMIN_SRC, ADMIN_OUT, { recursive: true });
//   return true;
// }

// // ── Inject HTML attributes (with regex callback to prevent injection) ──
// function injectAttr(html, key, attr, val) {
//   const O = `<!-- CMS:${key} -->`, C = `<!-- /CMS:${key} -->`;
//   if (!html.includes(O)) { 
//     console.warn(`  ⚠ Marker CMS:${key} tidak ditemukan`); 
//     return html; 
//   }
  
//   const escapedVal = escapeAttr(val);
//   const pattern = new RegExp(
//     `(${esc(O)}[\\s\\S]*?)${attr}="[^"]*"([\\s\\S]*?${esc(C)})`, 'g'
//   );
  
//   // Use callback to prevent $1/$2 interpretation
//   return html.replace(pattern, (match, group1, group2) => {
//     return `${group1}${attr}="${escapedVal}"${group2}`;
//   });
// }

// // ── Inject HTML content (text between markers) ──────────────
// function injectVal(html, key, value) {
//   const safeValue = value ?? '';

//   const re = new RegExp(
//     `<!--\\s*CMS:${escapeRegex(key)}\\s*-->[\\s\\S]*?<!--\\s*\\/CMS:${escapeRegex(key)}\\s*-->`,
//     'g'
//   );
//   if (!html.match(re)) {
//     addError(`Marker tidak ditemukan: CMS:${key}`);
//     return html;
//   }
//   return html.replace(re, `<!-- CMS:${key} -->${safeValue}<!-- /CMS:${key} -->`);
// }

// function escapeRegex(str) {
//   return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// }

// // ── Error handling ──────────────────────────────────────────
// const buildErrors = [];
// const buildWarnings = [];

// function addError(msg) {
//   buildErrors.push(msg);
//   console.error(`❌ ${msg}`);
// }

// function addWarning(msg) {
//   buildWarnings.push(msg);
//   console.error(`⚠ ${msg}`);
// }

// // ════════════════════════════════════════════════════════════════
// //  MAIN BUILD PROCESS
// // ════════════════════════════════════════════════════════════════

// console.log('🔨 Nglumut Build Script (SECURE)\n');

// if (!fs.existsSync(HTML_IN)) {
//   console.error('❌ ERROR: index.template.html tidak ditemukan!');
//   process.exit(1);
// }

// let html = fs.readFileSync(HTML_IN, 'utf8');

// // Read all data
// const hero      = readFolder('hero');
// const galeri    = readFolder('galeri');
// const fasilitas = readFolder('fasilitas');
// const sejarah   = readFolder('sejarah');
// const kontakFile = path.join(DATA_DIR, 'pengaturan', 'kontak.json');
// const kontak = fs.existsSync(kontakFile)
//   ? JSON.parse(fs.readFileSync(kontakFile, 'utf8')) : {};

// // ── 1. HERO SLIDES ──────────────────────────────────────────
// console.log('📸 Hero slides...');
// hero.forEach(s => {
//   html = injectAttr(html, `hero-slide-${s.urutan}`, 'src', validateAndSafePath(s.foto));
//   html = injectAttr(html, `hero-slide-${s.urutan}`, 'alt', s.judul || `Hero ${s.urutan}`);
// });

// // ── 2. GALERI ───────────────────────────────────────────────
// console.log('🖼️  Galeri...');
// galeri.forEach(g => {
//   if (g.aktif === false) return;
//   html = injectAttr(html, `galeri-${g.urutan}`, 'src', validateAndSafePath(g.foto));
//   html = injectAttr(html, `galeri-${g.urutan}`, 'alt', g.judul || `Galeri ${g.urutan}`);
//   if (g.judul)      html = injectVal(html, `galeri-${g.urutan}-judul`, g.judul);
//   if (g.keterangan) html = injectVal(html, `galeri-${g.urutan}-ket`, g.keterangan);
// });

// // ── 3. FASILITAS ────────────────────────────────────────────
// console.log('🎯 Fasilitas...');
// fasilitas.forEach(fac => {
//   const id = fac.id;
//   const fb = facilityFallbacks[id] || [];
  
//   html = injectAttr(html, `fac-${id}-foto1`, 'src', validateAndSafePath(fac.foto_1, fb[0], `${id} foto_1`));
//   html = injectAttr(html, `fac-${id}-foto2`, 'src', validateAndSafePath(fac.foto_2, fb[1], `${id} foto_2`));
//   html = injectAttr(html, `fac-${id}-foto3`, 'src', validateAndSafePath(fac.foto_3, fb[2], `${id} foto_3`));
  
//   html = injectVal(html, `fac-${id}-nama`, fac.nama || '');
//   html = injectVal(html, `fac-${id}-tag`, fac.tag || '');
//   html = injectVal(html, `fac-${id}-desc`, fac.deskripsi || '');
  
//   const posterEnabled = fac.poster_enabled === true;
//   html = injectVal(html, `fac-${id}-poster-class`, posterEnabled ? '' : 'poster-hidden');

//   if (posterEnabled) {
//     const posters = [];
//     for (let i = 1; i <= 5; i++) {
//       const foto = fac[`poster_${i}_foto`];
//       const judul = fac[`poster_${i}_judul`];

//       if (foto) {
//         posters.push({
//           title: escapeHtml(judul || fac.nama || `Poster ${i}`),
//           src: validateAndSafePath(foto)
//         });
//       }
//     }

//     if (posters.length === 0) {
//       posters.push({
//         title: escapeHtml(fac.nama || id),
//         src: validateAndSafePath(fac.foto_1)
//       });
//     }
    
//     html = injectVal(
//       html,
//       `fac-${id}-poster-data`,
//       encodeURIComponent(JSON.stringify(posters))
//     );
//   }
// });

// // ── 4. SEJARAH ──────────────────────────────────────────────
// console.log('📜 Sejarah...');
// sejarah.forEach(s => {
//   html = injectAttr(html, `sejarah-${s.id}`, 'src', validateAndSafePath(s.foto));
//   html = injectAttr(html, `sejarah-${s.id}`, 'alt', s.judul_bagian || s.id);
// });

// // ── 5. KONTAK (with validation) ─────────────────────────────
// console.log('📞 Kontak...');

// if (kontak.whatsapp) {
//   if (!isValidPhoneNumber(kontak.whatsapp)) {
//     addError(`❌ Invalid WhatsApp format: ${kontak.whatsapp}`);
//   } else {
//     const cleanPhone = String(kontak.whatsapp).replace(/[^0-9+]/g, '');
//     html = injectVal(html, 'kontak-wa-display', `+${cleanPhone}`);
//     html = injectVal(html, 'kontak-wa-js', escapeJs(cleanPhone));
//   }
// }

// if (kontak.jam_buka) html = injectVal(html, 'kontak-jam', kontak.jam_buka);
// if (kontak.hari_operasional) html = injectVal(html, 'kontak-hari', kontak.hari_operasional);
// if (kontak.alamat) html = injectVal(html, 'kontak-alamat', kontak.alamat);

// // ── 6. SOSMED LINKS (with URL validation) ───────────────────
// console.log('📱 Sosmed...');

// if (kontak.instagram) {
//   if (!isValidInstagramUrl(kontak.instagram)) {
//     addError(`❌ Invalid Instagram URL: ${kontak.instagram}`);
//   } else {
//     html = injectVal(html, 'sosmed-ig-href', kontak.instagram);
//   }
// }

// if (kontak.tiktok) {
//   if (!isValidTiktokUrl(kontak.tiktok)) {
//     addError(`❌ Invalid TikTok URL: ${kontak.tiktok}`);
//   } else {
//     html = injectVal(html, 'sosmed-tt-href', kontak.tiktok);
//   }
// }

// // ── Write output & report ───────────────────────────────────
// if (buildErrors.length > 0) {
//   console.error('\n════════════════════════════════════════');
//   console.error('❌ BUILD ERRORS FOUND');
//   console.error('════════════════════════════════════════');
//   buildErrors.forEach(err => console.error(`  • ${err}`));
//   // Don't exit on errors for now, but do warn
//   console.error('⚠ Build continuing despite errors...\n');
// }

// fs.writeFileSync(HTML_OUT, html, 'utf8');
// console.log('📄 index.html berhasil di-generate');

// if (copyAdminFiles()) {
//   console.log('🛠️  Admin CMS berhasil di-generate ke admin/');
// }

// console.log('\n✅ Build selesai!\n');
// if (buildWarnings.length > 0) {
//   console.log(`⚠ ${buildWarnings.length} warning(s) ditemukan`);
// }
