/* ==========================================================================
   SYLVARIS — 3D Edge-Node Viewer (three.js, procedural, no external models)
   360° orbit · exploded anatomy · x-ray / wireframe · part picking · LoRa pings
   ========================================================================== */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

/* ---------- part catalogue (shown in the anatomy panel) ---------- */
export const PARTS = [
  { id: "solar", no: "01", name: "Panel Surya + Bracket", layer: "Energi", price: "Rp180.000*", status: "Allowance",
    spec: "Panel 6 V kelas ±5 W, kemiringan ±15°", simple: "Menangkap sinar matahari untuk mengisi ulang baterai alat di tengah hutan tanpa kabel listrik.", role: "Memanen energi matahari untuk mengisi baterai agar node bekerja mandiri berbulan-bulan. Status: prospektif — energi panen BELUM diukur di bawah kanopi hutan gambut.", explode: [0, 0.95, 0.1], pin: [-0.28, 0.34, 0.24] },
  { id: "antenna", no: "02", name: "Antena LoRa 433 MHz", layer: "Radio", price: "termasuk modul", status: "Retail [13]",
    spec: "Whip antenna, konektor SMA/IPEX", simple: "Memancarkan laporan tinggi air lewat gelombang radio jarak jauh hingga menembus pepohonan.", role: "Memancarkan paket data ringkas ke gateway tanpa perlu kartu SIM seluler. Jangkauan aktual di vegetasi gambut masih harus diuji (PDR).", explode: [0.35, 0.75, 0], pin: [0.36, 0.42, 0.08] },
  { id: "lid", no: "03", name: "Tutup Enclosure (transparan)", layer: "Proteksi", price: "termasuk enclosure", status: "Allowance",
    spec: "Polikarbonat, gasket karet", simple: "Jendela bening anti-air supaya petugas bisa cek lampu status dari luar tanpa membuka boks.", role: "Melindungi elektronik dari hujan lebat & embun dengan segel karet, tetap memperlihatkan kedipan LED diagnosa di lapangan.", explode: [0, 0, 0.95], pin: [-0.46, 0.46, 0.36] },
  { id: "enclosure", no: "04", name: "Enclosure IP65 + Mounting", layer: "Proteksi", price: "Rp140.000", status: "Allowance",
    spec: "Kotak tahan cuaca + klem tiang", simple: "Rumah kokoh kedap hujan yang melindungi seluruh papan sirkuit dan baterai dari panas dan lembap.", role: "Wadah pelindung semua komponen agar tahan hujan tropis & paparan matahari; uji ketahanan jangka panjang tetap wajib di lapangan.", explode: [0, 0, -0.15], pin: [0.46, 0.46, -0.20] },
  { id: "mcu", no: "05", name: "ESP32-S3 Microcontroller", layer: "Komputasi", price: "Rp117.500", status: "Retail [12]",
    spec: "Dual-core Xtensa LX7, deep-sleep, Wi-Fi/BLE", simple: "Otak pintar alat: tidur irit daya 9 jam saat air tenang, lalu bangun cepat 3 jam saat air berubah drastis.", role: "OTAK node: memeriksa kewajaran angka sensor, menghitung seberapa cepat air turun r(t), lalu memilih jadwal tidur 3 / 6 / 9 jam (kebijakan Safety V8).", explode: [-0.25, 0.25, 0.62], pin: [-0.62, 0.26, 0.16] },
  { id: "lora", no: "06", name: "SX1278 LoRa Transceiver", layer: "Radio", price: "Rp74.800", status: "Retail [13]",
    spec: "RA-02, 433 MHz, SPI", simple: "Chip pengirim pesan hemat baterai berkonfirmasi ACK plus pengingat otomatis bila sinyal sempat putus.", role: "Mengirim catatan tinggi air ber-timestamp lengkap dengan nomor urut & konfirmasi penerimaan agar data hilang selalu terlacak di gateway.", explode: [0.3, 0.3, 0.62], pin: [0.58, 0.24, 0.16] },
  { id: "charger", no: "07", name: "Solar Charge Controller", layer: "Energi", price: "Rp180.000*", status: "Allowance",
    spec: "Modul CN3791 / MPPT kelas kecil", simple: "Pengatur aliran listrik dari panel surya supaya baterai terisi stabil dan tidak cepat rusak.", role: "Mengatur tegangan & arus pengisian dari panel surya ke baterai Li-ion secara aman di berbagai kondisi cuaca.", explode: [0.3, -0.05, 0.5], pin: [0.64, -0.06, 0.16] },
  { id: "battery", no: "08", name: "Baterai Li-ion + BMS", layer: "Energi", price: "Rp90.000", status: "Allowance",
    spec: "2× 18650 + Battery Management System", simple: "Bank daya isi ulang yang menyimpan cadangan listrik untuk malam hari dan musim mendung panjang.", role: "Cadangan energi saat malam / mendung; sirkuit BMS mencegah baterai habis total dan mencatat voltase per node untuk mode hemat darurat.", explode: [-0.55, -0.35, 0.35], pin: [-0.64, -0.18, 0.18] },
  { id: "protection", no: "09", name: "Proteksi Surge & Arus Lebih", layer: "Proteksi", price: "termasuk wiring", status: "Allowance",
    spec: "Sekring + dioda TVS", simple: "Sabuk pengaman listrik yang memblokir lonjakan petir atau korsleting agar chip utama tetap selamat.", role: "Melindungi rangkaian elektronik sensitif dari induksi petir di lahan terbuka, kabel terbalik, serta arus pendek.", explode: [0.45, -0.38, 0.4], pin: [0.60, -0.36, 0.18] },
  { id: "pcb", no: "10", name: "PCB Carrier + Wiring", layer: "Komputasi", price: "Rp110.000", status: "Allowance",
    spec: "Papan induk, terminal, kabel", simple: "Papan penghubung rapi yang menyatukan seluruh komponen elektronik tanpa kabel berantakan.", role: "Papan sirkuit terpadu yang menyalurkan daya & sinyal antarmasukan sensor, mikrokontroler, serta radio agar kokoh dan mudah dirawat.", explode: [0, 0, 0.25], pin: [-0.62, 0.04, -0.08] },
  { id: "sensor", no: "11", name: "Probe Level Air (submersible)", layer: "Sensor", price: "Rp350.000", status: "Allowance",
    spec: "Transduser tekanan, kabel berpelindung", simple: "Sensor celup tahan air yang langsung mengukur seberapa tinggi air di dalam pipa sumur pantau.", role: "Mengukur perubahan tekanan hidrostatik air terhadap patok survei lokal. Sensor ekonomis belum dikalibrasi fisik (pembanding komersial Rp3,9 jt [14]).", explode: [0.75, -0.25, 0.3], pin: [0.54, -0.18, 0.26] },
  { id: "well", no: "12", name: "Sumur Pantau (pipa PVC berlubang)", layer: "Sensor", price: "—", status: "Lapangan",
    spec: "Pipa PVC berlubang + benchmark survei", simple: "Pipa berlubang di tanah gambut yang menyamakan tinggi air di dalamnya dengan air di sekitarnya.", role: "Tempat probe digantung aman di bawah tanah; lubang halus membuat muka air di dalam pipa selalu sama dengan ketinggian air tanah gambut.", explode: [0.75, -0.1, 0.3], pin: [0.52, 0.30, 0.22] },
  { id: "mast", no: "13", name: "Tiang Galvanis", layer: "Struktur", price: "termasuk mounting", status: "Allowance",
    spec: "Pipa besi galvanis ±2,6 m", simple: "Tiang besi anti-karat untuk mengangkat boks elektronik, panel surya, dan antena tinggi di atas tanah.", role: "Menopang kotak elektronik bebas banjir, menjaga panel mendapat cahaya optimal, dan meninggikan posisi antena LoRa di atas semak.", explode: [0, 0, 0], pin: [-0.36, -0.38, -0.10] },
  { id: "peat", no: "14", name: "Lapisan Gambut & Muka Air", layer: "Lingkungan", price: "—", status: "Konteks",
    spec: "Data: Sebangau, Kalimantan Tengah", simple: "Tanah gambut berlapis air tanah; saat air surut terlalu cepat, lapisan gambut mudah mengering.", role: "Air (biru) naik-turun mengikuti data logger asli Sebangau di dashboard. Gambut yang mengering rentan terbakar — meski riset ini fokus memantau hidrologi, bukan alarm api.", explode: [0, -0.55, 0], pin: [-1.02, -0.10, 0.62] },
];

export const TOUR_DURATION = 72; // seconds — 12 calm narrative chapters covering all 14 components

export const TOUR_CHAPTERS = [
  { t0: 0.0,  t1: 6.0,  part: "well",       comp: "peat",       state: "DEEP SLEEP · 9H",       rate: 0.25, mA: "0.08 mA" },
  { t0: 6.0,  t1: 12.0, part: "enclosure",  comp: "mast",       state: "WEATHER GUARD · 9H",    rate: 0.30, mA: "0.08 mA" },
  { t0: 12.0, t1: 18.0, part: "lid",        comp: "enclosure",  state: "FIELD CHECK · 9H",      rate: 0.38, mA: "0.10 mA" },
  { t0: 18.0, t1: 24.0, part: "solar",      comp: "charger",    state: "SOLAR HARVEST · 9H",    rate: 0.44, mA: "12.4 mA" },
  { t0: 24.0, t1: 30.5, part: "battery",    comp: "protection", state: "BMS & SURGE · 6H",      rate: 0.92, mA: "8.2 mA"  },
  { t0: 30.5, t1: 36.5, part: "pcb",        comp: "mcu",        state: "CARRIER BUS · 6H",      rate: 1.18, mA: "18.5 mA" },
  { t0: 36.5, t1: 43.0, part: "sensor",     comp: "well",       state: "DRAWDOWN READ · 3H",    rate: 2.35, mA: "42.0 mA" },
  { t0: 43.0, t1: 50.0, part: "mcu",        comp: "sensor",     state: "SURGE! FAST-HOLD 3H",   rate: 3.10, mA: "48.2 mA" },
  { t0: 50.0, t1: 56.5, part: "lora",       comp: "mcu",        state: "LORA 433MHZ + ACK",     rate: 2.95, mA: "118 mA"  },
  { t0: 56.5, t1: 62.0, part: "antenna",    comp: "lora",       state: "RF UPLINK · 3H HOLD",   rate: 2.15, mA: "118 mA"  },
  { t0: 62.0, t1: 67.5, part: "pcb",        comp: null,         state: "X-RAY 360° SWEEP",      rate: 1.05, mA: "34.0 mA" },
  { t0: 67.5, t1: 72.0, part: null,         comp: null,         state: "IP65 LOCKED · V8 READY", rate: 0.40, mA: "0.08 mA" },
];

const COLORS = {
  emerald: 0x2df5a6, cyan: 0x22d3ee, amber: 0xffb547, violet: 0x9d7bff, rose: 0xff5d8f, lime: 0xdcff70,
};

/* ---------- canvas textures ---------- */
function canvasTex(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const solarTex = () => canvasTex(512, 340, (g, w, h) => {
  g.fillStyle = "#c9d2dc"; g.fillRect(0, 0, w, h);
  const cols = 9, rows = 6, pad = 10, gap = 4;
  const cw = (w - pad * 2 - gap * (cols - 1)) / cols, ch = (h - pad * 2 - gap * (rows - 1)) / rows;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = pad + c * (cw + gap), y = pad + r * (ch + gap);
    const gr = g.createLinearGradient(x, y, x + cw, y + ch);
    gr.addColorStop(0, "#0b1f4a"); gr.addColorStop(0.55, "#132e6b"); gr.addColorStop(1, "#0a1838");
    g.fillStyle = gr; g.fillRect(x, y, cw, ch);
    g.strokeStyle = "rgba(190,210,240,.35)"; g.lineWidth = 1;
    for (let k = 1; k < 3; k++) { g.beginPath(); g.moveTo(x + (cw * k) / 3, y); g.lineTo(x + (cw * k) / 3, y + ch); g.stroke(); }
  }
});

const pcbTex = (base, label, accent) => canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  g.strokeStyle = accent; g.globalAlpha = 0.35; g.lineWidth = 3;
  for (let i = 0; i < 46; i++) {
    let x = Math.random() * w, y = Math.random() * h;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      if (Math.random() > 0.5) x += (Math.random() - 0.5) * 220; else y += (Math.random() - 0.5) * 220;
      g.lineTo(x, y);
    }
    g.stroke();
    g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fillStyle = accent; g.fill();
  }
  g.globalAlpha = 1;
  if (label) {
    g.fillStyle = "rgba(255,255,255,.85)"; g.font = "bold 40px 'JetBrains Mono', monospace";
    g.fillText(label, 26, h - 30);
  }
});

const shieldTex = (label, sub) => canvasTex(256, 256, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, w, h);
  gr.addColorStop(0, "#e9edf2"); gr.addColorStop(1, "#9aa3ad");
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = "#1a2026"; g.font = "bold 34px 'JetBrains Mono', monospace"; g.fillText(label, 18, 110);
  g.font = "20px 'JetBrains Mono', monospace"; g.fillText(sub, 18, 150);
  g.strokeStyle = "#6b7480"; g.lineWidth = 4; g.strokeRect(6, 6, w - 12, h - 12);
});

const peatTex = () => canvasTex(512, 256, (g, w, h) => {
  const layers = [["#1f3a1c", 0.08], ["#3b2a1a", 0.22], ["#2c1f14", 0.25], ["#24190f", 0.25], ["#1b130b", 0.2]];
  let y = 0;
  for (const [c, f] of layers) { g.fillStyle = c; g.fillRect(0, y, w, h * f); y += h * f; }
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(${120 + Math.random() * 80},${90 + Math.random() * 50},${50 + Math.random() * 40},${Math.random() * 0.25})`;
    g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 6, 1 + Math.random() * 2);
  }
  g.strokeStyle = "rgba(255,200,140,.08)";
  for (let i = 0; i < 40; i++) { g.beginPath(); const yy = Math.random() * h; g.moveTo(0, yy); g.bezierCurveTo(w * .3, yy + 8, w * .6, yy - 8, w, yy + 3); g.stroke(); }
});

/* ---------- viewer ---------- */
export function createNodeViewer(container, opts = {}) {
  const o = Object.assign({ autoRotate: true, bloom: true, labels: true, compact: false }, opts);
  const W = () => container.clientWidth, H = () => container.clientHeight;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W(), H());
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(W(), H());
  labelRenderer.domElement.className = "n3d-labels";
  container.appendChild(labelRenderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(36, W() / H(), 0.05, 100);
  const HOME = new THREE.Vector3(4.6, 2.9, 5.4);
  camera.position.copy(HOME);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.85, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 1.6;
  controls.maxDistance = 13;
  controls.autoRotate = o.autoRotate;
  controls.autoRotateSpeed = 0.7;
  controls.enablePan = true;

  /* lights */
  scene.add(new THREE.HemisphereLight(0xbfffe9, 0x10140f, 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(4, 7, 3); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 });
  scene.add(sun);
  const rim = new THREE.PointLight(COLORS.cyan, 18, 12); rim.position.set(-3.5, 2.5, -2.5); scene.add(rim);
  const rim2 = new THREE.PointLight(COLORS.emerald, 10, 10); rim2.position.set(3, 0.4, 3); scene.add(rim2);

  /* grid floor (engineering blueprint vibe) */
  const grid = new THREE.GridHelper(14, 56, 0x1f6f5c, 0x10302a);
  grid.position.y = -1.205; grid.material.transparent = true; grid.material.opacity = 0.45;
  scene.add(grid);

  /* materials */
  const M = {
    metal: new THREE.MeshStandardMaterial({ color: 0xb9c3cc, metalness: 0.9, roughness: 0.28 }),
    darkMetal: new THREE.MeshStandardMaterial({ color: 0x3a434c, metalness: 0.8, roughness: 0.35 }),
    shell: new THREE.MeshStandardMaterial({ color: 0xdfe6ea, metalness: 0.05, roughness: 0.45 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xbff6ff, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.22, clearcoat: 1, depthWrite: false }),
    pvc: new THREE.MeshStandardMaterial({ color: 0xf1f4f2, roughness: 0.5, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }),
    cable: new THREE.MeshStandardMaterial({ color: 0x14181c, roughness: 0.6 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x1a1d20, roughness: 0.9 }),
    pcbGreen: new THREE.MeshStandardMaterial({ map: pcbTex("#0d3b2a", "SYLVARIS-CB r1", "#3cf0a8"), roughness: 0.55 }),
    pcbBlack: new THREE.MeshStandardMaterial({ map: pcbTex("#121417", "ESP32-S3", "#22d3ee"), roughness: 0.5 }),
    pcbBlue: new THREE.MeshStandardMaterial({ map: pcbTex("#0f2a5c", "RA-02", "#9d7bff"), roughness: 0.5 }),
    pcbRed: new THREE.MeshStandardMaterial({ map: pcbTex("#5c1222", "CHG", "#ffb547"), roughness: 0.5 }),
    shieldEsp: new THREE.MeshStandardMaterial({ map: shieldTex("ESP32-S3", "WROOM-1 N16R8"), metalness: 0.7, roughness: 0.3 }),
    shieldLora: new THREE.MeshStandardMaterial({ map: shieldTex("SX1278", "433MHz LoRa"), metalness: 0.7, roughness: 0.3 }),
    battery: new THREE.MeshStandardMaterial({ color: 0x1fb57a, metalness: 0.3, roughness: 0.35 }),
    battery2: new THREE.MeshStandardMaterial({ color: 0x0f8fbf, metalness: 0.3, roughness: 0.35 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xe8c36a, metalness: 1, roughness: 0.25 }),
    chip: new THREE.MeshStandardMaterial({ color: 0x0b0d10, roughness: 0.4 }),
    fuse: new THREE.MeshStandardMaterial({ color: 0xff5d8f, roughness: 0.4, emissive: 0x330010 }),
    solar: new THREE.MeshStandardMaterial({ map: solarTex(), metalness: 0.4, roughness: 0.18 }),
    frame: new THREE.MeshStandardMaterial({ color: 0xaab4bd, metalness: 0.95, roughness: 0.3 }),
    peat: new THREE.MeshStandardMaterial({ map: peatTex(), roughness: 1, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
    moss: new THREE.MeshStandardMaterial({ color: 0x1f5a2e, roughness: 1, transparent: true, opacity: 0.85 }),
    water: new THREE.MeshPhysicalMaterial({ color: 0x1ec8ff, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.42, depthWrite: false, emissive: 0x05344a }),
    probe: new THREE.MeshStandardMaterial({ color: 0xd8dde2, metalness: 0.85, roughness: 0.22 }),
    led: new THREE.MeshStandardMaterial({ color: 0x2df5a6, emissive: 0x2df5a6, emissiveIntensity: 0.6 }),
  };

  const root = new THREE.Group();
  scene.add(root);
  const parts = {}; // id -> { group, base, meshes[] }

  function part(id) {
    const g = new THREE.Group();
    g.userData.partId = id;
    root.add(g);
    parts[id] = { group: g, base: new THREE.Vector3(), meshes: [], meta: PARTS.find((p) => p.id === id) };
    return g;
  }
  function add(g, geo, mat, pos = [0, 0, 0], rot = [0, 0, 0]) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos); m.rotation.set(...rot);
    m.castShadow = true; m.receiveShadow = true;
    m.userData.partId = g.userData.partId;
    g.add(m);
    parts[g.userData.partId].meshes.push(m);
    return m;
  }

  /* ---- 14 peat & water ---- */
  const gPeat = part("peat");
  const peatBox = add(gPeat, new THREE.BoxGeometry(3.2, 1.2, 3.2), M.peat, [0, -0.6, 0]);
  peatBox.castShadow = false;
  add(gPeat, new THREE.BoxGeometry(3.22, 0.06, 3.22), M.moss, [0, 0.02, 0]).castShadow = false;
  // vegetation tufts
  const tuftGeo = new THREE.ConeGeometry(0.035, 0.22, 5);
  const tuftMat = new THREE.MeshStandardMaterial({ color: 0x2f8a46, roughness: 0.9 });
  for (let i = 0; i < 70; i++) {
    const x = (Math.random() - 0.5) * 3.0, z = (Math.random() - 0.5) * 3.0;
    if (Math.hypot(x - 0.75, z - 0.3) < 0.25 || Math.hypot(x, z) < 0.15) continue;
    const t = add(gPeat, tuftGeo, tuftMat, [x, 0.13, z], [Math.random() * 0.3, 0, Math.random() * 0.3]);
    t.scale.setScalar(0.6 + Math.random() * 0.9);
  }
  const waterGeo = new THREE.BoxGeometry(3.14, 1, 3.14);
  waterGeo.translate(0, 0.5, 0); // origin at bottom
  const water = add(gPeat, waterGeo, M.water, [0, -1.18, 0]);
  water.castShadow = false;
  const waterTop = add(gPeat, new THREE.PlaneGeometry(3.14, 3.14, 40, 40), new THREE.MeshStandardMaterial({ color: 0x5fe3ff, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.2, emissive: 0x0b4a63, side: THREE.DoubleSide, depthWrite: false }), [0, -0.5, 0], [-Math.PI / 2, 0, 0]);
  waterTop.castShadow = false;
  let waterLevel = 0.55;

  /* ---- 13 mast ---- */
  const gMast = part("mast");
  add(gMast, new THREE.CylinderGeometry(0.045, 0.05, 3.9, 24), M.metal, [0, 0.75, 0]);
  add(gMast, new THREE.CylinderGeometry(0.12, 0.12, 0.04, 24), M.darkMetal, [0, 0.03, 0]);
  add(gMast, new THREE.CylinderGeometry(0.055, 0.055, 0.06, 24), M.darkMetal, [0, 2.7, 0]);

  /* ---- 04 enclosure shell (open front) ---- */
  const EY = 1.35, EZ = 0.22; // enclosure centre
  const gEnc = part("enclosure");
  const ew = 0.78, eh = 0.92, ed = 0.32, th = 0.03;
  add(gEnc, new THREE.BoxGeometry(ew, eh, th), M.shell, [0, EY, EZ - ed / 2]);
  add(gEnc, new THREE.BoxGeometry(th, eh, ed), M.shell, [-ew / 2, EY, EZ]);
  add(gEnc, new THREE.BoxGeometry(th, eh, ed), M.shell, [ew / 2, EY, EZ]);
  add(gEnc, new THREE.BoxGeometry(ew, th, ed), M.shell, [0, EY + eh / 2, EZ]);
  add(gEnc, new THREE.BoxGeometry(ew, th, ed), M.shell, [0, EY - eh / 2, EZ]);
  // pole clamps
  for (const dy of [-0.3, 0.3]) add(gEnc, new THREE.TorusGeometry(0.065, 0.014, 10, 28), M.darkMetal, [0, EY + dy, 0], [Math.PI / 2, 0, 0]);
  add(gEnc, new THREE.BoxGeometry(0.16, 0.8, 0.05), M.darkMetal, [0, EY, 0.05]);
  // cable glands
  for (const dx of [-0.22, 0, 0.22]) add(gEnc, new THREE.CylinderGeometry(0.03, 0.035, 0.06, 16), M.rubber, [dx, EY - eh / 2 - 0.03, EZ + 0.02]);

  /* ---- 03 lid ---- */
  const gLid = part("lid");
  add(gLid, new THREE.BoxGeometry(ew + 0.02, eh + 0.02, 0.025), M.glass, [0, EY, EZ + ed / 2 + 0.012]);
  const gasket = add(gLid, new THREE.TorusGeometry(0.001, 0.001, 3, 4), M.rubber, [0, EY, EZ + ed / 2]);
  gasket.visible = false;
  const led = add(gLid, new THREE.SphereGeometry(0.022, 16, 16), M.led, [ew / 2 - 0.07, EY + eh / 2 - 0.07, EZ + ed / 2 + 0.03]);
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(gLid, new THREE.CylinderGeometry(0.014, 0.014, 0.03, 10), M.metal, [sx * (ew / 2 - 0.03), EY + sy * (eh / 2 - 0.03), EZ + ed / 2 + 0.02], [Math.PI / 2, 0, 0]);

  /* ---- 10 carrier pcb ---- */
  const PZ = EZ - ed / 2 + 0.035;
  const gPcb = part("pcb");
  add(gPcb, new THREE.BoxGeometry(0.68, 0.82, 0.016), M.pcbGreen, [0, EY, PZ]);
  for (let i = 0; i < 8; i++) add(gPcb, new THREE.BoxGeometry(0.04, 0.05, 0.04), new THREE.MeshStandardMaterial({ color: 0x1fa86e, roughness: 0.5 }), [-0.28 + i * 0.08, EY - 0.36, PZ + 0.02]);
  // wiring loom
  const wirePath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.2, EY + 0.18, PZ + 0.03), new THREE.Vector3(-0.05, EY + 0.05, PZ + 0.06),
    new THREE.Vector3(0.15, EY - 0.05, PZ + 0.05), new THREE.Vector3(0.2, EY - 0.3, PZ + 0.03),
  ]);
  add(gPcb, new THREE.TubeGeometry(wirePath, 40, 0.008, 8), new THREE.MeshStandardMaterial({ color: 0xff5d8f, roughness: 0.5 }));
  const wirePath2 = wirePath.clone(); wirePath2.points = wirePath.points.map((p) => p.clone().add(new THREE.Vector3(0.02, -0.015, 0)));
  add(gPcb, new THREE.TubeGeometry(wirePath2, 40, 0.008, 8), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 }));

  /* ---- 05 ESP32-S3 ---- */
  const gMcu = part("mcu");
  const mcuX = -0.14, mcuY = EY + 0.2, mcuZ = PZ + 0.03;
  add(gMcu, new THREE.BoxGeometry(0.3, 0.2, 0.014), M.pcbBlack, [mcuX, mcuY, mcuZ]);
  add(gMcu, new THREE.BoxGeometry(0.13, 0.15, 0.022), M.shieldEsp, [mcuX - 0.04, mcuY, mcuZ + 0.017]);
  add(gMcu, new THREE.BoxGeometry(0.05, 0.05, 0.01), M.chip, [mcuX + 0.08, mcuY + 0.03, mcuZ + 0.012]);
  add(gMcu, new THREE.BoxGeometry(0.045, 0.03, 0.02), M.metal, [mcuX + 0.14, mcuY - 0.05, mcuZ + 0.015]); // usb-c
  for (let i = 0; i < 12; i++) {
    add(gMcu, new THREE.BoxGeometry(0.008, 0.008, 0.02), M.gold, [mcuX - 0.13 + i * 0.024, mcuY + 0.092, mcuZ + 0.012]);
    add(gMcu, new THREE.BoxGeometry(0.008, 0.008, 0.02), M.gold, [mcuX - 0.13 + i * 0.024, mcuY - 0.092, mcuZ + 0.012]);
  }
  const mcuLed = add(gMcu, new THREE.SphereGeometry(0.008, 10, 10), new THREE.MeshStandardMaterial({ color: COLORS.cyan, emissive: COLORS.cyan, emissiveIntensity: 1 }), [mcuX + 0.1, mcuY - 0.02, mcuZ + 0.01]);

  /* ---- 06 LoRa ---- */
  const gLora = part("lora");
  const loX = 0.17, loY = EY + 0.22, loZ = PZ + 0.03;
  add(gLora, new THREE.BoxGeometry(0.17, 0.17, 0.012), M.pcbBlue, [loX, loY, loZ]);
  add(gLora, new THREE.BoxGeometry(0.12, 0.12, 0.018), M.shieldLora, [loX, loY, loZ + 0.014]);
  add(gLora, new THREE.CylinderGeometry(0.018, 0.018, 0.05, 14), M.gold, [loX + 0.06, loY + 0.11, loZ + 0.01]);
  const coax = new THREE.CatmullRomCurve3([new THREE.Vector3(loX + 0.06, loY + 0.13, loZ + 0.01), new THREE.Vector3(0.24, EY + 0.42, PZ + 0.06), new THREE.Vector3(0.26, EY + eh / 2 + 0.01, EZ)]);
  add(gLora, new THREE.TubeGeometry(coax, 20, 0.006, 6), M.cable);

  /* ---- 07 charger ---- */
  const gChg = part("charger");
  const chX = 0.17, chY = EY - 0.04, chZ = PZ + 0.03;
  add(gChg, new THREE.BoxGeometry(0.18, 0.13, 0.012), M.pcbRed, [chX, chY, chZ]);
  add(gChg, new THREE.CylinderGeometry(0.022, 0.022, 0.04, 16), M.darkMetal, [chX - 0.04, chY, chZ + 0.026], [Math.PI / 2, 0, 0]);
  add(gChg, new THREE.CylinderGeometry(0.016, 0.016, 0.05, 16), new THREE.MeshStandardMaterial({ color: 0x1c2b80, metalness: 0.4, roughness: 0.3 }), [chX + 0.04, chY + 0.02, chZ + 0.03], [Math.PI / 2, 0, 0]);
  add(gChg, new THREE.BoxGeometry(0.04, 0.03, 0.02), M.chip, [chX + 0.04, chY - 0.035, chZ + 0.012]);

  /* ---- 08 battery ---- */
  const gBat = part("battery");
  const bX = -0.16, bY = EY - 0.18, bZ = PZ + 0.06;
  for (let i = 0; i < 2; i++) {
    add(gBat, new THREE.CylinderGeometry(0.036, 0.036, 0.3, 24), i ? M.battery2 : M.battery, [bX, bY - i * 0.085, bZ], [0, 0, Math.PI / 2]);
    add(gBat, new THREE.CylinderGeometry(0.014, 0.014, 0.012, 12), M.metal, [bX + 0.155, bY - i * 0.085, bZ], [0, 0, Math.PI / 2]);
  }
  add(gBat, new THREE.BoxGeometry(0.2, 0.05, 0.01), new THREE.MeshStandardMaterial({ color: 0x0e5b3c, roughness: 0.5 }), [bX, bY - 0.17, bZ - 0.02]);

  /* ---- 09 protection ---- */
  const gPro = part("protection");
  const prX = 0.2, prY = EY - 0.27, prZ = PZ + 0.03;
  add(gPro, new THREE.BoxGeometry(0.14, 0.07, 0.03), M.rubber, [prX, prY, prZ]);
  add(gPro, new THREE.CylinderGeometry(0.012, 0.012, 0.09, 14), M.fuse, [prX, prY, prZ + 0.025], [0, 0, Math.PI / 2]);
  add(gPro, new THREE.BoxGeometry(0.03, 0.02, 0.012), new THREE.MeshStandardMaterial({ color: 0xffb547, roughness: 0.5 }), [prX - 0.04, prY - 0.06, prZ]);

  /* ---- 02 antenna ---- */
  const gAnt = part("antenna");
  const aX = 0.26, aY = EY + eh / 2;
  add(gAnt, new THREE.CylinderGeometry(0.025, 0.03, 0.06, 16), M.gold, [aX, aY + 0.03, EZ]);
  add(gAnt, new THREE.CylinderGeometry(0.012, 0.018, 0.75, 16), M.rubber, [aX, aY + 0.43, EZ]);
  const antTip = add(gAnt, new THREE.SphereGeometry(0.018, 12, 12), new THREE.MeshStandardMaterial({ color: COLORS.violet, emissive: COLORS.violet, emissiveIntensity: 0.6 }), [aX, aY + 0.81, EZ]);

  /* ---- 01 solar ---- */
  const gSol = part("solar");
  const sY = 2.78;
  const panel = new THREE.Group(); panel.position.set(0, sY + 0.18, 0.05); panel.rotation.x = -0.28; gSol.add(panel);
  const solarFace = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.025, 0.76), [M.frame, M.frame, M.solar, M.darkMetal, M.frame, M.frame]);
  solarFace.castShadow = true; solarFace.userData.partId = "solar"; panel.add(solarFace); parts.solar.meshes.push(solarFace);
  for (const [w, d, x, z] of [[1.19, 0.02, 0, 0.39], [1.19, 0.02, 0, -0.39], [0.02, 0.8, 0.585, 0], [0.02, 0.8, -0.585, 0]]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(w, 0.045, d), M.frame); f.position.set(x, 0, z); f.userData.partId = "solar"; panel.add(f); parts.solar.meshes.push(f);
  }
  add(gSol, new THREE.BoxGeometry(0.1, 0.22, 0.1), M.darkMetal, [0, sY + 0.03, 0.02]);
  add(gSol, new THREE.CylinderGeometry(0.03, 0.03, 0.4, 12), M.darkMetal, [0, sY + 0.1, 0.05], [Math.PI / 2 - 0.28, 0, 0]);

  /* ---- 12 monitoring well ---- */
  const WX = 0.75, WZ = 0.3;
  const gWell = part("well");
  add(gWell, new THREE.CylinderGeometry(0.1, 0.1, 1.55, 32, 1, true), M.pvc, [WX, -0.45, WZ]);
  add(gWell, new THREE.CylinderGeometry(0.115, 0.115, 0.06, 32), M.shell, [WX, 0.34, WZ]);
  const holeMat = new THREE.MeshStandardMaterial({ color: 0x0a0f0d, roughness: 1 });
  for (let r = 0; r < 9; r++) for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + (r % 2) * 0.4, y = -1.1 + r * 0.11;
    add(gWell, new THREE.CylinderGeometry(0.012, 0.012, 0.005, 8), holeMat, [WX + Math.cos(a) * 0.101, y, WZ + Math.sin(a) * 0.101], [0, -a, Math.PI / 2]);
  }
  // benchmark peg
  add(gWell, new THREE.BoxGeometry(0.05, 0.3, 0.05), new THREE.MeshStandardMaterial({ color: 0xffb547, roughness: 0.5, emissive: 0x2a1a00 }), [WX + 0.3, 0.12, WZ - 0.1]);

  /* ---- 11 sensor probe + cable ---- */
  const gSen = part("sensor");
  const probe = add(gSen, new THREE.CapsuleGeometry(0.035, 0.18, 6, 16), M.probe, [WX, -0.98, WZ]);
  const probeRing = add(gSen, new THREE.TorusGeometry(0.04, 0.006, 8, 24), new THREE.MeshStandardMaterial({ color: COLORS.cyan, emissive: COLORS.cyan, emissiveIntensity: 0.5 }), [WX, -0.93, WZ], [Math.PI / 2, 0, 0]);
  const senCable = new THREE.CatmullRomCurve3([
    new THREE.Vector3(WX, -0.86, WZ), new THREE.Vector3(WX, 0.2, WZ), new THREE.Vector3(WX, 0.42, WZ),
    new THREE.Vector3(WX - 0.25, 0.7, WZ - 0.02), new THREE.Vector3(0.22, EY - eh / 2 - 0.25, EZ + 0.02), new THREE.Vector3(0.22, EY - eh / 2 - 0.03, EZ + 0.02),
  ]);
  add(gSen, new THREE.TubeGeometry(senCable, 80, 0.011, 8), M.cable);

  /* ---- base positions ---- */
  for (const id in parts) parts[id].base.copy(parts[id].group.position);

  /* ---- labels + translucent holographic leader lines ---- */
  const labelObjs = [];
  const box = new THREE.Box3(), ctr = new THREE.Vector3(), anchorCtr = new THREE.Vector3();
  function partCenter(id, target = new THREE.Vector3()) {
    box.makeEmpty();
    for (const m of parts[id].meshes) if (m.visible) box.expandByObject(m);
    return box.getCenter(target);
  }
  for (const p of PARTS) {
    const lGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const lMat = new THREE.LineBasicMaterial({ color: COLORS.emerald, transparent: true, opacity: 0.24, depthWrite: false });
    const line = new THREE.Line(lGeo, lMat);
    line.visible = false;
    root.add(line);

    let el = null, obj = null;
    if (o.labels) {
      el = document.createElement("button");
      el.className = "n3d-tag";
      el.type = "button";
      el.innerHTML = `<span>${p.no}</span><em>${p.name}</em>`;
      el.addEventListener("click", (e) => { e.stopPropagation(); select(p.id, true); });
      el.addEventListener("pointerenter", () => { hovered = p.id; labelObjs.forEach((x) => x.el?.classList.toggle("is-hover", x.id === hovered)); });
      el.addEventListener("pointerleave", () => { if (hovered === p.id) hovered = null; labelObjs.forEach((x) => x.el?.classList.toggle("is-hover", false)); });
      obj = new CSS2DObject(el);
      root.add(obj);
    }
    labelObjs.push({ id: p.id, pin: new THREE.Vector3(...(p.pin || [0, 0, 0])), obj, el, line, lMat });
  }

  /* ---- LoRa ping rings ---- */
  const rings = [];
  const ringMat = new THREE.MeshBasicMaterial({ color: COLORS.violet, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
  function ping(color = COLORS.violet) {
    const tip = new THREE.Vector3(); antTip.getWorldPosition(tip);
    for (let k = 0; k < 3; k++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.008, 8, 48), ringMat.clone());
      r.material.color.setHex(color);
      r.position.copy(tip); r.rotation.x = Math.PI / 2;
      r.userData.t = -k * 0.25;
      scene.add(r); rings.push(r);
    }
  }

  /* ---- state ---- */
  let explode = 0, explodeTarget = 0;
  let selected = null;
  let companion = null;
  let mode = "solid";
  let ledFlash = 0, ledColor = new THREE.Color(COLORS.emerald);
  let sensorFlash = 0;
  const listeners = { select: [], tour: [] };
  const camTween = { active: false, t: 0, fromPos: new THREE.Vector3(), toPos: new THREE.Vector3(), fromT: new THREE.Vector3(), toT: new THREE.Vector3() };

  /* ---- 72-second choreographed simulation state ---- */
  const tour = {
    playing: false,
    active: false,
    userPausedOrbit: false,
    t: 0,
    speed: 1,
    loop: false,
    lastPingCue: -1,
    lastReadCue: -1,
    lastChapIdx: -1,
    preTourMode: "solid",
    rec: null,
  };
  controls.addEventListener("start", () => {
    if (tour.active) tour.userPausedOrbit = true;
  });

  const allMeshes = [];
  root.traverse((ob) => { if (ob.isMesh) { allMeshes.push(ob); ob.userData.baseMat = ob.material; } });

  function applyMode() {
    for (const m of allMeshes) {
      const id = m.userData.partId;
      const isSel = selected && id === selected;
      const isComp = companion && id === companion && !isSel;
      const base = m.userData.baseMat;
      if (Array.isArray(base)) { m.material = base; continue; }
      let mat = base;
      if (mode === "wire") {
        mat = m.userData.wireMat || (m.userData.wireMat = new THREE.MeshBasicMaterial({ color: COLORS.emerald, wireframe: true, transparent: true, opacity: 0.35 }));
      } else if (mode === "xray") {
        mat = m.userData.xrayMat || (m.userData.xrayMat = new THREE.MeshBasicMaterial({ color: COLORS.cyan, transparent: true, opacity: 0.14, depthWrite: false, blending: THREE.AdditiveBlending }));
      }
      if (selected && !isSel && !isComp && mode === "solid") {
        mat = m.userData.dimMat || (m.userData.dimMat = (() => { const d = base.clone(); d.transparent = true; d.opacity = Math.min(base.opacity ?? 1, 0.17); d.depthWrite = false; return d; })());
      }
      if (isComp && mode === "solid") {
        mat = m.userData.compMat || (m.userData.compMat = (() => { const c = base.clone(); c.emissive = new THREE.Color(COLORS.cyan); c.emissiveIntensity = 0.32; if (c.opacity < 0.38) c.opacity = 0.48; return c; })());
      }
      if (isSel) {
        mat = m.userData.selMat || (m.userData.selMat = (() => { const s = base.clone(); s.emissive = new THREE.Color(COLORS.emerald); s.emissiveIntensity = 0.85; if (s.opacity < 0.42) s.opacity = 0.62; return s; })());
      }
      m.material = mat;
    }
    labelObjs.forEach((l) => {
      l.el?.classList.toggle("is-active", l.id === selected);
      l.el?.classList.toggle("is-companion", Boolean(companion && l.id === companion && l.id !== selected));
    });
  }

  function select(id, focus = false) {
    const next = id && selected === id && !focus ? null : id;
    if (next === selected && companion === null && !focus) return;
    selected = next;
    companion = null;
    applyMode();
    listeners.select.forEach((fn) => fn(selected ? PARTS.find((p) => p.id === selected) : null));
    if (selected && focus) focusPart(selected);
  }

  function focusPart(id) {
    const c = partCenter(id, new THREE.Vector3());
    const dir = camera.position.clone().sub(controls.target).normalize();
    const size = box.getSize(new THREE.Vector3()).length();
    const dist = THREE.MathUtils.clamp(size * 2.4, 1.6, 6);
    camTween.fromPos.copy(camera.position); camTween.fromT.copy(controls.target);
    camTween.toT.copy(c); camTween.toPos.copy(c).add(dir.multiplyScalar(dist));
    camTween.t = 0; camTween.active = true;
  }

  function resetView() {
    camTween.fromPos.copy(camera.position); camTween.fromT.copy(controls.target);
    camTween.toPos.copy(HOME); camTween.toT.set(0, 0.85, 0);
    camTween.t = 0; camTween.active = true;
    select(null);
  }

  function setView(name) {
    const t = new THREE.Vector3(0, 0.85, 0);
    const p = { front: [0, 1.2, 6.6], top: [0.01, 8, 0.01], side: [6.6, 1.2, 0], iso: HOME.toArray() }[name] || HOME.toArray();
    camTween.fromPos.copy(camera.position); camTween.fromT.copy(controls.target);
    camTween.toPos.set(...p); camTween.toT.copy(t); camTween.t = 0; camTween.active = true;
  }

  /* ---- picking ---- */
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  let downAt = null, hovered = null;
  renderer.domElement.addEventListener("pointerdown", (e) => { downAt = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
    const hit = pick(e);
    select(hit ? hit.object.userData.partId : null, false);
  });
  renderer.domElement.addEventListener("pointermove", (e) => {
    const hit = pick(e);
    const id = hit ? hit.object.userData.partId : null;
    if (id !== hovered) {
      hovered = id;
      renderer.domElement.style.cursor = id ? "pointer" : "grab";
      labelObjs.forEach((l) => l.el?.classList.toggle("is-hover", l.id === id));
      container.dispatchEvent(new CustomEvent("n3d-hover", { detail: id ? PARTS.find((p) => p.id === id) : null }));
    }
  });
  function pick(e) {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const hits = ray.intersectObjects(allMeshes.filter((m) => m.visible), false);
    const solid = hits.find((h) => !["peat"].includes(h.object.userData.partId));
    return solid || hits[0] || null;
  }

  /* ---- postprocessing ---- */
  let composer = null, bloomPass = null;
  if (o.bloom) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(new THREE.Vector2(W(), H()), 0.45, 0.6, 0.82);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
  }

  /* ---- resize ---- */
  const ro = new ResizeObserver(() => {
    const w = W(), h = H(); if (!w || !h) return;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.setSize(w, h); labelRenderer.setSize(w, h);
    if (composer) composer.setSize(w, h);
  });
  ro.observe(container);

  /* ---- choreographed 72s timeline evaluator ---- */
  const KFS = [
    { t: 0.0,  exp: 0.00, wat: 0.66, th: 0.78,  ph: 1.12, dist: 6.9, tx: 0.15, ty: 0.20, tz: 0.15 }, // CH01: Peat & Well context
    { t: 6.0,  exp: 0.08, wat: 0.60, th: 1.38,  ph: 1.06, dist: 5.9, tx: 0.08, ty: 0.78, tz: 0.12 }, // CH02: Mast & IP65 Enclosure
    { t: 12.0, exp: 0.24, wat: 0.56, th: 0.28,  ph: 1.02, dist: 4.8, tx: 0.00, ty: 1.18, tz: 0.28 }, // CH03: Clear Lid opening
    { t: 18.0, exp: 0.40, wat: 0.52, th: -0.52, ph: 0.92, dist: 5.0, tx: -0.05,ty: 1.65, tz: 0.12 }, // CH04: Solar + Charge Ctrl
    { t: 24.0, exp: 0.54, wat: 0.46, th: -1.18, ph: 1.08, dist: 4.6, tx: 0.00, ty: 1.04, tz: 0.18 }, // CH05: Battery + Surge guard
    { t: 30.5, exp: 0.68, wat: 0.36, th: 0.22,  ph: 1.02, dist: 4.5, tx: 0.00, ty: 1.12, tz: 0.18 }, // CH06: Carrier PCB bus
    { t: 36.5, exp: 0.74, wat: 0.17, th: 1.05,  ph: 1.16, dist: 4.7, tx: 0.55, ty: 0.18, tz: 0.28 }, // CH07: Water drop & Probe read
    { t: 43.0, exp: 0.82, wat: 0.16, th: 0.12,  ph: 1.00, dist: 4.3, tx: -0.10,ty: 1.16, tz: 0.25 }, // CH08: ESP32-S3 Fast-Hold spike
    { t: 50.0, exp: 0.88, wat: 0.22, th: -0.45, ph: 1.02, dist: 4.5, tx: 0.15, ty: 1.18, tz: 0.26 }, // CH09: SX1278 LoRa TX + ACK
    { t: 56.5, exp: 0.94, wat: 0.28, th: 0.55,  ph: 0.90, dist: 5.1, tx: 0.12, ty: 1.72, tz: 0.08 }, // CH10: 433 MHz Whip Antenna RF
    { t: 62.0, exp: 0.96, wat: 0.38, th: 4.08,  ph: 1.02, dist: 6.3, tx: 0.00, ty: 0.96, tz: 0.04 }, // CH11: Full 360 X-Ray sweep
    { t: 67.5, exp: 0.84, wat: 0.48, th: 5.85,  ph: 1.05, dist: 6.8, tx: 0.00, ty: 0.88, tz: 0.00 }, // Rotate toward lock
    { t: 72.0, exp: 0.00, wat: 0.55, th: 7.06,  ph: 1.06, dist: 7.6, tx: 0.00, ty: 0.85, tz: 0.00 }, // CH12: Sealed re-lock home (7.06 wraps to ~0.78)
  ];
  const lerp = (a, b, k) => a + (b - a) * k;
  const smoothstep = (x) => { const c = THREE.MathUtils.clamp(x, 0, 1); return c * c * (3 - 2 * c); };
  const projA = new THREE.Vector3();
  const projC = new THREE.Vector3();
  const recCtr = new THREE.Vector3();
  const recAnc = new THREE.Vector3();

  function roundRectPath(ctx, x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  function sampleTour(tSec) {
    const t = THREE.MathUtils.clamp(tSec, 0, TOUR_DURATION);
    let i = 0;
    while (i < KFS.length - 2 && t > KFS[i + 1].t) i++;
    const a = KFS[i], b = KFS[i + 1];
    const k = smoothstep((t - a.t) / (b.t - a.t || 1));

    const chapIdx = Math.max(0, TOUR_CHAPTERS.findIndex((c) => t >= c.t0 && t <= c.t1));
    const chap = TOUR_CHAPTERS[chapIdx] || TOUR_CHAPTERS[0];

    // Give EVERY single part 01..14 explicit primary spotlight across 72 seconds
    let activePart = chap.part;
    let companionPart = chap.comp || null;
    if (t < 3.0)       { activePart = "peat";       companionPart = "well"; }
    else if (t < 6.0)  { activePart = "well";       companionPart = "peat"; }
    else if (t < 9.0)  { activePart = "mast";       companionPart = "enclosure"; }
    else if (t < 12.0) { activePart = "enclosure";  companionPart = "mast"; }
    else if (t < 21.2) { activePart = "solar";      companionPart = "charger"; }
    else if (t < 24.0) { activePart = "charger";    companionPart = "solar"; }
    else if (t < 27.3) { activePart = "battery";    companionPart = "protection"; }
    else if (t < 30.5) { activePart = "protection"; companionPart = "battery"; }
    else if (t >= 69.2){ activePart = null;         companionPart = null; }

    const wantMode = t >= 62.0 && t < 67.5 ? "xray" : "solid";

    return {
      t,
      chapIdx,
      chap,
      activePart,
      companionPart,
      wantMode,
      exp: lerp(a.exp, b.exp, k),
      wat: lerp(a.wat, b.wat, k),
      th: lerp(a.th, b.th, k),
      ph: lerp(a.ph, b.ph, k),
      dist: lerp(a.dist, b.dist, k),
      tx: lerp(a.tx, b.tx, k),
      ty: lerp(a.ty, b.ty, k),
      tz: lerp(a.tz, b.tz, k),
    };
  }

  function finishRecording() {
    if (!tour.rec) return;
    const r = tour.rec;
    tour.rec = null;
    if (r.recorder && r.recorder.state !== "inactive") r.recorder.stop();
  }

  function projectToCanvas(vec, ox, oy, dw, dh) {
    projA.copy(vec).project(camera);
    if (projA.z > 1 || projA.z < -1) return null;
    return {
      x: ox + (projA.x * 0.5 + 0.5) * dw,
      y: oy + (-projA.y * 0.5 + 0.5) * dh,
    };
  }

  function drawMiniScopeRec(ctx, x, y, w, h, tNorm, rate) {
    ctx.save();
    ctx.strokeStyle = "rgba(45, 245, 166, 0.16)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2);
    ctx.stroke();

    const xCurve = (u) => {
      const base = Math.sin(u * Math.PI * 5) * 0.08;
      const drop = u > 0.36 ? -0.58 * Math.exp(-Math.pow((u - 0.58) / 0.18, 2)) : 0;
      return 0.36 - base - drop;
    };
    const rCurve = (u) => {
      const bump = Math.exp(-Math.pow((u - 0.46) / 0.09, 2)) * 0.72 + Math.exp(-Math.pow((u - 0.64) / 0.08, 2)) * 0.85;
      return 0.84 - bump * 0.72;
    };

    ctx.strokeStyle = "rgba(0, 229, 255, 0.28)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i <= 70; i++) {
      const u = i / 70, px = x + u * w, py = y + xCurve(u) * h;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();

    const steps = Math.max(1, Math.round(tNorm * 70));
    ctx.strokeStyle = "#dcff70";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const u = i / 70, px = x + u * w, py = y + rCurve(u) * h;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();

    ctx.strokeStyle = "#00e5ff";
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const u = i / 70, px = x + u * w, py = y + xCurve(u) * h;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();

    const hx = x + tNorm * w, hy = y + xCurve(tNorm) * h;
    ctx.fillStyle = rate >= 2 ? "#ffb547" : "#2df5a6";
    ctx.beginPath(); ctx.arc(hx, hy, 3.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function paintRecordOverlay(st) {
    const rec = tour.rec;
    if (!rec) return;
    const ctx = rec.ctx, W = rec.w, H = rec.h;
    ctx.fillStyle = "#030b0a";
    ctx.fillRect(0, 0, W, H);

    // Draw WebGL frame preserving aspect centered
    const src = renderer.domElement;
    const sc = Math.min(W / src.width, H / src.height);
    const dw = src.width * sc, dh = src.height * sc;
    const ox = (W - dw) / 2, oy = (H - dh) / 2;
    ctx.drawImage(src, ox, oy, dw, dh);

    // Project 01..14 component numbers & leader lines non-blockingly onto 2D recording canvas
    const eNow = ease(THREE.MathUtils.clamp(explode, 0, 1));
    const fanScale = 1 - eNow * 0.42;
    const activeMeta = st.activePart ? (rec.getPartMeta ? rec.getPartMeta(st.activePart) : PARTS.find((p) => p.id === st.activePart)) : null;

    const entries = [];
    for (const l of labelObjs) {
      partCenter(l.id, recCtr);
      recAnc.copy(recCtr).addScaledVector(l.pin, fanScale);
      const cp = projectToCanvas(recCtr, ox, oy, dw, dh);
      const ap = projectToCanvas(recAnc, ox, oy, dw, dh);
      if (!cp || !ap) continue;
      entries.push({ id: l.id, cp, ap });
    }

    // 1) Draw faint translucent non-active numbers first so they sit calmly behind highlight
    for (const ent of entries) {
      if (ent.id === st.activePart || ent.id === st.companionPart) continue;
      const p = rec.getPartMeta ? rec.getPartMeta(ent.id) : PARTS.find((x) => x.id === ent.id);
      if (!p) continue;
      if (ent.ap.y < 86 || ent.ap.y > H - 148 || ent.ap.x < 28 || ent.ap.x > W - 28) continue;

      ctx.save();
      ctx.strokeStyle = "rgba(45, 245, 166, 0.14)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(ent.cp.x, ent.cp.y); ctx.lineTo(ent.ap.x, ent.ap.y); ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "rgba(4, 15, 12, 0.34)";
      ctx.strokeStyle = "rgba(45, 245, 166, 0.45)";
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(ent.ap.x, ent.ap.y, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

      ctx.fillStyle = "rgba(210, 255, 236, 0.78)";
      ctx.font = "700 9.5px 'JetBrains Mono', monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(p.no, ent.ap.x, ent.ap.y + 0.5);
      ctx.restore();
    }

    // 2) Draw optional companion highlight (cyan hollow badge)
    if (st.companionPart) {
      const ce = entries.find((x) => x.id === st.companionPart);
      const cpMeta = rec.getPartMeta ? rec.getPartMeta(st.companionPart) : PARTS.find((x) => x.id === st.companionPart);
      if (ce && cpMeta) {
        const px = THREE.MathUtils.clamp(ce.ap.x, 42, W - 42);
        const py = THREE.MathUtils.clamp(ce.ap.y, 92, H - 154);
        ctx.save();
        ctx.strokeStyle = "rgba(0, 229, 255, 0.42)";
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(ce.cp.x, ce.cp.y); ctx.lineTo(px, py); ctx.stroke();
        ctx.beginPath(); ctx.arc(ce.cp.x, ce.cp.y, 16, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(4, 22, 26, 0.72)";
        ctx.strokeStyle = "rgba(0, 229, 255, 0.78)";
        ctx.beginPath(); ctx.arc(px, py, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#7cf6ff";
        ctx.font = "700 10px 'JetBrains Mono', monospace";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(cpMeta.no, px, py + 0.5);
        ctx.restore();
      }
    }

    // 3) Draw primary highlighted component: hollow reticle halo + CAD leader + non-blocking glass pill
    if (st.activePart && activeMeta) {
      const ae = entries.find((x) => x.id === st.activePart);
      if (ae) {
        const cx = THREE.MathUtils.clamp(ae.cp.x, 40, W - 40);
        const cy = THREE.MathUtils.clamp(ae.cp.y, 88, H - 150);
        const axRaw = ae.ap.x + (ae.ap.x >= ae.cp.x ? 26 : -26);
        const ax = THREE.MathUtils.clamp(axRaw, 50, W - 260);
        const ay = THREE.MathUtils.clamp(ae.ap.y, 94, H - 156);
        const elbowX = ax + (ax >= cx ? -16 : 16);

        ctx.save();
        // Hollow double reticle halo over mesh center (never fills over geometry!)
        const pulse = 20 + Math.sin(st.t * 4.5) * 3;
        ctx.strokeStyle = "rgba(220, 255, 112, 0.72)";
        ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.arc(cx, cy, pulse, 0, Math.PI * 2); ctx.stroke();

        ctx.strokeStyle = "rgba(0, 229, 255, 0.52)";
        ctx.lineWidth = 1.1;
        ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.arc(cx, cy, pulse + 8, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);

        // Center dot + L-leader
        ctx.fillStyle = "#dcff70";
        ctx.beginPath(); ctx.arc(cx, cy, 3.2, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(220, 255, 112, 0.86)";
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(elbowX, ay); ctx.lineTo(ax, ay); ctx.stroke();

        // Compact frosted pill anchored at radial outer edge (non-blocking)
        const tagTxt = `${activeMeta.name}`;
        ctx.font = "700 12px 'Plus Jakarta Sans', sans-serif";
        const tw = Math.min(220, ctx.measureText(tagTxt).width);
        const pw = tw + 46, ph = 28;
        const bx = ax >= cx ? ax : ax - pw;
        const clampedBx = THREE.MathUtils.clamp(bx, 32, W - pw - 32);
        const by = ay - ph / 2;

        roundRectPath(ctx, clampedBx, by, pw, ph, 14);
        ctx.fillStyle = "rgba(4, 18, 15, 0.78)";
        ctx.fill();
        ctx.strokeStyle = "rgba(220, 255, 112, 0.85)";
        ctx.lineWidth = 1.4;
        ctx.stroke();

        // Bright lime number badge
        ctx.fillStyle = "#dcff70";
        ctx.beginPath(); ctx.arc(clampedBx + 15, ay, 9.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#03120e";
        ctx.font = "800 10px 'JetBrains Mono', monospace";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(activeMeta.no, clampedBx + 15, ay + 0.5);

        // Component title inside pill
        ctx.fillStyle = "#f2fff9";
        ctx.font = "700 12px 'Plus Jakarta Sans', sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(tagTxt, clampedBx + 30, ay + 0.5, tw + 6);
        ctx.restore();
      }
    }

    // Subtle outer border frame
    ctx.strokeStyle = "rgba(45, 245, 166, 0.32)";
    ctx.lineWidth = 2;
    ctx.strokeRect(18, 18, W - 36, H - 36);

    // Top-left header card
    roundRectPath(ctx, 32, 30, 445, 46, 10);
    ctx.fillStyle = "rgba(3, 10, 9, 0.80)";
    ctx.fill();
    ctx.strokeStyle = "rgba(45, 245, 166, 0.45)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = "#dcff70";
    ctx.font = "700 12.5px 'JetBrains Mono', monospace";
    const hdrLabel = rec.getLabel ? rec.getLabel("hdr") : `SYLVARIS // 72S HARDWARE STORY · CH ${String(st.chapIdx + 1).padStart(2, "0")}/12`;
    ctx.fillText(`${hdrLabel} · CH ${String(st.chapIdx + 1).padStart(2, "0")}/${TOUR_CHAPTERS.length}`, 46, 49);
    ctx.fillStyle = "#2df5a6";
    ctx.font = "500 11px 'JetBrains Mono', monospace";
    ctx.fillText(`${st.chap.state}  ·  ${st.chap.mA}  ·  EXPLODE ${Math.round(st.exp * 100)}%`, 46, 65);

    // Top-right mini oscilloscope + timer box
    roundRectPath(ctx, W - 318, 30, 286, 46, 10);
    ctx.fillStyle = "rgba(3, 10, 9, 0.80)";
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 229, 255, 0.42)";
    ctx.stroke();
    drawMiniScopeRec(ctx, W - 304, 37, 134, 32, st.t / TOUR_DURATION, st.chap.rate);
    const timerTxt = `${st.t.toFixed(1).padStart(4, "0")}s / ${TOUR_DURATION}.0s`;
    ctx.fillStyle = "#00e5ff";
    ctx.font = "700 13.5px 'JetBrains Mono', monospace";
    ctx.fillText(timerTxt, W - 156, 52);
    ctx.fillStyle = "rgba(210,255,236,0.68)";
    ctx.font = "500 9.5px 'JetBrains Mono', monospace";
    ctx.fillText(`r=${st.chap.rate.toFixed(2)} cm/3h`, W - 156, 67);

    // Bottom frosted narrative + plain-language component role deck
    const cap = rec.getCaption ? rec.getCaption(st) : "";
    const roleHint = activeMeta ? (activeMeta.simple || activeMeta.role || "") : (rec.getLabel ? rec.getLabel("all_done") : "All 14 subsystems interlocked cleanly inside IP65 node.");
    roundRectPath(ctx, 32, H - 138, W - 64, 106, 14);
    ctx.fillStyle = "rgba(2, 9, 8, 0.86)";
    ctx.fill();
    ctx.strokeStyle = "rgba(220, 255, 112, 0.42)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Active component heading + layer badge
    ctx.fillStyle = "#dcff70";
    ctx.font = "700 12px 'JetBrains Mono', monospace";
    const allTag = rec.getLabel ? rec.getLabel("all_tag") : "SYLVARIS · ALL 14 SUBSYSTEMS";
    const heading = activeMeta ? `[${activeMeta.no}] ${activeMeta.name.toUpperCase()} — ${activeMeta.layer.toUpperCase()}` : allTag;
    ctx.fillText(heading, 50, H - 115);

    // Quick function line of the spotlighted component (max 1 line)
    if (roleHint) {
      ctx.fillStyle = "#7cf6ff";
      ctx.font = "600 12.5px 'Plus Jakarta Sans', sans-serif";
      const fnLbl = (rec.getLabel ? rec.getLabel("fn_prefix") : "Fungsi:") + " " + roleHint;
      ctx.fillText(fnLbl.length > 125 ? fnLbl.slice(0, 122) + "..." : fnLbl, 50, H - 96, W - 102);
    }

    // Wrap beginner-friendly narrative cleanly into up to 2 lines
    ctx.fillStyle = "#e9fff6";
    ctx.font = "500 14.5px 'Plus Jakarta Sans', sans-serif";
    const words = cap.split(" "), maxW = W - 104;
    let line1 = "", line2 = "";
    for (const w of words) {
      const test = line1 ? line1 + " " + w : w;
      if (ctx.measureText(test).width <= maxW && !line2) line1 = test;
      else line2 = line2 ? line2 + " " + w : w;
    }
    ctx.fillText(line1, 50, H - 72);
    if (line2) ctx.fillText(line2, 50, H - 53, maxW);

    // 12-beat progress track inside bottom box
    ctx.fillStyle = "rgba(150, 255, 210, 0.16)";
    ctx.fillRect(50, H - 41, W - 100, 4);
    const gr = ctx.createLinearGradient(50, 0, W - 50, 0);
    gr.addColorStop(0, "#dcff70"); gr.addColorStop(0.5, "#2df5a6"); gr.addColorStop(1, "#00e5ff");
    ctx.fillStyle = gr;
    ctx.fillRect(50, H - 41, (W - 100) * (st.t / TOUR_DURATION), 4);
    // Chapter division ticks
    ctx.fillStyle = "rgba(2, 9, 8, 0.85)";
    for (let k = 1; k < TOUR_CHAPTERS.length; k++) {
      const txTick = 50 + (W - 100) * (TOUR_CHAPTERS[k].t0 / TOUR_DURATION);
      ctx.fillRect(txTick, H - 42, 2, 6);
    }
  }

  /* ---- loop ---- */
  const clock = new THREE.Clock();
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  let running = true, visible = true;
  const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: 0.01 });
  io.observe(container);

  function tick() {
    if (!running) return;
    requestAnimationFrame(tick);
    if (!visible && !tour.rec) return;
    const dt = Math.min(clock.getDelta(), 0.05), time = clock.elapsedTime;

    /* Tour choreography */
    let curTourSample = null;
    if (tour.active) {
      if (tour.playing) {
        tour.t += dt * tour.speed;
        if (tour.t >= TOUR_DURATION) {
          if (tour.loop && !tour.rec) {
            tour.t = 0; tour.lastPingCue = -1; tour.lastReadCue = -1;
          } else {
            tour.t = TOUR_DURATION;
            tour.playing = false;
            finishRecording();
          }
        }
      }
      curTourSample = sampleTour(tour.t);
      explodeTarget = curTourSample.exp;
      waterLevel = curTourSample.wat;

      if (mode !== curTourSample.wantMode) {
        mode = curTourSample.wantMode;
        applyMode();
      }
      if (curTourSample.activePart !== selected || curTourSample.companionPart !== companion) {
        selected = curTourSample.activePart;
        companion = curTourSample.companionPart || null;
        applyMode();
        listeners.select.forEach((fn) => fn(selected ? PARTS.find((p) => p.id === selected) : null));
      }
      if (tour.playing && !tour.userPausedOrbit) {
        controls.autoRotate = false;
        controls.target.set(curTourSample.tx, curTourSample.ty, curTourSample.tz);
        const r = curTourSample.dist * Math.sin(curTourSample.ph);
        camera.position.set(
          curTourSample.tx + r * Math.sin(curTourSample.th),
          curTourSample.ty + curTourSample.dist * Math.cos(curTourSample.ph),
          curTourSample.tz + r * Math.cos(curTourSample.th)
        );
      }

      // Cue telemetry flashes & LoRa RF waves across 72s story beats
      if (tour.playing) {
        const readCues = [37.8, 41.2, 44.8, 48.0, 69.5];
        readCues.forEach((rc, idx) => {
          if (tour.t >= rc && tour.lastReadCue < idx) {
            tour.lastReadCue = idx;
            ledColor.setHex(COLORS.emerald); ledFlash = 1; sensorFlash = 1;
          }
        });
        const pingCues = [51.2, 54.0, 57.5, 59.8];
        pingCues.forEach((pc, idx) => {
          if (tour.t >= pc && tour.lastPingCue < idx) {
            tour.lastPingCue = idx;
            ping(COLORS.violet);
            ledColor.setHex(COLORS.cyan); ledFlash = 1;
          }
        });
        if (tour.t < 0.2) { tour.lastPingCue = -1; tour.lastReadCue = -1; }
      }

      listeners.tour.forEach((fn) => fn({
        active: tour.active,
        playing: tour.playing,
        t: tour.t,
        duration: TOUR_DURATION,
        chapterIdx: curTourSample.chapIdx,
        chapter: curTourSample.chap,
        activePart: curTourSample.activePart,
        companionPart: curTourSample.companionPart,
        waterPct: Math.round(waterLevel * 100),
        explodePct: Math.round(curTourSample.exp * 100),
      }));
    }

    explode += (explodeTarget - explode) * Math.min(1, dt * 6);
    const e = ease(THREE.MathUtils.clamp(explode, 0, 1));
    for (const p of PARTS) {
      const pr = parts[p.id]; if (!pr) continue;
      const [x, y, z] = p.explode;
      pr.group.position.set(pr.base.x + x * e * 1.4, pr.base.y + y * e * 1.4, pr.base.z + z * e * 1.4);
    }

    // water
    const wy = -1.18 + THREE.MathUtils.lerp(0.12, 1.02, waterLevel);
    water.scale.y += ((wy + 1.18) - water.scale.y) * Math.min(1, dt * 3);
    waterTop.position.y = -1.18 + water.scale.y + 0.001;
    const pos = waterTop.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      pos.setZ(i, Math.sin(x * 4 + time * 1.6) * 0.008 + Math.cos(y * 5 + time * 1.2) * 0.006);
    }
    pos.needsUpdate = true;
    probe.rotation.z = Math.sin(time * 0.8) * 0.02;

    // led + sensor flash
    ledFlash = Math.max(0, ledFlash - dt * 2.2);
    M.led.emissive.copy(ledColor); M.led.color.copy(ledColor);
    M.led.emissiveIntensity = 0.4 + ledFlash * 5 + Math.sin(time * 3) * 0.1;
    sensorFlash = Math.max(0, sensorFlash - dt * 2);
    probeRing.material.emissiveIntensity = 0.4 + sensorFlash * 4;
    mcuLed.material.emissiveIntensity = 0.6 + (Math.sin(time * 9) > 0.7 ? 2 : 0) + ledFlash * 3;

    // rings
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]; r.userData.t += dt * 0.9;
      const t = r.userData.t;
      if (t < 0) { r.visible = false; continue; }
      r.visible = true;
      const tip = new THREE.Vector3(); antTip.getWorldPosition(tip); r.position.copy(tip);
      r.scale.setScalar(1 + t * 9); r.material.opacity = Math.max(0, 0.85 * (1 - t));
      if (t >= 1) { scene.remove(r); r.geometry.dispose(); r.material.dispose(); rings.splice(i, 1); }
    }

    // labels follow radially offset anchors + thin leader lines
    const focusAny = !!(selected || hovered || tour.active);
    labelRenderer.domElement.classList.toggle("has-focus", focusAny);
    const fanScale = 1 - e * 0.42;
    for (const l of labelObjs) {
      partCenter(l.id, ctr);
      anchorCtr.copy(ctr).addScaledVector(l.pin, fanScale);
      const show = o.labels && (explode > 0.14 || l.id === selected || l.id === hovered || tour.active);
      if (l.obj && l.el) {
        l.obj.position.copy(anchorCtr);
        l.el.classList.toggle("is-visible", show);
      }
      const isHot = l.id === selected || l.id === hovered || l.id === companion;
      l.line.visible = show && (!focusAny || isHot);
      if (l.line.visible) {
        const attr = l.line.geometry.attributes.position;
        attr.setXYZ(0, ctr.x, ctr.y, ctr.z);
        attr.setXYZ(1, anchorCtr.x, anchorCtr.y, anchorCtr.z);
        attr.needsUpdate = true;
        l.lMat.color.setHex(l.id === selected || l.id === hovered ? COLORS.lime : l.id === companion ? COLORS.cyan : COLORS.emerald);
        l.lMat.opacity = l.id === selected || l.id === hovered ? 0.88 : l.id === companion ? 0.56 : 0.24;
      }
    }

    // camera tween
    if (camTween.active && !tour.playing) {
      camTween.t = Math.min(1, camTween.t + dt * 1.4);
      const k = ease(camTween.t);
      camera.position.lerpVectors(camTween.fromPos, camTween.toPos, k);
      controls.target.lerpVectors(camTween.fromT, camTween.toT, k);
      if (camTween.t >= 1) camTween.active = false;
    }

    controls.update();
    if (composer) composer.render(); else renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
    if (tour.rec && curTourSample) paintRecordOverlay(curTourSample);
  }
  tick();

  /* ---- tour control helpers ---- */
  function startTour(fromSec = null) {
    if (!tour.active) tour.preTourMode = mode;
    if (fromSec !== null) tour.t = THREE.MathUtils.clamp(fromSec, 0, TOUR_DURATION);
    else if (tour.t >= TOUR_DURATION - 0.1) tour.t = 0;
    tour.active = true;
    tour.playing = true;
    tour.userPausedOrbit = false;
    tour.lastPingCue = -1;
    tour.lastReadCue = -1;
    o.labels = true;
  }
  function pauseTour() {
    tour.playing = false;
    listeners.tour.forEach((fn) => fn({ active: tour.active, playing: false, t: tour.t, duration: TOUR_DURATION, chapterIdx: Math.max(0, TOUR_CHAPTERS.findIndex((c) => tour.t >= c.t0 && tour.t <= c.t1)) }));
  }
  function seekTour(sec) {
    tour.active = true;
    tour.t = THREE.MathUtils.clamp(sec, 0, TOUR_DURATION);
    tour.userPausedOrbit = false;
    tour.lastPingCue = -1;
    tour.lastReadCue = -1;
    const st = sampleTour(tour.t);
    explodeTarget = st.exp; explode = st.exp;
    waterLevel = st.wat;
    mode = st.wantMode; selected = st.activePart; companion = st.companionPart || null; applyMode();
    controls.target.set(st.tx, st.ty, st.tz);
    const r = st.dist * Math.sin(st.ph);
    camera.position.set(st.tx + r * Math.sin(st.th), st.ty + st.dist * Math.cos(st.ph), st.tz + r * Math.cos(st.th));
    listeners.tour.forEach((fn) => fn({ active: true, playing: tour.playing, t: tour.t, duration: TOUR_DURATION, chapterIdx: st.chapIdx, chapter: st.chap, activePart: st.activePart, companionPart: st.companionPart }));
  }
  function stopTour() {
    finishRecording();
    tour.playing = false;
    tour.active = false;
    tour.t = 0;
    mode = tour.preTourMode || "solid";
    selected = null;
    companion = null;
    applyMode();
    controls.autoRotate = o.autoRotate;
    resetView();
    listeners.tour.forEach((fn) => fn({ active: false, playing: false, t: 0, duration: TOUR_DURATION, chapterIdx: 0 }));
  }

  function recordTour({ getCaption, getPartMeta, getLabel, onComplete, onState } = {}) {
    if (typeof MediaRecorder === "undefined") {
      return Promise.reject(new Error("MediaRecorder is not supported in this browser."));
    }
    const w = 1280, h = 720;
    const off = document.createElement("canvas");
    off.width = w; off.height = h;
    const ctx = off.getContext("2d");
    const stream = off.captureStream(30);
    const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m)) || "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_500_000 });
    const chunks = [];
    return new Promise((resolve, reject) => {
      recorder.ondataavailable = (ev) => { if (ev.data && ev.data.size > 0) chunks.push(ev.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mime });
        if (onState) onState("done");
        if (onComplete) onComplete(blob);
        resolve(blob);
      };
      recorder.onerror = (err) => { tour.rec = null; if (onState) onState("error"); reject(err); };
      tour.rec = { canvas: off, ctx, w, h, recorder, getCaption, getPartMeta, getLabel };
      tour.loop = false;
      tour.speed = 1;
      startTour(0);
      if (onState) onState("recording");
      recorder.start(250);
    });
  }

  /* ---- public api ---- */
  return {
    parts: PARTS,
    chapters: TOUR_CHAPTERS,
    tourDuration: TOUR_DURATION,
    setExplode(v) { explodeTarget = THREE.MathUtils.clamp(v, 0, 1); },
    getExplode() { return explodeTarget; },
    setAutoRotate(b) { controls.autoRotate = b; },
    setMode(m) { mode = m; applyMode(); },
    setBloom(b) { if (bloomPass) bloomPass.enabled = b; },
    setLabels(b) { o.labels = b; },
    refreshLabels(list) {
      const map = Object.fromEntries((list || PARTS).map((p) => [p.id, p]));
      for (const l of labelObjs) {
        const p = map[l.id];
        if (p && l.el) { const em = l.el.querySelector("em"); if (em) em.textContent = p.name; }
      }
    },
    select, focusPart, resetView, setView,
    setWaterLevel(v) { waterLevel = THREE.MathUtils.clamp(v, 0, 1); },
    read(ok = true, transmit = true) {
      ledColor.setHex(ok ? COLORS.emerald : COLORS.rose); ledFlash = 1; sensorFlash = 1;
      if (transmit) ping(ok ? COLORS.violet : COLORS.rose);
    },
    ping,
    playTour: startTour,
    pauseTour,
    seekTour,
    stopTour,
    setTourSpeed(s) { tour.speed = s; },
    setTourLoop(b) { tour.loop = b; },
    recordTour,
    stopRecording: finishRecording,
    isTourPlaying: () => tour.playing,
    isTourActive: () => tour.active,
    onTour(fn) { listeners.tour.push(fn); },
    onSelect(fn) { listeners.select.push(fn); },
    dispose() { running = false; finishRecording(); ro.disconnect(); io.disconnect(); renderer.dispose(); container.innerHTML = ""; },
  };
}
