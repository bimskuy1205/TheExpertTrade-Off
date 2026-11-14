/* ==========================================================================
   SYLVARIS — Main Landing & Technical Interactive Controller (index.html)
   Wires 3D viewers, Dilemma Sim, 5-Layer Stack, 14-Part Anatomy,
   V8 Scheduler Flowchart, V4 Audit, 9-Logger Cards, Pareto + Live Engine Lab,
   BOM Calculator, Failure Flip Cards, Gates, Claims, Team & RACI, Bilingual.
   ========================================================================== */
import { createNodeViewer, PARTS } from "./node3d.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const DATA = window.SYLVARIS_DATA;
const ENG = window.SylvarisEngine;
const CH = window.SylChart;
const I18N = window.SYL_I18N;

/* ---------------- Theme & Motion Toggles ---------------- */
function initPreferences() {
  const savedTheme = localStorage.getItem("syl-theme");
  if (savedTheme === "light") document.documentElement.dataset.theme = "light";

  $("#themeBtn")?.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    if (next === "light") document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
    localStorage.setItem("syl-theme", next);
    renderPareto();
    runLab();
    renderBOM();
  });

  const mBtn = $("#motionBtn");
  mBtn?.addEventListener("click", () => {
    const on = document.documentElement.classList.toggle("no-motion");
    mBtn.classList.toggle("is-on", on);
  });
}

/* ---------------- Range slider track fill helper ---------------- */
function syncSlider(el) {
  const min = parseFloat(el.min || 0), max = parseFloat(el.max || 100), val = parseFloat(el.value);
  el.style.setProperty("--p", (((val - min) / (max - min || 1)) * 100).toFixed(1) + "%");
}
$$("input[type='range']").forEach((el) => {
  syncSlider(el);
  el.addEventListener("input", () => syncSlider(el));
});

/* ---------------- 3D Viewers (Hero + Anatomy Lab + 72s Cinema Tour) ---------------- */
let hero3D = null, anat3D = null;
let selectedPartId = "mcu";

function drawScope(canvas, tNorm, rate, stateTxt) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  // subtle grid
  ctx.strokeStyle = "rgba(45, 245, 166, 0.12)";
  ctx.lineWidth = 1;
  for (let gx = 0; gx <= 6; gx++) {
    const x = (W * gx) / 6;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();

  // deterministic drawdown + recovery curve representing 0..72s scenario
  const xCurve = (u) => {
    const base = Math.sin(u * Math.PI * 5) * 0.08;
    const drop = u > 0.34 ? -0.58 * Math.exp(-Math.pow((u - 0.56) / 0.18, 2)) : 0;
    return 0.34 - base - drop;
  };
  const rCurve = (u) => {
    const bump = Math.exp(-Math.pow((u - 0.44) / 0.09, 2)) * 0.72 + Math.exp(-Math.pow((u - 0.62) / 0.08, 2)) * 0.85;
    return 0.86 - bump * 0.75 + Math.sin(u * 38) * 0.03 * bump;
  };

  // full ghost x(t) curve
  ctx.strokeStyle = "rgba(0, 229, 255, 0.25)";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  for (let i = 0; i <= 140; i++) {
    const u = i / 140, px = u * W, py = xCurve(u) * H;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // active traced r(t) velocity pulse up to playhead tNorm
  const maxIdx = Math.max(1, Math.round(tNorm * 140));
  ctx.strokeStyle = "#dcff70";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = 0; i <= maxIdx; i++) {
    const u = i / 140, px = u * W, py = rCurve(u) * H;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // active traced x(t) curve
  ctx.strokeStyle = "#00e5ff";
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  for (let i = 0; i <= maxIdx; i++) {
    const u = i / 140, px = u * W, py = xCurve(u) * H;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // glowing playhead dot
  const hx = tNorm * W, hy = xCurve(tNorm) * H;
  ctx.strokeStyle = "rgba(220, 255, 112, 0.45)";
  ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(hx, 0); ctx.lineTo(hx, H); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = rate >= 2 ? "#ffb547" : "#2df5a6";
  ctx.beginPath(); ctx.arc(hx, hy, 4, 0, Math.PI * 2); ctx.fill();
}

function renderCineChapters() {
  const host = $("#cineChapters");
  if (!host || !I18N.tourScript) return;
  const scripts = I18N.tourScript();
  const chapters = (anat3D && anat3D.chapters) || [0, 6, 12, 18, 24, 30.5, 36.5, 43, 50, 56.5, 62, 67.5].map((t0) => ({ t0 }));
  host.innerHTML = scripts.map((s, idx) => `
    <button type="button" class="cine-chap${idx === 0 ? " is-on" : ""}" data-chap="${idx}" data-t="${chapters[idx]?.t0 ?? idx * 6}">
      <span>CH ${s.no}</span>
      <b>${s.label}</b>
    </button>
  `).join("");
  $$("#cineChapters .cine-chap").forEach((b) => {
    b.addEventListener("click", () => {
      if (!anat3D) return;
      const t0 = parseFloat(b.dataset.t || "0");
      anat3D.seekTour(t0);
      anat3D.playTour();
    });
  });
  const first = scripts[0];
  if (first && !anat3D?.isTourActive()) {
    const pt = $("#cinePhaseTitle"), pb = $("#cinePhaseBody"), tm = $("#cineTime");
    if (pt) pt.textContent = first.title;
    if (pb) pb.textContent = first.caption;
    if (tm) tm.textContent = `00.0s / ${anat3D?.tourDuration ?? 72}.0s`;
  }
}

function init3D() {
  const heroBox = $("#heroViewport");
  if (heroBox) {
    try {
      hero3D = createNodeViewer(heroBox, { autoRotate: true, bloom: true, labels: true });
      $("#heroLoader")?.remove();
      let labelsOn = true;
      $("#heroExplode")?.addEventListener("input", (e) => { hero3D.setExplode(e.target.value / 100); });
      $("#heroLabelsBtn")?.addEventListener("click", (e) => {
        labelsOn = !labelsOn; hero3D.setLabels(labelsOn); e.currentTarget.classList.toggle("is-on", labelsOn);
      });
      $("#heroPingBtn")?.addEventListener("click", () => hero3D.read(true, true));
      $("#heroResetBtn")?.addEventListener("click", () => {
        if (hero3D.isTourActive()) hero3D.stopTour();
        hero3D.resetView(); hero3D.setExplode(0);
        const sl = $("#heroExplode"); if (sl) { sl.value = 0; syncSlider(sl); }
      });
      $("#heroTourBtn")?.addEventListener("click", () => {
        if (hero3D.isTourPlaying()) hero3D.pauseTour();
        else hero3D.playTour();
      });
      hero3D.onTour((st) => {
        const btn = $("#heroTourBtn");
        if (btn) btn.innerHTML = st.playing ? `❚❚ <span>${I18N.t("dash.pause")}</span>` : `▶ <span>${I18N.t("tour.hero_btn")}</span>`;
        const sub = $("#heroTourSub");
        if (sub) {
          sub.classList.toggle("is-on", st.active);
          if (st.active) {
            const sc = I18N.tourScript()[st.chapterIdx] || I18N.tourScript()[0];
            sub.querySelector("b").textContent = `${sc.title}  ·  ${st.t.toFixed(1)}s / ${st.duration}s`;
            sub.querySelector("span").textContent = sc.caption;
          }
        }
        const sl = $("#heroExplode");
        if (sl && st.active && st.explodePct !== undefined) { sl.value = st.explodePct; syncSlider(sl); }
      });
      hero3D.onSelect((p) => {
        const tag = $("#heroPartTag");
        if (tag) tag.textContent = p ? `[${p.no}] ${p.name}` : "—";
      });
      heroBox.addEventListener("n3d-hover", (e) => {
        const hint = $("#heroPartHint");
        if (hint) hint.textContent = e.detail ? `${e.detail.no} · ${e.detail.name}` : I18N.t("hero.3d_br");
      });
    } catch (err) {
      console.warn("Hero 3D fallback:", err);
      $("#heroLoader").textContent = "WebGL unavailable";
    }
  }

  const anatBox = $("#anatViewport");
  if (anatBox) {
    try {
      anat3D = createNodeViewer(anatBox, { autoRotate: false, bloom: true, labels: true });
      $("#anatLoader")?.remove();
      anat3D.setExplode(0.35);
      anat3D.onSelect((p) => { if (p) selectPart(p.id, false); });

      let anatLabelsOn = true;
      $("#anatExplode")?.addEventListener("input", (e) => {
        anat3D.setExplode(e.target.value / 100);
        $("#anatExpPct").textContent = e.target.value + "%";
      });
      $("#anatWater")?.addEventListener("input", (e) => {
        anat3D.setWaterLevel(e.target.value / 100);
        $("#anatWatPct").textContent = e.target.value + "%";
      });
      $("#anatModeSeg")?.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-mode]"); if (!b) return;
        $$("#anatModeSeg button").forEach((x) => x.classList.toggle("is-on", x === b));
        anat3D.setMode(b.dataset.mode);
      });
      $$("[data-cam]").forEach((b) => b.addEventListener("click", () => anat3D.setView(b.dataset.cam)));
      $("#anatLabelsBtn")?.addEventListener("click", (e) => {
        anatLabelsOn = !anatLabelsOn; anat3D.setLabels(anatLabelsOn); e.currentTarget.classList.toggle("is-on", anatLabelsOn);
      });
      $("#anatPingBtn")?.addEventListener("click", () => anat3D.read(true, true));
      $("#anatResetBtn")?.addEventListener("click", () => {
        if (anat3D.isTourActive()) anat3D.stopTour();
        anat3D.resetView(); anat3D.setExplode(0.35);
        const s = $("#anatExplode"); if (s) { s.value = 35; syncSlider(s); $("#anatExpPct").textContent = "35%"; }
      });

      const toggleAnatTour = () => {
        if (anat3D.isTourPlaying()) anat3D.pauseTour();
        else anat3D.playTour();
      };
      $("#anatTourQuick")?.addEventListener("click", toggleAnatTour);
      $("#cinePlayBtn")?.addEventListener("click", toggleAnatTour);
      $("#cineStopBtn")?.addEventListener("click", () => anat3D.stopTour());
      $("#cineProgress")?.addEventListener("click", (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const k = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        anat3D.seekTour(k * anat3D.tourDuration);
      });
      $("#cineExportBtn")?.addEventListener("click", async (e) => {
        const btn = e.currentTarget;
        if (btn.disabled) return;
        btn.disabled = true;
        btn.innerHTML = `⏳ <span>${I18N.t("tour.exporting")}</span>`;
        try {
          const blob = await anat3D.recordTour({
            getCaption: (st) => (I18N.tourScript()[st.chapIdx] || I18N.tourScript()[0]).caption,
            getPartMeta: (id) => localizedParts().find((p) => p.id === id) || null,
            getLabel: (k) => I18N.t(`tour.rec_${k}`),
          });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = `SYLVARIS_3D_Simulation_72s_${I18N.lang.toUpperCase()}.webm`;
          a.click();
        } catch (err) {
          alert(I18N.t("tour.export_fail") + err.message);
        } finally {
          btn.disabled = false;
          btn.innerHTML = `⬇ <span>${I18N.t("tour.export")}</span>`;
        }
      });

      anat3D.onTour((st) => {
        const playHtml = st.playing ? `❚❚ <span>${I18N.t("tour.pause")}</span>` : `▶ <span>${I18N.t(st.active && st.t > 0.1 && st.t < st.duration - 0.1 ? "tour.resume" : "tour.play")}</span>`;
        const b1 = $("#cinePlayBtn"), b2 = $("#anatTourQuick");
        if (b1) b1.innerHTML = playHtml;
        if (b2) b2.innerHTML = playHtml;

        const sub = $("#anatTourSub");
        const sc = I18N.tourScript()[st.chapterIdx] || I18N.tourScript()[0];
        if (sub) {
          sub.classList.toggle("is-on", st.active);
          if (st.active) {
            sub.querySelector("b").textContent = `${sc.title}  ·  ${st.t.toFixed(1)}s / ${st.duration}s`;
            sub.querySelector("span").textContent = sc.caption;
          }
        }
        const pt = $("#cinePhaseTitle"), pb = $("#cinePhaseBody"), tm = $("#cineTime"), fl = $("#cineFill");
        if (pt) pt.textContent = sc.title;
        if (pb) pb.textContent = sc.caption;
        if (tm) tm.textContent = `${st.t.toFixed(1).padStart(4, "0")}s / ${st.duration}.0s`;
        if (fl) fl.style.width = ((st.t / st.duration) * 100).toFixed(2) + "%";
        $$("#cineChapters .cine-chap").forEach((c, i) => c.classList.toggle("is-on", i === st.chapterIdx));

        if (st.chapter) {
          const stTag = $("#cineStateTag"), scStat = $("#cineScopeStat");
          if (stTag) stTag.textContent = st.chapter.state;
          if (scStat) scStat.textContent = `${st.chapter.mA} · r=${st.chapter.rate.toFixed(2)} cm/3h`;
          drawScope($("#cineScope"), st.t / st.duration, st.chapter.rate, st.chapter.state);
        }
        if (st.active && st.explodePct !== undefined) {
          const se = $("#anatExplode"), sw = $("#anatWater");
          if (se) { se.value = st.explodePct; syncSlider(se); $("#anatExpPct").textContent = st.explodePct + "%"; }
          if (sw && st.waterPct !== undefined) { sw.value = st.waterPct; syncSlider(sw); $("#anatWatPct").textContent = st.waterPct + "%"; }
        }
      });

      drawScope($("#cineScope"), 0, 0.32, "READY");
    } catch (err) {
      console.warn("Anatomy 3D fallback:", err);
      $("#anatLoader").textContent = "WebGL unavailable";
    }
  }
}

function localizedParts() {
  return I18N.getParts(PARTS);
}

function selectPart(id, focusIn3D = true) {
  selectedPartId = id;
  const parts = localizedParts();
  const p = parts.find((x) => x.id === id) || parts[0];
  $$("#anatPills .part-pill").forEach((b) => b.classList.toggle("is-on", b.dataset.id === id));
  $("#pcNo").textContent = p.no;
  $("#pcLayer").textContent = p.layer;
  $("#pcStatus").textContent = p.status;
  $("#pcPrice").textContent = p.price;
  $("#pcName").textContent = p.name;
  $("#pcSpec").textContent = p.spec;
  $("#pcRole").textContent = p.role;
  if (focusIn3D && anat3D) anat3D.select(id, true);
}

function renderAnatomy() {
  const parts = localizedParts();
  const host = $("#anatPills");
  if (!host) return;
  host.innerHTML = parts.map((p) => `
    <button type="button" class="part-pill${p.id === selectedPartId ? " is-on" : ""}" data-id="${p.id}">
      <span class="no">${p.no}</span>
      <div><b>${p.name}</b><small>${p.layer} · ${p.price}</small></div>
    </button>
  `).join("");
  $$("#anatPills .part-pill").forEach((b) => b.addEventListener("click", () => selectPart(b.dataset.id, true)));
  selectPart(selectedPartId, false);
  if (hero3D) hero3D.refreshLabels(parts);
  if (anat3D) anat3D.refreshLabels(parts);
}

/* ---------------- Section 01: Sampling Dilemma Canvas ---------------- */
let dilPol = "Safety_V8";
function renderDilemma() {
  const canvas = $("#dilemmaCanvas");
  if (!canvas || !DATA) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const aa1 = DATA.loggers.find((l) => l.id === "AA1");
  const slice = ENG.testSlice(aa1).slice(0, 140); // first ~17.5 days of tail for clean legibility
  const ev = ENG.evaluate(slice, dilPol, aa1.group);

  $("#dilReadsVal").textContent = ev.reads;
  $("#dilReadsBar").style.width = Math.min(100, (ev.reads / slice.length) * 100) + "%";
  const rec = Number.isFinite(ev.recall) ? ev.recall * 100 : 0;
  $("#dilDetVal").textContent = `${ev.TP}/${ev.events} (${rec.toFixed(0)}%)`;
  $("#dilDetBar").style.width = rec + "%";
  $("#dilEngVal").textContent = ev.energy.toFixed(1) + " mAh";
  $("#dilEngBar").style.width = Math.min(100, (ev.energy / 90) * 100) + "%";

  const nums = slice.filter((v) => v !== null);
  const lo = Math.min(...nums) - 2, hi = Math.max(...nums) + 2;
  const padL = 22, padR = 14, padT = 18, padB = 22;
  const X = (i) => padL + ((W - padL - padR) * i) / Math.max(1, slice.length - 1);
  const Y = (v) => H - padB - ((H - padT - padB) * (v - lo)) / (hi - lo || 1);

  ctx.clearRect(0, 0, W, H);
  // subtle grid
  ctx.strokeStyle = "rgba(150,255,210,0.08)"; ctx.lineWidth = 1;
  for (let g = 0; g <= 4; g++) {
    const yy = padT + ((H - padT - padB) * g) / 4;
    ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(W - padR, yy); ctx.stroke();
  }
  // reference episodes vertical bands
  ev.refs.forEach((h) => {
    const idx = h / 3;
    ctx.fillStyle = "rgba(255,181,71,0.16)";
    ctx.fillRect(X(idx) - 4, padT, 12, H - padT - padB);
  });
  // underlying 3h ground-truth trace
  ctx.strokeStyle = "#22d3ee"; ctx.lineWidth = 1.6; ctx.beginPath();
  let pen = false;
  slice.forEach((v, i) => {
    if (v === null) { pen = false; return; }
    if (!pen) { ctx.moveTo(X(i), Y(v)); pen = true; } else ctx.lineTo(X(i), Y(v));
  });
  ctx.stroke();

  // scheduled wake-up ticks along bottom + dots on curve
  ev.trace.forEach((tr) => {
    const xx = X(tr.i);
    ctx.strokeStyle = tr.ok ? "rgba(45,245,166,0.55)" : "rgba(255,93,143,0.75)";
    ctx.beginPath(); ctx.moveTo(xx, H - padB); ctx.lineTo(xx, H - padB + 8); ctx.stroke();
    if (tr.ok) {
      ctx.fillStyle = tr.alarm ? "#ffb547" : "#d6ee79";
      ctx.beginPath(); ctx.arc(xx, Y(tr.value), tr.alarm ? 4.2 : 2.3, 0, Math.PI * 2); ctx.fill();
    }
  });
}

$("#dilemmaPolSeg")?.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-pol]"); if (!b) return;
  $$("#dilemmaPolSeg button").forEach((x) => x.classList.toggle("is-on", x === b));
  dilPol = b.dataset.pol;
  renderDilemma();
});

/* ---------------- Section 02: 5-Layer Architecture Stack ---------------- */
let activeArch = 0;
function renderArch() {
  const layers = I18N.arch();
  const stack = $("#archStack");
  if (!stack) return;
  stack.innerHTML = layers.map((l, idx) => `
    <div class="layer${idx === activeArch ? " is-on" : ""}" data-idx="${idx}" tabindex="0">
      <div class="num">${l.num}</div>
      <div><h4>${l.title}</h4><p>${l.sub}</p></div>
      <span class="tag ok">${l.num}</span>
      <span class="packet" style="animation-delay:${idx * 0.45}s"></span>
    </div>
  `).join("");
  $$("#archStack .layer").forEach((el) => {
    el.addEventListener("click", () => {
      activeArch = parseInt(el.dataset.idx, 10);
      renderArch();
      const firstPart = layers[activeArch].parts[0];
      if (firstPart) selectPart(firstPart, false);
    });
  });
  const cur = layers[activeArch];
  $("#adBadge").textContent = cur.badge;
  $("#adTitle").textContent = `${cur.num} · ${cur.title}`;
  $("#adDesc").textContent = cur.desc;
  $("#adBullets").innerHTML = cur.bullets.map((b) => `<li>${b}</li>`).join("");
  const pMap = Object.fromEntries(localizedParts().map((p) => [p.id, p]));
  $("#adParts").innerHTML = cur.parts.map((pid) => {
    const p = pMap[pid];
    return p ? `<button type="button" class="btn btn-ghost btn-sm" data-focus="${pid}">[${p.no}] ${p.name} ↗</button>` : "";
  }).join("");
  $$("#adParts [data-focus]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectPart(btn.dataset.focus, true);
      $("#anatomi")?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });
}

/* ---------------- Section 03: Safety V8 Scheduler Flowchart & V4 Audit ---------------- */
let scMiss = false;
function updateScheduler() {
  const dx = parseFloat($("#scDx").value);
  const dt = parseFloat($("#scDt").value);
  const hold = parseInt($("#scHold").value, 10);
  $("#scDxVal").textContent = dx.toFixed(1) + " cm";
  $("#scDtVal").textContent = dt + (I18N.lang === "en" ? " h" : " jam");
  $("#scHoldVal").textContent = String(hold);

  const rate = scMiss ? NaN : (dx * 3) / dt;
  $("#scRateOut").textContent = scMiss ? "NaN" : rate.toFixed(2);

  // reset flowchart highlights
  $$(".flow .node,.flow .edge").forEach((n) => n.classList.remove("on"));
  $$("#nStart,#e1,#nMiss").forEach((x) => x.classList.add("on"));

  let nextH = 9, nextHold = 0;
  if (scMiss) {
    nextH = 3; nextHold = 2;
    $$("#eMiss,#n3hR").forEach((x) => x.classList.add("on"));
  } else {
    $$("#eValid,#nFast").forEach((x) => x.classList.add("on"));
    if (rate >= 2.0 || hold > 0) {
      nextH = 3;
      nextHold = rate >= 2.0 ? 1 : hold - 1; // one slot consumed right now
      $$("#eFast,#n3hF").forEach((x) => x.classList.add("on"));
    } else {
      $$("#eHold,#nMed").forEach((x) => x.classList.add("on"));
      if (rate >= 0.8) {
        nextH = 6;
        $$("#eMed,#n6h").forEach((x) => x.classList.add("on"));
      } else {
        nextH = 9;
        $$("#eSlow,#n9h").forEach((x) => x.classList.add("on"));
      }
    }
  }
  $("#scNextOut").textContent = String(nextH);
  const alarmEl = $("#scAlarmOut");
  const isEn = I18N.lang === "en";
  if (scMiss) {
    alarmEl.innerHTML = `<span class="rose">${isEn ? "RETRY 3h · fast_hold ← 2" : "ULANGI 3 jam · fast_hold ← 2"}</span>`;
  } else if (dx >= 5.0) {
    alarmEl.innerHTML = `<span class="amber">⚡ ${isEn ? "CUMULATIVE ALARM TRIGGERED" : "ALARM KUMULATIF AKTIF"} (|Δx| = ${dx.toFixed(1)} ≥ 5.0 cm)</span>`;
  } else {
    alarmEl.innerHTML = `<span class="emerald">OK · ${isEn ? `Nominal interval ${nextH}h (next hold=${nextHold})` : `Jadwal normal ${nextH} jam (hold berikutnya=${nextHold})`}</span>`;
  }

  // 24h timeline bar (8 slots of 3h)
  const stepSlots = nextH / 3;
  const tl = $("#scTimeline");
  if (tl) {
    tl.innerHTML = Array.from({ length: 8 }, (_, k) => `<i class="${k % stepSlots === 0 ? "read" : ""}"></i>`).join("");
  }
}

["#scDx", "#scDt", "#scHold"].forEach((id) => $(id)?.addEventListener("input", updateScheduler));
$("#scMissSeg")?.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-miss]"); if (!b) return;
  $$("#scMissSeg button").forEach((x) => x.classList.toggle("is-on", x === b));
  scMiss = b.dataset.miss === "1";
  updateScheduler();
});

const V4_ROWS = [
  { site: "blocked_BB1 (1d)", model: "RF_Delta", calib: 14, mae: 2.57, pers: 2.97, imp: "+13.34%", cov: "100.0%", ok: true },
  { site: "blocked_BB1 (3d)", model: "RF_Direct", calib: 15, mae: 81.75, pers: 7.14, imp: "-1044.12%", cov: "50.0%", ok: false },
  { site: "blocked_BB1 (7d)", model: "RF_Direct", calib: 11, mae: 80.85, pers: 10.66, imp: "-658.63%", cov: "52.6%", ok: false },
  { site: "drained_AA1 (1d)", model: "Persistence", calib: 15, mae: 6.87, pers: 6.87, imp: "0.00%", cov: "86.4%", ok: false },
  { site: "drained_AA1 (3d)", model: "Persistence", calib: 13, mae: 15.70, pers: 15.70, imp: "0.00%", cov: "38.1%", ok: false },
  { site: "forested_AL0 (1d)", model: "RF_Delta", calib: 19, mae: 1.97, pers: 1.92, imp: "-2.33%", cov: "70.4%", ok: false },
  { site: "forested_AL0 (3d)", model: "Ridge_Delta", calib: 17, mae: 10.39, pers: 4.88, imp: "-112.77%", cov: "51.9%", ok: false },
  { site: "forested_AL0 (7d)", model: "Ridge_Direct", calib: 12, mae: 15.29, pers: 9.88, imp: "-54.68%", cov: "42.3%", ok: false },
];

function renderV4Table() {
  const tb = $("#v4Table tbody");
  if (!tb) return;
  tb.innerHTML = V4_ROWS.map((r) => `
    <tr>
      <td><b>${r.site}</b></td>
      <td class="mono">${r.model}</td>
      <td class="num">${r.calib}</td>
      <td class="num">${r.mae.toFixed(2)}</td>
      <td class="num">${r.pers.toFixed(2)}</td>
      <td class="num ${r.imp.startsWith("+") ? "emerald" : r.imp === "0.00%" ? "" : "rose"}">${r.imp}</td>
      <td class="num"><span class="tag ${r.ok ? "ok" : "bad"}">${r.cov}</span></td>
    </tr>
  `).join("");
}

/* ---------------- Section 04: 9-Logger Sparklines ---------------- */
let loggerGrp = "all";
function sparkSvg(vals, cut, color) {
  const W = 280, H = 54, nums = vals.filter((v) => v !== null);
  const lo = Math.min(...nums), hi = Math.max(...nums);
  const X = (i) => (W * i) / Math.max(1, vals.length - 1);
  const Y = (v) => H - 4 - ((H - 8) * (v - lo)) / (hi - lo || 1);
  let d = "", pen = false;
  for (let i = 0; i < vals.length; i += 2) {
    const v = vals[i];
    if (v === null) { pen = false; continue; }
    d += (pen ? "L" : "M") + X(i).toFixed(1) + "," + Y(v).toFixed(1); pen = true;
  }
  const cx = X(cut).toFixed(1);
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <rect x="${cx}" y="0" width="${W - cx}" height="${H}" fill="${color}" fill-opacity="0.1"/>
    <line x1="${cx}" x2="${cx}" y1="0" y2="${H}" stroke="${color}" stroke-dasharray="3 3" stroke-opacity="0.6"/>
    <path d="${d}" fill="none" stroke="${color}" stroke-width="1.6"/>
  </svg>`;
}

function renderLoggers() {
  const host = $("#loggerGrid");
  if (!host || !DATA) return;
  const col = { blocked: "#22d3ee", drained: "#ffb547", forested: "#2df5a6" };
  const grpLbl = { blocked: I18N.t("s4.grp_blocked"), drained: I18N.t("s4.grp_drained"), forested: I18N.t("s4.grp_forested") };
  const list = DATA.loggers.filter((l) => loggerGrp === "all" || l.group === loggerGrp);
  host.innerHTML = list.map((lg) => {
    const valid = lg.values.filter((v) => v !== null).length;
    const pct = ((valid / lg.values.length) * 100).toFixed(1);
    const nom = lg.official?.nominal?.Safety_V8;
    return `
      <article class="card spot logger group-${lg.group}">
        <header>
          <div><b>${lg.id}</b> <span class="mono" style="font-size:11px;color:var(--text-3)">${lg.start.slice(0, 10)}</span></div>
          <span class="gbadge">${grpLbl[lg.group] || lg.group}</span>
        </header>
        <div class="spark">${sparkSvg(lg.values, lg.cut, col[lg.group])}</div>
        <div class="meta">
          <span>${valid}/${lg.values.length} ${I18N.t("s4.slots_lbl")} (${pct}%)</span>
          <span>${nom ? nom.events + " " + I18N.t("s4.ep_lbl") : ""}</span>
        </div>
        <div class="cov"><i style="width:${pct}%"></i></div>
      </article>
    `;
  }).join("");
}

$("#loggerFilter")?.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-grp]"); if (!b) return;
  $$("#loggerFilter button").forEach((x) => x.classList.toggle("is-on", x === b));
  loggerGrp = b.dataset.grp;
  renderLoggers();
});

/* ---------------- Section 05: Pareto, Table I & Live JS Engine ---------------- */
let activeScen = "nominal";

function computeComparison(scen) {
  return DATA.loggers.map((lg) => {
    const o = lg.official[scen];
    const p3 = o.Fixed_3h, p6 = o.Fixed_6h, v6 = o.Adaptive_V6, v8 = o.Safety_V8;
    const save6 = 100 * (1 - v8.energy / p6.energy);
    const save3 = 100 * (1 - v8.energy / p3.energy);
    const rDelta = (v8.recall - p6.recall) * 100;
    return { id: lg.id, group: lg.group, events: v8.events, r6: p6.recall, rv6: v6.recall, rv8: v8.recall, save6, save3, rDelta, fails: v8.fails };
  });
}

function renderPareto() {
  const host = $("#paretoChart");
  if (!host || !DATA) return;
  const rows = computeComparison(activeScen);
  const col = { blocked: "#22d3ee", drained: "#ffb547", forested: "#2df5a6" };
  const grpLbl = { blocked: I18N.t("s4.grp_blocked"), drained: I18N.t("s4.grp_drained"), forested: I18N.t("s4.grp_forested") };
  const isEn = I18N.lang === "en";
  const pts = rows.map((r, i) => ({
    x: r.save6,
    y: r.rDelta,
    r: 6 + r.events * 1.1,
    dy: i % 2 ? 18 : -4,
    label: r.id,
    color: r.id === "BB3" ? "#ff5d8f" : col[r.group],
    html: `<em>${r.id} (${grpLbl[r.group] || r.group})</em><div>${isEn ? "Save vs 6h" : "Hemat vs 6j"}: <b>${r.save6.toFixed(2)}%</b></div><div>Recall Δ: <b>${r.rDelta >= 0 ? "+" : ""}${r.rDelta.toFixed(1)} pt</b> (n=${r.events})</div>`,
    id: r.id,
  }));
  CH.scatter(host, {
    points: pts,
    xDomain: [-0.8, 4.2],
    yDomain: [-50, 110],
    xUnit: "%",
    yUnit: " pt",
    zeroY: 0,
    xTitle: isEn ? "Modeled Energy Saving vs Fixed 6h (%)" : "Hemat Energi Simulasi vs Fixed 6h (%)",
    yTitle: isEn ? "V8 Recall Difference vs Fixed 6h (pt)" : "Selisih Recall V8 vs Fixed 6h (poin)",
    height: 340,
    onClick: (p) => {
      const sel = $("#labSite");
      if (sel) { sel.value = p.id; runLab(); $("#labChart")?.scrollIntoView({ behavior: "smooth", block: "center" }); }
    },
  });

  const tb = $("#v8Table tbody");
  if (tb) {
    tb.innerHTML = rows.map((r) => `
      <tr class="${r.id === "BB3" ? "is-hot" : ""}">
        <td><b>${r.id}</b> <span class="mono" style="font-size:10.5px;color:var(--text-3)">${grpLbl[r.group] || r.group}</span></td>
        <td class="num">${r.events}</td>
        <td class="num">${(r.r6 * 100).toFixed(0)}%</td>
        <td class="num">${(r.rv6 * 100).toFixed(0)}%</td>
        <td class="num ${r.rDelta < 0 ? "rose" : "emerald"}"><b>${(r.rv8 * 100).toFixed(0)}%</b></td>
        <td class="num ${r.save6 < 0 ? "rose" : "cyan"}">${r.save6 >= 0 ? "+" : ""}${r.save6.toFixed(2)}%</td>
      </tr>
    `).join("");
  }
}

$("#scenSeg")?.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-scen]"); if (!b) return;
  $$("#scenSeg button").forEach((x) => x.classList.toggle("is-on", x === b));
  activeScen = b.dataset.scen;
  renderPareto();
  const lf = $("#labFault");
  if (lf) { lf.value = activeScen === "nominal" ? 0 : 17; syncSlider(lf); $("#labFaultV").textContent = lf.value; runLab(); }
});

/* Live Simulation Lab */
function initLabSelect(preserveVal = false) {
  const sel = $("#labSite");
  if (!sel || !DATA) return;
  const cur = preserveVal && sel.value ? sel.value : "BB3";
  const grpLbl = { blocked: I18N.t("s4.grp_blocked"), drained: I18N.t("s4.grp_drained"), forested: I18N.t("s4.grp_forested") };
  sel.innerHTML = DATA.loggers.map((l) => `<option value="${l.id}">${l.id} (${grpLbl[l.group] || l.group} · ${l.values.length - l.cut} ${I18N.t("s4.slots_lbl")})</option>`).join("");
  sel.value = cur; // preserve active site on lang toggle; default BB3 on boot
}

function runLab() {
  if (!DATA || !$("#labSite")) return;
  const isEn = I18N.lang === "en";
  const id = $("#labSite").value || "BB3";
  const policy = $("#labPolicy").value || "Safety_V8";
  const v8Fast = parseFloat($("#labFast").value);
  const v8Medium = parseFloat($("#labMed").value);
  const v8Hold = parseInt($("#labHold").value, 10);
  const faultEvery = parseInt($("#labFault").value, 10);

  $("#labFastV").textContent = v8Fast.toFixed(1) + (isEn ? " cm/3h" : " cm/3j");
  $("#labMedV").textContent = v8Medium.toFixed(1) + (isEn ? " cm/3h" : " cm/3j");
  $("#labHoldV").textContent = String(v8Hold);
  $("#labFaultV").textContent = String(faultEvery);

  const lg = DATA.loggers.find((l) => l.id === id);
  const vals = ENG.testSlice(lg);
  const res = ENG.evaluate(vals, policy, lg.group, { v8Fast, v8Medium, v8Hold, faultEvery });
  const ref6 = ENG.evaluate(vals, "Fixed_6h", lg.group, { faultEvery });
  const save6 = 100 * (1 - res.energy / ref6.energy);

  const marks = [];
  res.trace.forEach((tr) => marks.push({ x: tr.i, kind: "read", fail: tr.fault }));
  res.matches.forEach((m) => {
    marks.push({ x: m.ref / 3, kind: "ref" });
    if (m.alarm !== null) marks.push({ x: m.alarm / 3, kind: "alarm", matched: true, y: vals[m.alarm / 3] });
    else marks.push({ x: m.ref / 3, kind: "miss" });
  });

  const t0 = new Date(lg.start).getTime() + lg.cut * 3 * 3600 * 1000;
  CH.lineChart($("#labChart"), {
    series: [{ name: id + (isEn ? " water level" : " muka air"), values: vals, color: "#22d3ee", width: 1.8, area: true }],
    marks,
    yUnit: " cm",
    height: 280,
    xLabel: (i) => {
      const d = new Date(t0 + i * 3 * 3600 * 1000);
      return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    },
  });

  const rec = Number.isFinite(res.recall) ? (res.recall * 100).toFixed(1) + "%" : "—";
  const f1 = Number.isFinite(res.f1) ? (res.f1 * 100).toFixed(1) + "%" : "—";
  const delay = Number.isFinite(res.delay) ? res.delay.toFixed(1) + "h" : "—";
  $("#labTerm").innerHTML = isEn
    ? `
    <div class="mu">$ python run_sylvaris_v8.py --site ${lg.group}_${id} --policy ${policy} --fault-every ${faultEvery}</div>
    <div class="cy">TEST WINDOW : ${vals.length} slots (${res.durationH} h) · Reference episodes = ${res.events}</div>
    <div class="${res.recall < ref6.recall ? "er" : "ok"}">DETECTION   : TP=${res.TP}  FP=${res.FP}  FN=${res.FN}  | Recall=${rec}  F1=${f1}  Mean Delay=${delay}</div>
    <div class="vi">SCHEDULER   : Scheduled reads=${res.reads}  Decisions=${res.decisions}  Injected faults=${res.fails}</div>
    <div class="${save6 >= 0 ? "ok" : "wa"}">ENERGY SIM  : ${res.energy.toFixed(2)} mAh (Fixed 6h = ${ref6.energy.toFixed(2)} mAh → Δ = ${save6 >= 0 ? "+" : ""}${save6.toFixed(2)}%)</div>
    <div class="mu">NOTE        : Energy is modeled (I_sleep=0.12 mA, e_read=0.12 mAh, e_dec=0.01 mAh) — NOT hardware measured.</div>`
    : `
    <div class="mu">$ python run_sylvaris_v8.py --site ${lg.group}_${id} --policy ${policy} --fault-every ${faultFaultSafe(faultEvery)}</div>
    <div class="cy">JENDELA UJI : ${vals.length} slot (${res.durationH} jam) · Kejadian referensi = ${res.events}</div>
    <div class="${res.recall < ref6.recall ? "er" : "ok"}">DETEKSI     : TP=${res.TP}  FP=${res.FP}  FN=${res.FN}  | Recall=${rec}  F1=${f1}  Tunda Rata2=${delay}</div>
    <div class="vi">PENJADWAL   : Jumlah baca=${res.reads}  Keputusan=${res.decisions}  Fault injeksi=${res.fails}</div>
    <div class="${save6 >= 0 ? "ok" : "wa"}">ENERGI MODEL: ${res.energy.toFixed(2)} mAh (Fixed 6h = ${ref6.energy.toFixed(2)} mAh → Δ = ${save6 >= 0 ? "+" : ""}${save6.toFixed(2)}%)</div>
    <div class="mu">CATATAN     : Energi adalah hasil model simulasi (I_sleep=0.12 mA, e_read=0.12 mAh) — BUKAN ukur hardware.</div>`;
}

function faultFaultSafe(v) { return v; }

["#labSite", "#labPolicy"].forEach((s) => $(s)?.addEventListener("change", runLab));
["#labFast", "#labMed", "#labHold", "#labFault"].forEach((s) => $(s)?.addEventListener("input", runLab));
$("#labResetBtn")?.addEventListener("click", () => {
  $("#labPolicy").value = "Safety_V8";
  $("#labFast").value = 2.0; syncSlider($("#labFast"));
  $("#labMed").value = 0.8; syncSlider($("#labMed"));
  $("#labHold").value = 2; syncSlider($("#labHold"));
  $("#labFault").value = 0; syncSlider($("#labFault"));
  runLab();
});

/* ---------------- Section 06: BOM, Roadmap, Failures, Gates, Claims ---------------- */
let probeMode = "allow";
function renderBOM() {
  if (!$("#bomNodes")) return;
  const nodes = parseInt($("#bomNodes").value, 10);
  const cont = parseInt($("#bomCont").value, 10);
  $("#bomNodesV").textContent = String(nodes);
  $("#bomContV").textContent = cont + "%";

  const sensorCost = probeMode === "comm" ? 3900000 : 350000;
  const sensorStatus = probeMode === "comm" ? I18N.t("s6.stat_comm") : I18N.t("s6.stat_allow");
  const allowLbl = I18N.t("s6.stat_allow");
  const retailLbl = I18N.t("s6.stat_retail");
  const items = [
    { label: I18N.t("s6.item_mcu"), value: 117500, status: `${retailLbl} [12]`, kind: "ok", color: "#2df5a6" },
    { label: I18N.t("s6.item_lora"), value: 74800, status: `${retailLbl} [13]`, kind: "ok", color: "#9d7bff" },
    { label: I18N.t("s6.item_sensor"), value: sensorCost, status: sensorStatus, kind: probeMode === "comm" ? "info" : "warn", color: "#22d3ee" },
    { label: I18N.t("s6.item_solar"), value: 180000, status: allowLbl, kind: "warn", color: "#d6ee79" },
    { label: I18N.t("s6.item_batt"), value: 90000, status: allowLbl, kind: "warn", color: "#ffb547" },
    { label: I18N.t("s6.item_enc"), value: 140000, status: allowLbl, kind: "warn", color: "#ff6a3d" },
    { label: I18N.t("s6.item_pcb"), value: 110000, status: allowLbl, kind: "warn", color: "#ff5d8f" },
  ];
  const perNode = items.reduce((a, b) => a + b.value, 0);
  const gw = 1250000;
  const sub = perNode * nodes + gw;
  const total = Math.round(sub * (1 + cont / 100));

  $("#bomPerNode").textContent = "Rp" + perNode.toLocaleString("id-ID");
  $("#bomTotal").textContent = "Rp" + total.toLocaleString("id-ID");
  $("#bomLines").innerHTML = `
    <div><span>${nodes}× ${I18N.t("s6.bom_nodes_row")}</span><b>Rp${(perNode * nodes).toLocaleString("id-ID")}</b></div>
    <div><span>${I18N.t("s6.bom_gw")}</span><b>Rp${gw.toLocaleString("id-ID")}</b></div>
    <div><span>${I18N.t("s6.bom_cont_row")} (${cont}%)</span><b>Rp${(total - sub).toLocaleString("id-ID")}</b></div>
  `;
  $("#bomTable tbody").innerHTML = items.map((it) => `
    <tr>
      <td><i style="display:inline-block;width:9px;height:9px;border-radius:3px;background:${it.color};margin-right:8px"></i><b>${it.label}</b></td>
      <td class="num">${it.value.toLocaleString("id-ID")}</td>
      <td><span class="tag ${it.kind}">${it.status}</span></td>
    </tr>
  `).join("") + `<tr><td><b>${I18N.t("s6.bom_tot_row")}</b></td><td class="num lime"><b>${perNode.toLocaleString("id-ID")}</b></td><td><span class="tag">${probeMode === "comm" ? I18N.t("s6.bom_comm_tag") : I18N.t("s6.bom_illu_tag")}</span></td></tr>`;

  CH.donut($("#bomDonut"), { items, size: 240 });
}

["#bomNodes", "#bomCont"].forEach((s) => $(s)?.addEventListener("input", renderBOM));
$("#bomProbeSeg")?.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-probe]"); if (!b) return;
  $$("#bomProbeSeg button").forEach((x) => x.classList.toggle("is-on", x === b));
  probeMode = b.dataset.probe;
  renderBOM();
});

function renderGovernance() {
  const isEn = I18N.lang === "en";
  const stages = isEn
    ? [
        { n: "01", t: "Surveyed Bench Calibration", p: "1 instrumented node vs manual dipstick across depths; log bias, MAE & thermal drift." },
        { n: "02", t: "Co-Located Stress Cluster", p: "3 co-located nodes + power profiler capturing real sleep, warm-up, compute & LoRa TX currents." },
        { n: "03", t: "Multi-Site Fresh Domain", p: "Held-out stations & seasons with common-timestamp fault injection & measured foliage PDR." },
        { n: "04", t: "Hazard Label Validation", p: "Independent peat moisture / wildfire ground-truth labels before any early-warning claim." },
      ]
    : [
        { n: "01", t: "Kalibrasi Bench & Datum", p: "1 node terinstrumentasi vs pengukuran manual multi-kedalaman; catat bias, MAE & drift suhu." },
        { n: "02", t: "Klaster Uji Ko-Lokasi", p: "3 node berdampingan + power profiler mengukur arus riil sleep, sensor, MCU & transmisi LoRa." },
        { n: "03", t: "Domain Segar Multi-Situs", p: "Stasiun & musim baru dengan injeksi fault pada timestamp kalender sama + uji PDR di kanopi gambut." },
        { n: "04", t: "Validasi Label Bahaya", p: "Label independen kelembapan gambut & kejadian api sebelum mengklaim sistem peringatan dini." },
      ];
  $("#roadmapGrid").innerHTML = stages.map((s) => `<div class="stage"><div class="pin">${s.n}</div><h4>${s.t}</h4><p>${s.p}</p></div>`).join("");

  const fails = I18N.failures();
  $("#failGrid").innerHTML = fails.map((f) => `
    <div class="flip" onclick="this.classList.toggle('is-flipped')">
      <div class="flip-in">
        <div class="flip-face front">
          <span class="ft">${f.code}</span>
          <h4>${f.title}</h4>
          <p style="font-size:13.5px;margin:0 0 12px">${f.risk}</p>
          <span class="hint">${isEn ? "Hover or tap to inspect mitigation ↻" : "Arahkan kursor / ketuk untuk mitigasi ↻"}</span>
        </div>
        <div class="flip-face back">
          <span class="ft">${f.title}</span>
          <dl>
            <div><dt>${isEn ? "MITIGATION" : "MITIGASI"}</dt><dd>${f.mit}</dd></div>
            <div><dt>${isEn ? "VALIDATION PROTOCOL" : "PROTOKOL VALIDASI"}</dt><dd>${f.val}</dd></div>
          </dl>
        </div>
      </div>
    </div>
  `).join("");

  const gates = isEn
    ? [
        { g: "G1", col: "emerald", t: "Recall Non-Inferiority", p: "Retain episode recall vs Fixed 6h on unseen stations/dates within an explicit non-inferiority margin." },
        { g: "G2", col: "cyan", t: "Matched-Time Net Energy", p: "Measure positive net energy gain using common wall-clock fault timestamps across every policy." },
        { g: "G3", col: "lime", t: "Full Hardware & RF Proof", p: "Establish probe calibration, measured LoRa PDR, actual TinyML footprint & multi-day solar balance." },
      ]
    : [
        { g: "G1", col: "emerald", t: "Non-Inferioritas Recall", p: "Mempertahankan recall episode vs Fixed 6h pada stasiun/tanggal baru sesuai margin yang ditetapkan." },
        { g: "G2", col: "cyan", t: "Net Energi Fault Setara", p: "Membuktikan penghematan energi positif di bawah skenario fault pada waktu kalender identik." },
        { g: "G3", col: "lime", t: "Bukti Fisik RF & Daya", p: "Memastikan kalibrasi sensor, PDR LoRa, jejak memori inferensi & neraca panen surya multi-hari." },
      ];
  $("#gatesGrid").innerHTML = gates.map((g) => `<div class="card spot gate"><div class="g ${g.col}">${g.g}</div><h4>${g.t}</h4><p>${g.p}</p></div>`).join("");

  $("#claimsGrid").innerHTML = I18N.claims().map((c) => `
    <div class="claim"><div class="el">${c.el}</div><div class="yes">${c.yes}</div><div class="no">${c.no}</div></div>
  `).join("");
}

/* ---------------- Section 07: Team & RACI ---------------- */
function openRoleModal(role) {
  $("#mBadge").textContent = role.badge || role.role;
  $("#mTitle").textContent = role.title || role.name;
  $("#mShort").textContent = role.short;
  $("#mDuties").innerHTML = role.duties.map((d) => `<li>${d}</li>`).join("");
  $("#mKpis").innerHTML = role.kpis.map((k) => `<li>${k}</li>`).join("");
  $("#roleModal").classList.add("on");
  $("#roleModal").setAttribute("aria-hidden", "false");
}
$("#modalClose")?.addEventListener("click", () => {
  $("#roleModal").classList.remove("on");
  $("#roleModal").setAttribute("aria-hidden", "true");
});
$("#roleModal")?.addEventListener("click", (e) => {
  if (e.target.id === "roleModal") $("#modalClose").click();
});

function renderTeam() {
  const tm = I18N.team();
  const isEn = I18N.lang === "en";
  const wrap = $("#orgWrap");
  if (!wrap) return;

  wrap.innerHTML = `
    <div class="org-lead">
      <article class="card spot tilt member lead" data-role="lead">
        <div class="av">BS</div>
        <div class="role">${tm.lead.role}</div>
        <h4>${tm.lead.name}</h4>
        <div class="mono" style="font-size:11.5px;color:var(--cyan);margin-bottom:10px">${tm.lead.affil}</div>
        <p>${tm.lead.short}</p>
        <div class="tags">${tm.lead.tags.map((x) => `<span class="tag ok">${x}</span>`).join("")}</div>
        <div class="more">${isEn ? "Inspect full jobdesk & KPIs ↗" : "Lihat rincian jobdesk & KPI ↗"}</div>
      </article>
    </div>
    <div class="org-line"></div>
    <div class="org-bus"></div>
    <div class="org-row">
      ${tm.roles.map((r, i) => `
        <article class="card spot tilt member" data-role="${i}">
          <div class="av">${r.badge.slice(11, 13) || "0" + (i + 1)}</div>
          <div class="role">${r.badge}</div>
          <h4>${r.title}</h4>
          <p>${r.short}</p>
          <div class="tags">${r.tags.map((x) => `<span class="tag">${x}</span>`).join("")}</div>
          <div class="more">${r.leadNote} · ↗</div>
        </article>
      `).join("")}
    </div>
  `;
  $$("#orgWrap .member").forEach((el) => {
    el.addEventListener("click", () => {
      const k = el.dataset.role;
      openRoleModal(k === "lead" ? tm.lead : tm.roles[parseInt(k, 10)]);
    });
  });
  if (window.SYL && window.SYL.refreshInteractive) window.SYL.refreshInteractive();

  const raciRows = isEn
    ? [
        ["Paper Authorship, Problem Scope & Claim Integrity", "A/R", "C", "C", "I", "I"],
        ["V4–V8 Python Simulation & Leeds Data Audit", "A/R", "I", "I", "R", "I"],
        ["Website Architecture, Branding & 3D Digital Twin", "A/R", "I", "C", "C", "R"],
        ["ESP32-S3 Firmware, RTC Sleep & Power Profiling", "A", "R", "C", "I", "I"],
        ["Well Survey, Sensor Calibration & LoRa PDR", "A", "C", "R", "I", "I"],
        ["Common-Time Fault Test & Fresh-Domain G1–G3", "A", "C", "C", "R", "I"],
      ]
    : [
        ["Penulisan Paper, Rumusan Masalah & Batas Klaim", "A/R", "C", "C", "I", "I"],
        ["Simulasi Python V4–V8 & Audit Dataset Leeds", "A/R", "I", "I", "R", "I"],
        ["Perancangan Website, Logo & Dashboard 3D Twin", "A/R", "I", "C", "C", "R"],
        ["Firmware ESP32-S3, RTC Sleep & Power Profiler", "A", "R", "C", "I", "I"],
        ["Survei Sumur, Kalibrasi Probe & Uji PDR LoRa", "A", "C", "R", "I", "I"],
        ["Uji Fault Waktu-Sama & Gerbang Validasi G1–G3", "A", "C", "C", "R", "I"],
      ];
  $("#raciTable").innerHTML = `
    <thead>
      <tr>
        <th>${isEn ? "Deliverable / Work Package" : "Paket Kerja / Deliverable"}</th>
        <th style="text-align:center">Bimo (Lead)</th>
        <th style="text-align:center">Firmware</th>
        <th style="text-align:center">Sensor & RF</th>
        <th style="text-align:center">Data Audit</th>
        <th style="text-align:center">Web & 3D</th>
      </tr>
    </thead>
    <tbody>
      ${raciRows.map((r) => `<tr><td><b>${r[0]}</b></td>${r.slice(1).map((c) => `<td class="c ${c[0]}">${c}</td>`).join("")}</tr>`).join("")}
    </tbody>
  `;
}

/* ---------------- Section 08: References & Parity Badge ---------------- */
function renderRefs() {
  const host = $("#refsGrid");
  if (!host) return;
  host.innerHTML = I18N.refs.map((r) => `
    <div class="ref">
      <b>${r.n}</b>
      <div>${r.text} <br><a href="${r.url}" target="_blank" rel="noopener">${r.label} ↗</a></div>
    </div>
  `).join("");
}

function verifyEngine() {
  if (!DATA || !ENG) return;
  const v = ENG.verify(DATA);
  const txt = `${v.ok}/${v.checks} CSV PARITY ✓`;
  const b = $("#parityBadge"); if (b) b.textContent = "ENGINE VERIFICATION: " + txt;
  const d = $("#dockParity"); if (d) d.textContent = txt;
}

/* ---------------- Bottom Dock Section Tracker ---------------- */
function initDock() {
  const secs = $$("main section[id]");
  const dockSec = $("#dockSec"), dockPct = $("#dockPct");
  addEventListener("scroll", () => {
    const h = document.documentElement;
    if (dockPct) dockPct.textContent = Math.round((h.scrollTop / (h.scrollHeight - h.clientHeight || 1)) * 100) + "%";
  }, { passive: true });
  const io = new IntersectionObserver((ents) => {
    ents.forEach((en) => {
      if (en.isIntersecting && dockSec) dockSec.textContent = en.target.id.toUpperCase();
    });
  }, { rootMargin: "-45% 0px -45% 0px" });
  secs.forEach((s) => io.observe(s));
}

/* ---------------- Boot Everything ---------------- */
document.addEventListener("syl-lang-change", () => {
  renderAnatomy();
  renderCineChapters();
  const hBtn = $("#heroTourBtn");
  if (hBtn && hero3D) hBtn.innerHTML = hero3D.isTourPlaying() ? `❚❚ <span>${I18N.t("dash.pause")}</span>` : `▶ <span>${I18N.t("tour.hero_btn")}</span>`;
  if (anat3D) {
    const aHtml = anat3D.isTourPlaying() ? `❚❚ <span>${I18N.t("tour.pause")}</span>` : `▶ <span>${I18N.t(anat3D.isTourActive() ? "tour.resume" : "tour.play")}</span>`;
    const cBtn = $("#cinePlayBtn"), qBtn = $("#anatTourQuick");
    if (cBtn) cBtn.innerHTML = aHtml;
    if (qBtn) qBtn.innerHTML = aHtml;
  }
  renderArch();
  updateScheduler();
  renderLoggers();
  initLabSelect(true);
  renderPareto();
  runLab();
  renderDilemma();
  renderGovernance();
  renderTeam();
  renderBOM();
});

document.addEventListener("DOMContentLoaded", () => {
  initPreferences();
  I18N.init();
  init3D();
  renderAnatomy();
  renderCineChapters();
  renderDilemma();
  renderArch();
  updateScheduler();
  renderV4Table();
  renderLoggers();
  initLabSelect();
  renderPareto();
  runLab();
  renderBOM();
  renderGovernance();
  renderTeam();
  renderRefs();
  verifyEngine();
  initDock();
});
