/* ==========================================================================
   SYLVARIS — Command Dashboard & 3D Digital Twin Controller (dashboard.html)
   ========================================================================== */
import { createNodeViewer, PARTS } from "./node3d.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const DATA = window.SYLVARIS_DATA;
const ENG = window.SylvarisEngine;
const CH = window.SylChart;
const I18N = window.SYL_I18N;

let twin = null;
let selectedPart = "mcu";
let currentSeries = null; // { id, group, start, values, sourceName, isPredictions }
let currentEval = null;
let chartApi = null;
let playTimer = null;
let playIdx = 0;

/* ---------------- Theme ---------------- */
function initTheme() {
  if (localStorage.getItem("syl-theme") === "light") document.documentElement.dataset.theme = "light";
  $("#themeBtn")?.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    if (next === "light") document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
    localStorage.setItem("syl-theme", next);
    recompute();
  });
}

function syncSlider(el) {
  const min = parseFloat(el.min || 0), max = parseFloat(el.max || 100), val = parseFloat(el.value);
  el.style.setProperty("--p", (((val - min) / (max - min || 1)) * 100).toFixed(1) + "%");
}
$$("input[type='range']").forEach((el) => { syncSlider(el); el.addEventListener("input", () => syncSlider(el)); });

/* ---------------- 3D Twin & Anatomy ---------------- */
function init3D() {
  const box = $("#dashViewport");
  if (!box) return;
  try {
    let labelsOn = true, autoRot = false;
    twin = createNodeViewer(box, { autoRotate: autoRot, bloom: true, labels: labelsOn });
    $("#d3dLoader")?.remove();
    twin.setExplode(0.25);

    twin.onSelect((p) => { if (p) selectPart(p.id, false); });

    $("#dExplode")?.addEventListener("input", (e) => {
      twin.setExplode(e.target.value / 100);
      $("#dExplodeV").textContent = e.target.value + "%";
    });
    $("#dModeSeg")?.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-mode]"); if (!b) return;
      $$("#dModeSeg button").forEach((x) => x.classList.toggle("is-on", x === b));
      twin.setMode(b.dataset.mode);
      $("#d3dStatus").textContent = `${b.dataset.mode.toUpperCase()} · ORBIT 360°`;
    });
    $$("[data-dcam]").forEach((b) => b.addEventListener("click", () => twin.setView(b.dataset.dcam)));
    $("#dLabelsBtn")?.addEventListener("click", (e) => {
      labelsOn = !labelsOn; twin.setLabels(labelsOn); e.currentTarget.classList.toggle("is-on", labelsOn);
    });
    $("#dRotateBtn")?.addEventListener("click", (e) => {
      autoRot = !autoRot; twin.setAutoRotate(autoRot); e.currentTarget.classList.toggle("is-on", autoRot);
    });
    $("#dPingBtn")?.addEventListener("click", () => twin.read(true, true));
    $("#dCamResetBtn")?.addEventListener("click", () => {
      if (twin.isTourActive()) twin.stopTour();
      twin.resetView(); twin.setExplode(0.25);
      const sl = $("#dExplode"); if (sl) { sl.value = 25; syncSlider(sl); $("#dExplodeV").textContent = "25%"; }
    });
    $("#dTourBtn")?.addEventListener("click", () => {
      if (twin.isTourPlaying()) twin.pauseTour();
      else twin.playTour();
    });
    $("#dTourExpBtn")?.addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      if (btn.disabled) return;
      btn.disabled = true; btn.textContent = "⏳ 72s...";
      try {
        const blob = await twin.recordTour({
          getCaption: (st) => (I18N.tourScript()[st.chapIdx] || I18N.tourScript()[0]).caption,
          getPartMeta: (id) => localizedParts().find((p) => p.id === id) || null,
          getLabel: (k) => I18N.t(`tour.rec_${k}`),
        });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `SYLVARIS_Dashboard_3D_72s_${I18N.lang.toUpperCase()}.webm`;
        a.click();
      } catch (err) {
        alert(I18N.t("tour.export_fail") + err.message);
      } finally {
        btn.disabled = false; btn.textContent = "⬇ .webm";
      }
    });
    twin.onTour((st) => {
      const btn = $("#dTourBtn");
      if (btn) btn.innerHTML = st.playing ? `❚❚ <span>${I18N.t("dash.pause")}</span>` : `▶ <span>${I18N.t("tour.hero_btn")}</span>`;
      const sub = $("#dashTourSub");
      if (sub) {
        sub.classList.toggle("is-on", st.active);
        if (st.active) {
          const sc = I18N.tourScript()[st.chapterIdx] || I18N.tourScript()[0];
          sub.querySelector("b").textContent = `${sc.title}  ·  ${st.t.toFixed(1)}s / ${st.duration}s`;
          sub.querySelector("span").textContent = sc.caption;
        }
      }
      const sl = $("#dExplode");
      if (sl && st.active && st.explodePct !== undefined) {
        sl.value = st.explodePct; syncSlider(sl); $("#dExplodeV").textContent = st.explodePct + "%";
      }
    });
  } catch (err) {
    console.warn("Dashboard 3D init failed:", err);
    $("#d3dLoader").textContent = "WebGL unavailable";
  }
}

function localizedParts() { return I18N.getParts(PARTS); }

function selectPart(id, focusIn3D = true) {
  selectedPart = id;
  const parts = localizedParts();
  const p = parts.find((x) => x.id === id) || parts[0];
  $$("#dAnatList .part-pill").forEach((b) => b.classList.toggle("is-on", b.dataset.id === id));
  $("#dpNo").textContent = p.no;
  $("#dpLayer").textContent = p.layer;
  $("#dpStatus").textContent = p.status;
  $("#dpPrice").textContent = p.price;
  $("#dpName").textContent = p.name;
  $("#dpSpec").textContent = p.spec;
  $("#dpRole").textContent = p.role;
  $("#d3dPartTag").textContent = `[${p.no}] ${p.name.toUpperCase()}`;
  if (focusIn3D && twin) twin.select(id, true);
}

function renderAnatomy() {
  const parts = localizedParts();
  const list = $("#dAnatList");
  if (!list) return;
  list.innerHTML = parts.map((p) => `
    <button type="button" class="part-pill${p.id === selectedPart ? " is-on" : ""}" data-id="${p.id}">
      <span class="no">${p.no}</span>
      <div><b>${p.name}</b><small>${p.layer} · ${p.price}</small></div>
    </button>
  `).join("");
  $$("#dAnatList .part-pill").forEach((b) => b.addEventListener("click", () => selectPart(b.dataset.id, true)));
  selectPart(selectedPart, false);
  if (twin) twin.refreshLabels(parts);
}

/* ---------------- Data Selection & CSV Upload ---------------- */
function initSiteSelect(preserveVal = false) {
  const sel = $("#dSite");
  if (!sel || !DATA) return;
  const cur = preserveVal && sel.value ? sel.value : "AA1";
  const grpLbl = { blocked: I18N.t("s4.grp_blocked"), drained: I18N.t("s4.grp_drained"), forested: I18N.t("s4.grp_forested") };
  sel.innerHTML = DATA.loggers.map((l) => `<option value="${l.id}">${l.id} (${grpLbl[l.group] || l.group} · ${l.values.length - l.cut} ${I18N.t("s4.tail_word")})</option>`).join("");
  sel.value = cur;
  if (!preserveVal) loadOfficial(cur);
}

function loadOfficial(id) {
  const lg = DATA.loggers.find((l) => l.id === id);
  if (!lg) return;
  const isEn = I18N.lang === "en";
  const t0 = new Date(lg.start).getTime() + lg.cut * 3 * 3600 * 1000;
  currentSeries = {
    id: lg.id,
    group: lg.group,
    startMs: t0,
    values: ENG.testSlice(lg),
    sourceName: `${isEn ? "Leeds Official" : "Leeds Resmi"} (${lg.group}_${lg.id})`,
    isPredictions: false,
  };
  $("#srcKindTag").textContent = I18N.t("dash.src_leeds");
  $("#dCsvStatus").textContent = `${isEn ? "Active" : "Aktif"}: ${lg.group}_${lg.id} · ${currentSeries.values.length} slot (${I18N.t("s4.tail_word")})`;
  resetPlayback();
  recompute();
}

function handleCsvUpload(text, fileName) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 3) return;
  const hdr = lines.shift().split(",").map((c) => c.trim());
  const isEn = I18N.lang === "en";

  // 1) Support test_predictions.csv from original sylvaris/run_experiment.py
  const yi = hdr.indexOf("actual_next_day_depth_cm");
  const pi = hdr.indexOf("persistence_prediction_cm");
  if (yi >= 0 && pi >= 0) {
    const vals = lines.map((l) => Number(l.split(",")[yi])).filter(Number.isFinite);
    currentSeries = {
      id: "CSV",
      group: "drained",
      startMs: Date.now() - vals.length * 3 * 3600 * 1000,
      values: vals,
      sourceName: fileName,
      isPredictions: true,
    };
    $("#srcKindTag").textContent = isEn ? "USER CSV (EXP)" : "CSV PENGGUNA (EXP)";
    $("#dCsvStatus").textContent = isEn
      ? `Imported ${fileName} (${vals.length} rows)`
      : `Diimpor ${fileName} (${vals.length} baris)`;
    resetPlayback();
    recompute();
    return;
  }

  // 2) Support raw University of Leeds logger CSV (date, absolute water-level (cm))
  const di = hdr.indexOf("date");
  const vi = hdr.findIndex((h) => h.toLowerCase().includes("water-level") || h.toLowerCase().includes("value"));
  if (di >= 0 && vi >= 0) {
    const vals = lines.map((l) => {
      const cell = (l.split(",")[vi] || "").trim();
      const n = Number(cell);
      return cell === "-" || cell === "" || !Number.isFinite(n) ? null : n;
    });
    currentSeries = {
      id: "CSV",
      group: "blocked",
      startMs: Date.now() - vals.length * 3 * 3600 * 1000,
      values: vals.slice(Math.floor(vals.length * 0.7)),
      sourceName: fileName,
      isPredictions: false,
    };
    $("#srcKindTag").textContent = isEn ? "USER CSV (TAIL 30%)" : "CSV PENGGUNA (EKOR 30%)";
    $("#dCsvStatus").textContent = isEn
      ? `Imported ${fileName} (tail ${currentSeries.values.length} rows)`
      : `Diimpor ${fileName} (ekor ${currentSeries.values.length} baris)`;
    resetPlayback();
    recompute();
    return;
  }

  alert(
    isEn
      ? "CSV format not recognized. Use Leeds official CSV or test_predictions.csv."
      : "Format CSV tidak dikenali. Gunakan CSV resmi Leeds atau test_predictions.csv."
  );
}

/* ---------------- Policy Evaluation & Chart ---------------- */
function recompute() {
  if (!currentSeries) return;
  const isEn = I18N.lang === "en";
  const policy = $("#dPolicy").value;
  const v8Fast = parseFloat($("#dFast").value);
  const v8Medium = parseFloat($("#dMed").value);
  const v8Hold = parseInt($("#dHold").value, 10);
  const faultEvery = parseInt($("#dFault").value, 10);

  $("#dFastV").textContent = v8Fast.toFixed(1) + (isEn ? " cm/3h" : " cm/3j");
  $("#dMedV").textContent = v8Medium.toFixed(1) + (isEn ? " cm/3h" : " cm/3j");
  $("#dHoldV").textContent = String(v8Hold);
  $("#dFaultV").textContent = String(faultEvery);

  const vals = currentSeries.values;
  const ev = ENG.evaluate(vals, policy, currentSeries.group, { v8Fast, v8Medium, v8Hold, faultEvery });
  const ref6 = ENG.evaluate(vals, "Fixed_6h", currentSeries.group, { faultEvery });
  currentEval = { ev, ref6, policy };

  const rec = Number.isFinite(ev.recall) ? (ev.recall * 100).toFixed(1) + "%" : "—";
  const f1 = Number.isFinite(ev.f1) ? (ev.f1 * 100).toFixed(1) + "%" : "—";
  const del = Number.isFinite(ev.delay) ? ev.delay.toFixed(1) + (isEn ? "h" : "j") : "—";
  const save6 = 100 * (1 - ev.energy / ref6.energy);

  $("#dkRecall").textContent = `${rec} (${ev.TP}/${ev.events})`;
  $("#dkF1").textContent = `${f1} · ${del}`;
  $("#dkEnergy").textContent = `${ev.energy.toFixed(1)} mAh (${save6 >= 0 ? "+" : ""}${save6.toFixed(2)}%)`;
  $("#dkReads").textContent = `${ev.reads} · ${ev.fails} ${I18N.t("dash.fail_word")}`;
  $("#dChartMeta").textContent = `${currentSeries.sourceName} · ${vals.length} slots`;

  const marks = [];
  ev.trace.forEach((tr) => marks.push({ x: tr.i, kind: "read", fail: tr.fault }));
  ev.matches.forEach((m) => {
    marks.push({ x: m.ref / 3, kind: "ref" });
    if (m.alarm !== null) marks.push({ x: m.alarm / 3, kind: "alarm", matched: true, y: vals[m.alarm / 3] });
    else marks.push({ x: m.ref / 3, kind: "miss" });
  });

  chartApi = CH.lineChart($("#dashChart"), {
    series: [{ name: currentSeries.id + (isEn ? " water level" : " muka air"), values: vals, color: "#22d3ee", width: 1.9, area: true }],
    marks,
    yUnit: " cm",
    height: 270,
    xLabel: (i) => {
      const d = new Date(currentSeries.startMs + i * 3 * 3600 * 1000);
      return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    },
  });

  $("#playScrub").max = Math.max(0, vals.length - 1);
  renderLogUpTo(playIdx);
}

/* ---------------- Playback & 3D Synchronization ---------------- */
function stepTo(idx, fromTimer = false) {
  if (!currentSeries || !currentEval) return;
  const vals = currentSeries.values;
  playIdx = Math.max(0, Math.min(vals.length - 1, idx));
  $("#playScrub").value = playIdx;
  syncSlider($("#playScrub"));
  $("#playSlotInfo").textContent = `SLOT ${playIdx} / ${vals.length - 1}`;

  const val = vals[playIdx];
  if (chartApi) chartApi.setHead(playIdx, val);

  // normalize water level across series range -> 0.1..0.95 for 3D well animation
  const nums = vals.filter((v) => v !== null);
  const lo = Math.min(...nums), hi = Math.max(...nums);
  if (val !== null && twin) {
    const norm = (val - lo) / (hi - lo || 1);
    const pct = 0.1 + norm * 0.85;
    twin.setWaterLevel(pct);
    $("#d3dWaterTag").textContent = `${I18N.t("dash.water_lbl")}: ${val.toFixed(1)} cm (${Math.round(pct * 100)}%)`;
  }

  // check if a scheduled read occurs right on playIdx
  const tr = currentEval.ev.trace.find((x) => x.i === playIdx);
  if (tr && twin && fromTimer) {
    twin.read(tr.ok, tr.alarm || !tr.ok);
  }
  renderLogUpTo(playIdx);
}

function renderLogUpTo(idx) {
  const host = $("#dashLog");
  if (!host || !currentEval) return;
  const isEn = I18N.lang === "en";
  const rows = currentEval.ev.trace.filter((t) => t.i <= idx).slice(-14);
  if (!rows.length) {
    host.innerHTML = `<div class="mu">${I18N.t("dash.idle_log")}</div>`;
    return;
  }
  host.innerHTML = rows.map((r) => {
    const tStr = String(r.i * 3).padStart(4, "0") + (isEn ? "h" : "j");
    if (!r.ok) {
      return `<div class="er">[+${tStr}] ${isEn ? "READ FAIL" : "GAGAL BACA"} (${r.fault ? (isEn ? "INJECTED FAULT" : "ERROR BUATAN") : "NaN"}) → ${I18N.t("dash.retry_word")} ${r.slots * 3}${isEn ? "h" : "j"} (hold=2)</div>`;
    }
    const rStr = r.rate === null ? "init" : r.rate.toFixed(2) + (isEn ? " cm/3h" : " cm/3j");
    const cls = r.alarm ? "wa" : r.slots === 1 ? "cy" : "ok";
    return `<div class="${cls}">[+${tStr}] x=${r.value.toFixed(2)} cm | r=${rStr} → ${isEn ? "NEXT" : "JADWAL"}=${r.slots * 3}${isEn ? "h" : "j"}${r.alarm ? " ⚡ ALARM | LORA TX" : ""}</div>`;
  }).join("");
  host.scrollTop = host.scrollHeight;
}

function togglePlay() {
  if (playTimer) {
    clearInterval(playTimer); playTimer = null;
    $("#playBtn").innerHTML = `▶ <span data-i18n="dash.play">${I18N.t("dash.play")}</span>`;
    return;
  }
  const speed = parseInt($("#playSpeed").value, 10) || 80;
  $("#playBtn").innerHTML = `❚❚ <span data-i18n="dash.pause">${I18N.t("dash.pause")}</span>`;
  playTimer = setInterval(() => {
    if (!currentSeries) return;
    if (playIdx >= currentSeries.values.length - 1) { togglePlay(); return; }
    stepTo(playIdx + 1, true);
  }, speed);
}

function resetPlayback() {
  if (playTimer) togglePlay();
  stepTo(0, false);
}

/* ---------------- Parity Verification & Export ---------------- */
function verifyParity() {
  if (!DATA || !ENG) return;
  const v = ENG.verify(DATA);
  const txt = `${v.ok}/${v.checks} CSV PARITY ✓`;
  $("#dashVerifyHud").textContent = "ENGINE: " + txt;
  $("#dParityRow").textContent = txt;
}

function exportTrace() {
  if (!currentSeries || !currentEval) return;
  const blob = new Blob([JSON.stringify({
    source: currentSeries.sourceName,
    policy: currentEval.policy,
    metrics: {
      events: currentEval.ev.events,
      TP: currentEval.ev.TP, FP: currentEval.ev.FP, FN: currentEval.ev.FN,
      recall: currentEval.ev.recall, f1: currentEval.ev.f1,
      reads: currentEval.ev.reads, fails: currentEval.ev.fails,
      energy_mAh_sim: currentEval.ev.energy,
    },
    trace: currentEval.ev.trace,
  }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `sylvaris_${currentSeries.id}_${currentEval.policy}.json`;
  a.click();
}

/* ---------------- Events & Boot ---------------- */
document.addEventListener("syl-lang-change", () => {
  renderAnatomy();
  initSiteSelect(true);
  if (currentSeries && currentSeries.id && currentSeries.id !== "CSV") {
    const isEn = I18N.lang === "en";
    currentSeries.sourceName = `${isEn ? "Leeds Official" : "Leeds Resmi"} (${currentSeries.group}_${currentSeries.id})`;
    $("#srcKindTag").textContent = I18N.t("dash.src_leeds");
    $("#dCsvStatus").textContent = `${isEn ? "Active" : "Aktif"}: ${currentSeries.group}_${currentSeries.id} · ${currentSeries.values.length} slot (${I18N.t("s4.tail_word")})`;
  }
  const tBtn = $("#dTourBtn");
  if (tBtn && twin) tBtn.innerHTML = twin.isTourPlaying() ? `❚❚ <span>${I18N.t("dash.pause")}</span>` : `▶ <span>${I18N.t("tour.hero_btn")}</span>`;
  recompute();
  stepTo(playIdx, false);
});

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  I18N.init();
  init3D();
  renderAnatomy();
  initSiteSelect();
  verifyParity();

  $("#dSite")?.addEventListener("change", (e) => loadOfficial(e.target.value));
  $("#dCsvInput")?.addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    if (f) handleCsvUpload(await f.text(), f.name);
  });
  ["#dPolicy"].forEach((s) => $(s)?.addEventListener("change", recompute));
  ["#dFast", "#dMed", "#dHold", "#dFault"].forEach((s) => $(s)?.addEventListener("input", recompute));
  $("#playBtn")?.addEventListener("click", togglePlay);
  $("#playResetBtn")?.addEventListener("click", resetPlayback);
  $("#playSpeed")?.addEventListener("change", () => { if (playTimer) { togglePlay(); togglePlay(); } });
  $("#playScrub")?.addEventListener("input", (e) => stepTo(parseInt(e.target.value, 10), false));
  $("#exportBtn")?.addEventListener("click", exportTrace);
});
