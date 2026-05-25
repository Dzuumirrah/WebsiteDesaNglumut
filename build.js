#!/usr/bin/env node
'use strict';

/**
 * build.js
 * ─────────
 * Reads CMS-managed data files from _data/ and injects them into
 * index.template.html, writing the final static index.html.
 *
 * Uses only Node built-ins (fs, path) — no npm dependencies.
 *
 * Each <!-- CMS:key --> ... <!-- /CMS:key --> block in the template
 * is replaced with the corresponding CMS value. Markers are preserved
 * in the output so subsequent builds are idempotent.
 */

const fs   = require('fs');
const path = require('path');
const ROOT = __dirname;

// ── Utilities ─────────────────────────────────────────────────────────────────

/** Read and parse a JSON data file. Throws clearly if missing or malformed. */
function read(relPath) {
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing required data file: ${relPath}`);
  }
  try {
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (e) {
    throw new Error(`JSON parse error in ${relPath}: ${e.message}`);
  }
}

/** Escape a string for safe insertion as HTML text content or attribute value. */
function esc(val) {
  return String(val == null ? '' : val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Generate a cover-style <img> tag (galleries, facilities, hero). */
function imgCover(src, alt) {
  return `<img src="${String(src)}" alt="${esc(alt)}" style="width:100%;height:100%;object-fit:cover">`;
}

/** Generate a rounded <img> tag (modal history photos). */
function imgRounded(src, alt) {
  return `<img src="${String(src)}" alt="${esc(alt)}" style="width:100%;border-radius:10px;margin:1.5rem 0">`;
}

/**
 * Replace all <!-- CMS:key --> ... <!-- /CMS:key --> occurrences in html
 * with the given value (preserving the marker comments themselves).
 * Warns if a key has no corresponding marker in the template.
 */
function inject(html, replacements) {
  for (const [key, value] of Object.entries(replacements)) {
    const rx      = new RegExp(`<!-- CMS:${key} -->[\\s\\S]*?<!-- /CMS:${key} -->`, 'g');
    const wrapped = `<!-- CMS:${key} -->${value}<!-- /CMS:${key} -->`;
    const matchCount = (html.match(new RegExp(rx.source, 'g')) || []).length;
    if (matchCount === 0) {
      process.stderr.write(`⚠  No marker found for key: CMS:${key}\n`);
    }
    html = html.replace(rx, wrapped);
  }
  return html;
}

// ── Load data ─────────────────────────────────────────────────────────────────

const settings = read('_data/pengaturan.json');
const hero     = read('_data/hero.json');
const galeri   = read('_data/galeri.json');
const sejarah  = read('_data/sejarah.json');

const FAC_IDS  = ['sabo-dam', 'tubing', 'pendopo', 'outbound', 'greenhouse'];
const fasilitas = {};
for (const id of FAC_IDS) {
  fasilitas[id] = read(`_data/fasilitas/${id}.json`);
}

// ── Build replacement map ─────────────────────────────────────────────────────

const R = {};   // R['cms-key'] = replacement string

// Contact / settings (used in multiple sections — global replace handles repeats)
R['kontak-alamat'] = esc(settings.kontak_alamat);
R['kontak-jam']    = esc(settings.kontak_jam);
R['kontak-hari']   = esc(settings.kontak_hari);

// Hero slides (3 fixed)
for (let i = 1; i <= 3; i++) {
  const slide = hero[`slide_${i}`];
  if (!slide || !slide.image) throw new Error(`hero.slide_${i}.image is required`);
  R[`hero-slide-${i}`] = imgCover(slide.image, slide.alt || '');
}

// Gallery (6 fixed)
for (let i = 1; i <= 6; i++) {
  const foto = galeri[`foto_${i}`];
  if (!foto || !foto.image) throw new Error(`galeri.foto_${i}.image is required`);
  R[`galeri-${i}`]       = imgCover(foto.image, foto.alt || `Galeri ${i}`);
  R[`galeri-${i}-judul`] = esc(foto.judul || `Foto Galeri ${i}`);
  R[`galeri-${i}-ket`]   = esc(foto.keterangan || '');
}

// Facilities (5 fixed, 3 photos each)
for (const id of FAC_IDS) {
  const fac = fasilitas[id];
  if (!fac.nama) throw new Error(`_data/fasilitas/${id}.json: "nama" is required`);

  for (let j = 1; j <= 3; j++) {
    const f = fac[`foto_${j}`];
    if (!f || !f.src) throw new Error(`_data/fasilitas/${id}.json: foto_${j}.src is required`);
    R[`fac-${id}-foto${j}`] = imgCover(f.src, f.alt || fac.nama);
  }

  // nama appears twice per card (collapsed-label + fac-name) — both replaced
  R[`fac-${id}-nama`]         = esc(fac.nama);
  R[`fac-${id}-tag`]          = esc(fac.tag || '');
  R[`fac-${id}-desc`]         = esc(fac.desc || '');
  R[`fac-${id}-poster-title`] = esc(fac.poster_title || fac.nama);
  // poster-src goes in a data-attribute; preserve raw path (no entity escaping for /)
  R[`fac-${id}-poster-src`]   = String(fac.poster_src || '');
}

// History / sejarah modal photos (rounded style)
const sejarahKeys = {
  foto_merapi:    'sejarah-merapi',
  foto_pertanian: 'sejarah-pertanian',
  foto_sabo_dam:  'sejarah-sabo-dam',
};
for (const [dataKey, cmsKey] of Object.entries(sejarahKeys)) {
  const foto = sejarah[dataKey];
  if (!foto || !foto.src) throw new Error(`sejarah.${dataKey}.src is required`);
  R[cmsKey] = imgRounded(foto.src, foto.alt || '');
}

// ── Read template → inject → write output ─────────────────────────────────────

const tplPath = path.join(ROOT, 'index.template.html');
if (!fs.existsSync(tplPath)) {
  throw new Error('index.template.html not found — create it from the current index.html');
}

let html = fs.readFileSync(tplPath, 'utf8');
html = inject(html, R);

fs.writeFileSync(path.join(ROOT, 'index.html'), html, 'utf8');
process.stdout.write('✓  index.html built successfully\n');
