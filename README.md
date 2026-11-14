# SYLVARIS — The Expert Trade-Off

Website interaktif & Dashboard 3D Digital Twin untuk paper inovasi:
**SYLVARIS: Reliability-Constrained Peatland Hydrology Monitoring**  
Penulis Tunggal & Ketua Tim: **Bimo Satrio** (Teknik Komputer, FILKOM Universitas Brawijaya — TECHTONIC 3.0)

## Fitur Utama
- **Dwibahasa Instan (`ID | EN`)** + Mode Gelap (*Peat Telemetry*) & Terang (*Blueprint Paper*)
- **Kembaran Digital 3D (Three.js)** berputar 360°, mode Solid/Wireframe/X-Ray, serta **Exploded Anatomy 14 Komponen** dengan label 3D interaktif
- **Mesin Simulasi V8 Nyata di Browser** (`assets/js/engine.js`) — port 1:1 dari `run_sylvaris_v8.py` dengan verifikasi parity **72/72** terhadap CSV resmi
- **9 Seri Logger Resmi University of Leeds** (Sebangau 2019–2020, DOI: `10.5518/960`) lengkap dengan uji *Fault Injection*, audit kejujuran V4, dan kalkulator BOM interaktif
- **Command Dashboard (`dashboard.html`)** dengan pemutaran replay real-time yang menggerakkan tinggi muka air di dalam sumur 3D & memancarkan sinyal LoRa saat alarm terpicu

## Struktur Berkas
- `index.html` — Halaman utama paparan paper terstruktur & interaktif
- `dashboard.html` — Konsol riset & 3D Digital Twin interaktif (+ dukungan unggah CSV)
- `assets/js/node3d.js` — Scene & geometri Three.js 14 komponen
- `assets/js/engine.js` — Port JavaScript penjadwal V8 & evaluasi episode
- `assets/js/i18n.js` — Kamus dwibahasa Indonesia & Inggris
- `assets/data/loggers.js` — Dataset 9 logger resmi & metrik V8 hasil `tools/build_data.py`
