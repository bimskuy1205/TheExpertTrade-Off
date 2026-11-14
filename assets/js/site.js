/* ==========================================================================
   SYLVARIS — shared UI layer
   preloader · custom cursor · spotlight · magnetic · tilt · reveal ·
   counters · scramble · glossary · touch ripples · nav
   ========================================================================== */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const isTouch = matchMedia("(hover: none), (pointer: coarse)").matches;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.SYL = window.SYL || {};
  SYL.isTouch = isTouch; SYL.reduce = reduce;

  /* ---------------- preloader (boot sequence) ---------------- */
  function boot() {
    const pre = $("#preloader");
    if (!pre) { document.documentElement.classList.add("is-ready"); return; }
    const log = $(".boot-log", pre), bar = $(".boot-bar i", pre), pct = $(".boot-pct", pre);
    const lines = (pre.dataset.lines || "").split("|").filter(Boolean);
    let i = 0, p = 0;
    const seen = sessionStorage.getItem("syl-booted");
    const speed = seen ? 25 : 120;
    const step = () => {
      if (i < lines.length) {
        const d = document.createElement("div");
        d.innerHTML = `<span class="t">[${(performance.now() / 1000).toFixed(3).padStart(8, "0")}]</span> ${lines[i]} <b>OK</b>`;
        log.appendChild(d); i++;
      }
      p = Math.min(100, Math.round((i / lines.length) * 100));
      bar.style.width = p + "%"; pct.textContent = String(p).padStart(3, "0") + "%";
      if (i < lines.length) setTimeout(step, speed + Math.random() * speed * 0.6);
      else setTimeout(() => {
        pre.classList.add("is-done");
        document.documentElement.classList.add("is-ready");
        sessionStorage.setItem("syl-booted", "1");
        setTimeout(() => pre.remove(), 900);
      }, seen ? 120 : 380);
    };
    step();
  }

  /* ---------------- custom cursor ---------------- */
  function cursor() {
    if (isTouch) return;
    const dot = document.createElement("div"), ring = document.createElement("div");
    dot.className = "cur-dot"; ring.className = "cur-ring";
    ring.innerHTML = '<i></i><i></i><i></i><i></i><span class="cur-label"></span>';
    document.body.append(dot, ring);
    let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y;
    const label = $(".cur-label", ring);
    const dockPtr = $("#dockPtr");
    const checkStage = (target) => {
      const onStage = !!(target && target.closest && target.closest("[data-3d-stage],canvas,.chart-wrap,input[type='range'],select,.terminal-body"));
      document.body.classList.toggle("cur-stage-native", onStage);
      return onStage;
    };
    addEventListener("pointermove", (e) => {
      x = e.clientX; y = e.clientY;
      document.documentElement.style.setProperty("--mx", x + "px");
      document.documentElement.style.setProperty("--my", y + "px");
      if (dockPtr) dockPtr.textContent = `${String(Math.round(x)).padStart(4, "0")}·${String(Math.round(y)).padStart(4, "0")}`;
      checkStage(e.target);
    }, { passive: true });
    addEventListener("pointerdown", () => ring.classList.add("is-down"));
    addEventListener("pointerup", () => ring.classList.remove("is-down"));
    document.addEventListener("mouseleave", () => document.body.classList.add("cur-hidden"));
    document.addEventListener("mouseenter", () => document.body.classList.remove("cur-hidden"));
    document.addEventListener("pointerover", (e) => {
      if (checkStage(e.target)) {
        ring.classList.remove("is-hover", "has-label");
        return;
      }
      const t = e.target.closest("a,button,[data-cursor],label,.tilt");
      ring.classList.toggle("is-hover", !!t);
      const txt = t && t.dataset ? t.dataset.cursor || "" : "";
      label.textContent = txt;
      ring.classList.toggle("has-label", !!txt);
    });
    (function loop() {
      rx += (x - rx) * 0.2; ry += (y - ry) * 0.2;
      dot.style.transform = `translate3d(${x}px,${y}px,0)`;
      ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
      requestAnimationFrame(loop);
    })();
  }

  /* ---------------- touch ripples (mobile delight) ---------------- */
  function ripples() {
    addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse") return;
      const r = document.createElement("span");
      r.className = "touch-ripple";
      r.style.left = e.clientX + "px"; r.style.top = e.clientY + "px";
      document.body.appendChild(r);
      setTimeout(() => r.remove(), 900);
      document.documentElement.style.setProperty("--mx", e.clientX + "px");
      document.documentElement.style.setProperty("--my", e.clientY + "px");
    }, { passive: true });
  }

  /* ---------------- spotlight cards ---------------- */
  function spotlight() {
    document.addEventListener("pointermove", (e) => {
      const c = e.target.closest(".spot");
      if (!c) return;
      const r = c.getBoundingClientRect();
      c.style.setProperty("--x", e.clientX - r.left + "px");
      c.style.setProperty("--y", e.clientY - r.top + "px");
    }, { passive: true });
  }

  /* ---------------- magnetic ---------------- */
  function magnetic() {
    if (isTouch) return;
    $$(".magnetic").forEach((el) => {
      const s = parseFloat(el.dataset.strength || 0.35);
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * s}px, ${(e.clientY - r.top - r.height / 2) * s}px)`;
      });
      el.addEventListener("pointerleave", () => { el.style.transform = ""; });
    });
  }

  /* ---------------- tilt ---------------- */
  function tilt() {
    if (isTouch || reduce) return;
    $$(".tilt").forEach((el) => {
      if (el._tiltBound) return;
      el._tiltBound = true;
      const max = parseFloat(el.dataset.tilt || 8);
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(900px) rotateX(${-py * max}deg) rotateY(${px * max}deg) translateZ(0)`;
      });
      el.addEventListener("pointerleave", () => { el.style.transform = ""; });
    });
  }
  SYL.refreshInteractive = tilt;

  /* ---------------- counters ---------------- */
  function countUp(el) {
    const end = parseFloat(el.dataset.count), dec = parseInt(el.dataset.dec || 0, 10);
    const dur = parseInt(el.dataset.dur || 1600, 10), pre = el.dataset.pre || "", suf = el.dataset.suf || "";
    const t0 = performance.now();
    const f = (n) => n.toLocaleString("id-ID", { minimumFractionDigits: dec, maximumFractionDigits: dec });
    (function run(t) {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4);
      el.textContent = pre + f(end * e) + suf;
      if (k < 1) requestAnimationFrame(run);
    })(t0);
  }

  /* ---------------- scramble ---------------- */
  const GLYPHS = "01<>/\\[]{}#$%&*+=ΔΣλ";
  function scramble(el) {
    const final = el.dataset.text || el.textContent;
    el.dataset.text = final;
    let frame = 0; const total = Math.max(18, final.length * 1.4);
    cancelAnimationFrame(el._raf);
    const run = () => {
      let out = "";
      for (let i = 0; i < final.length; i++) {
        if (final[i] === " ") { out += " "; continue; }
        out += i < (frame / total) * final.length ? final[i] : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (frame++ < total) el._raf = requestAnimationFrame(run); else el.textContent = final;
    };
    run();
  }
  SYL.scramble = scramble;

  /* ---------------- reveal ---------------- */
  function reveal() {
    const io = new IntersectionObserver((ents) => {
      ents.forEach((en) => {
        if (!en.isIntersecting) return;
        const el = en.target;
        el.classList.add("in");
        if (el.dataset.count !== undefined) countUp(el);
        if (el.hasAttribute("data-scramble")) scramble(el);
        $$("[data-count]", el).forEach((c) => { if (!c._done) { c._done = 1; countUp(c); } });
        io.unobserve(el);
      });
    }, { threshold: 0.18, rootMargin: "0px 0px -6% 0px" });
    $$(".reveal,[data-count],[data-scramble]").forEach((el) => io.observe(el));
    $$("[data-stagger]").forEach((wrap) => {
      [...wrap.children].forEach((c, i) => { c.style.setProperty("--d", i * (parseFloat(wrap.dataset.stagger) || 80) + "ms"); c.classList.add("reveal"); io.observe(c); });
    });
    $$("[data-scramble-hover]").forEach((el) => el.addEventListener("pointerenter", () => scramble(el)));
  }

  /* ---------------- glossary ---------------- */
  function glossary() {
    const tip = document.createElement("div");
    tip.className = "gloss-tip"; document.body.appendChild(tip);
    const show = (el) => {
      const dict = (window.SYL && window.SYL.GLOSSARY) || {};
      const key = el.dataset.term, d = dict[key] || el.dataset.def;
      if (!d) return;
      tip.innerHTML = `<b>${key}</b><span>${d}</span>`;
      const r = el.getBoundingClientRect();
      tip.classList.add("on");
      const tw = tip.offsetWidth;
      tip.style.left = Math.max(12, Math.min(innerWidth - tw - 12, r.left + r.width / 2 - tw / 2)) + "px";
      tip.style.top = r.top - tip.offsetHeight - 10 < 8 ? r.bottom + 10 + "px" : r.top - tip.offsetHeight - 10 + "px";
    };
    document.addEventListener("pointerover", (e) => { const t = e.target.closest("[data-term]"); if (t) show(t); });
    document.addEventListener("pointerout", (e) => { if (e.target.closest("[data-term]")) tip.classList.remove("on"); });
    document.addEventListener("click", (e) => { const t = e.target.closest("[data-term]"); if (t && isTouch) show(t); else if (!t) tip.classList.remove("on"); });
    addEventListener("scroll", () => tip.classList.remove("on"), { passive: true });
  }

  /* ---------------- nav ---------------- */
  function nav() {
    const bar = $(".progress i"), navEl = $(".nav");
    let last = 0;
    addEventListener("scroll", () => {
      const h = document.documentElement, y = h.scrollTop;
      if (bar) bar.style.width = (y / (h.scrollHeight - h.clientHeight)) * 100 + "%";
      if (navEl) { navEl.classList.toggle("is-scrolled", y > 30); navEl.classList.toggle("is-hidden", y > last && y > 400 && !navEl.classList.contains("is-open")); }
      last = y;
    }, { passive: true });
    const burger = $(".nav-burger");
    if (burger) burger.addEventListener("click", () => navEl.classList.toggle("is-open"));
    $$(".nav-links a").forEach((a) => a.addEventListener("click", () => navEl.classList.remove("is-open")));
    const links = $$(".nav-links a[href^='#']");
    if (links.length) {
      const io = new IntersectionObserver((ents) => {
        ents.forEach((en) => { if (en.isIntersecting) links.forEach((l) => l.classList.toggle("is-active", l.getAttribute("href") === "#" + en.target.id)); });
      }, { rootMargin: "-45% 0px -50% 0px" });
      links.forEach((l) => { const s = $(l.getAttribute("href")); if (s) io.observe(s); });
    }
    // live clock in nav (WIB)
    const clk = $("[data-clock]");
    if (clk) setInterval(() => { clk.textContent = new Date().toLocaleTimeString("id-ID", { hour12: false, timeZone: "Asia/Jakarta" }) + " WIB"; }, 1000);
  }

  SYL.$ = $; SYL.$$ = $$; SYL.countUp = countUp;
  document.addEventListener("DOMContentLoaded", () => {
    boot(); cursor(); ripples(); spotlight(); magnetic(); tilt(); reveal(); glossary(); nav();
  });
})();
