# Panduan CMS — Desa Wisata Nglumut

## Untuk Developer: Setup Awal

### 1. Branch
Semua pekerjaan ini ada di branch `feature/decap-cms-clean-integration`.
Jangan merge ke `main` sebelum verifikasi selesai.

### 2. Aktifkan di Netlify Dashboard
Buka **desawisata-nglumut.netlify.app** di Netlify, lalu:

| Langkah | Di mana | Yang dilakukan |
|---|---|---|
| Enable Identity | Site > Identity > Enable Identity | Aktifkan |
| Invite editors | Identity > Invite users | Kirim email ke pengelola |
| Enable Git Gateway | Identity > Services > Enable Git Gateway | Aktifkan |
| Set registration | Identity > Registration preferences | Pilih "Invite only" |

### 3. Update branch di config
Buka `admin/config.yml`, baris `branch:`.
- Saat testing di feature branch: `branch: feature/decap-cms-clean-integration`
- Setelah merge ke main: `branch: main`

### 4. Build lokal
```bash
node build.js
# Output: index.html (generated dari index.template.html + _data/)
```

### 5. Verifikasi sebelum merge
- [ ] `/admin/` dapat diakses di Netlify preview URL
- [ ] Login editor berhasil (cek email invite)
- [ ] Edit gambar galeri → simpan → Netlify deploy → gambar berubah di live site
- [ ] `index.html` publik tidak mengandung teks placeholder yang rusak
- [ ] Semua link dan gambar existing tetap berfungsi

---

## Untuk Editor: Cara Menggunakan CMS

### Login
1. Buka `https://desawisata-nglumut.netlify.app/admin/`
2. Klik **Login with Netlify Identity**
3. Masukkan email dan password yang dikirim lewat undangan

### Mengganti Foto

#### Foto di Galeri
1. Klik **📸 Galeri Foto** di sidebar kiri
2. Klik **Enam Foto Galeri**
3. Temukan foto yang ingin diganti (Foto 1–6)
4. Klik tombol gambar → upload foto baru
5. Klik **Save** (kanan atas) → tunggu deploy (~1-2 menit)

#### Foto Fasilitas / Wahana
1. Klik **🏕️ Fasilitas & Wahana**
2. Pilih fasilitas yang ingin diubah (misal: **2. Sewa Tubing**)
3. Ganti Foto 1, 2, atau 3
4. **Save**

#### Gambar Hero (Banner Utama)
1. Klik **🖼️ Gambar Utama (Hero)**
2. Klik **Tiga Slide Gambar Hero**
3. Ganti Slide 1, 2, atau 3
4. **Save**

#### Foto di Sejarah (Modal)
1. Klik **📜 Sejarah (Foto di Modal)**
2. Ganti foto yang sesuai
3. **Save**

### Mengubah Teks / Info Kontak
1. Klik **⚙️ Pengaturan Situs**
2. Klik **Informasi Kontak & Jam Operasional**
3. Edit alamat, jam buka, atau hari buka
4. **Save**

### Setelah Save
Setiap kali klik Save, Decap CMS otomatis:
1. Menyimpan perubahan ke repository GitHub
2. Netlify mendeteksi commit baru
3. Netlify menjalankan `node build.js` (memakan ~30-60 detik)
4. Site live diperbarui otomatis

---

## Struktur File

```
repo/
├── index.template.html     ← SUMBER TEMPLATE (edit ini, bukan index.html)
├── index.html              ← OUTPUT BUILD (auto-generated, jangan edit manual)
├── build.js                ← Script build (Node.js, no dependencies)
├── netlify.toml            ← Konfigurasi Netlify build
├── package.json            ← Minimal scripts
├── .gitignore
│
├── admin/
│   ├── index.html          ← Shell Decap CMS (akses di /admin/)
│   └── config.yml          ← Konfigurasi koleksi CMS
│
├── _data/                  ← File JSON yang dikelola CMS
│   ├── pengaturan.json     ← Kontak, jam buka, alamat
│   ├── hero.json           ← 3 slide gambar hero
│   ├── galeri.json         ← 6 foto galeri
│   ├── sejarah.json        ← 3 foto di modal sejarah
│   └── fasilitas/
│       ├── sabo-dam.json
│       ├── tubing.json
│       ├── pendopo.json
│       ├── outbound.json
│       └── greenhouse.json
│
└── assets/
    ├── uploads/            ← Foto yang diupload via CMS
    └── ...                 ← Foto existing (tidak diubah)
```

## Cara Kerja Build

```
index.template.html  +  _data/*.json
         │                    │
         └────── build.js ────┘
                      │
                 index.html  (output final, di-serve ke publik)
```

Marker `<!-- CMS:key -->...<!-- /CMS:key -->` di template diganti dengan nilai dari file JSON.
Marker tetap ada di output sebagai HTML comment (tidak terlihat pengguna, tidak merusak tampilan).

## Rollback

Jika ada masalah:
1. Di Netlify: **Deploys → pilih deploy lama → Publish deploy**
2. Atau di GitHub: revert commit terakhir di branch
