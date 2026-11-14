/* ==========================================================================
   SYLVARIS — tiny SVG chart kit (no dependencies)
   ========================================================================== */
(function (global) {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  const isNum = (v) => v !== null && v !== undefined && Number.isFinite(v);
  const nice = (lo, hi, n = 5) => {
    const span = hi - lo || 1, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n) || mag * 10;
    const out = []; for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6));
    return out;
  };

  function tooltip(host) {
    let t = host.querySelector(".chart-tip");
    if (!t) { t = document.createElement("div"); t.className = "chart-tip"; host.appendChild(t); }
    return {
      show(html, x, y) {
        t.innerHTML = html; t.classList.add("on");
        const w = t.offsetWidth, hw = host.clientWidth;
        t.style.left = Math.max(4, Math.min(hw - w - 4, x - w / 2)) + "px";
        t.style.top = Math.max(4, y - t.offsetHeight - 12) + "px";
      },
      hide() { t.classList.remove("on"); },
    };
  }

  /**
   * Time-series chart with optional markers.
   * opts: { series:[{values, color, width, name, area}], marks:[{x, kind}], bands:[{x0,x1,color}],
   *         xLabel(i), yUnit, height, cursorX }
   */
  function lineChart(host, opts) {
    host.querySelector("svg")?.remove();
    const W = host.clientWidth || 600, H = opts.height || host.clientHeight || 280;
    const m = { l: 46, r: 14, t: 16, b: 28 };
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", height: H, class: "chart" }, host);
    const all = opts.series.flatMap((s) => s.values.filter(isNum));
    let lo = Math.min(...all), hi = Math.max(...all);
    const pad = (hi - lo) * 0.12 || 1; lo -= pad; hi += pad;
    const n = Math.max(...opts.series.map((s) => s.values.length));
    const X = (i) => m.l + ((W - m.l - m.r) * i) / Math.max(1, n - 1);
    const Y = (v) => H - m.b - ((H - m.t - m.b) * (v - lo)) / (hi - lo);

    const defs = el("defs", {}, svg);
    // grid
    const g = el("g", { class: "grid" }, svg);
    for (const v of nice(lo, hi, 5)) {
      el("line", { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v) }, g);
      const t = el("text", { x: m.l - 8, y: Y(v) + 4, "text-anchor": "end" }, g); t.textContent = v + (opts.yUnit || "");
    }
    if (opts.xLabel) {
      const ticks = 6;
      for (let k = 0; k <= ticks; k++) {
        const i = Math.round(((n - 1) * k) / ticks);
        const t = el("text", { x: X(i), y: H - 8, "text-anchor": k === 0 ? "start" : k === ticks ? "end" : "middle" }, g);
        t.textContent = opts.xLabel(i);
      }
    }
    // bands
    (opts.bands || []).forEach((b) => el("rect", { x: X(b.x0), y: m.t, width: Math.max(2, X(b.x1) - X(b.x0)), height: H - m.t - m.b, fill: b.color, class: "band" }, svg));

    // series
    opts.series.forEach((s, si) => {
      let d = "", pen = false;
      s.values.forEach((v, i) => {
        if (!isNum(v)) { pen = false; return; }
        d += (pen ? "L" : "M") + X(i).toFixed(1) + "," + Y(v).toFixed(1); pen = true;
      });
      if (s.area) {
        const id = "ga" + Math.random().toString(36).slice(2);
        const lg = el("linearGradient", { id, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
        el("stop", { offset: 0, "stop-color": s.color, "stop-opacity": 0.28 }, lg);
        el("stop", { offset: 1, "stop-color": s.color, "stop-opacity": 0 }, lg);
        // area per continuous run
        let run = [];
        const flush = () => {
          if (run.length > 1) {
            const p = run.map(([i, v], k) => (k ? "L" : "M") + X(i).toFixed(1) + "," + Y(v).toFixed(1)).join("") + `L${X(run[run.length - 1][0])},${H - m.b}L${X(run[0][0])},${H - m.b}Z`;
            el("path", { d: p, fill: `url(#${id})`, stroke: "none" }, svg);
          }
          run = [];
        };
        s.values.forEach((v, i) => (isNum(v) ? run.push([i, v]) : flush())); flush();
      }
      const path = el("path", { d, fill: "none", stroke: s.color, "stroke-width": s.width || 1.6, "stroke-linejoin": "round", "stroke-linecap": "round", class: "series" + (s.dash ? " dash" : "") }, svg);
      if (s.dash) path.setAttribute("stroke-dasharray", s.dash);
      if (opts.animate !== false) {
        const len = path.getTotalLength ? path.getTotalLength() : 1000;
        path.style.strokeDasharray = s.dash || len; path.style.strokeDashoffset = s.dash ? 0 : len;
        requestAnimationFrame(() => { path.style.transition = "stroke-dashoffset 1.4s cubic-bezier(.2,.8,.2,1)"; path.style.strokeDashoffset = 0; });
      }
    });

    // marks
    const mg = el("g", { class: "marks" }, svg);
    (opts.marks || []).forEach((mk) => {
      const x = X(mk.x);
      if (mk.kind === "read") el("line", { x1: x, x2: x, y1: H - m.b, y2: H - m.b - 6, class: "mk-read" + (mk.fail ? " fail" : "") }, mg);
      else if (mk.kind === "ref") el("path", { d: `M${x},${m.t + 2}l5,-9h-10z`, class: "mk-ref", transform: `translate(0,9)` }, mg);
      else if (mk.kind === "alarm") el("circle", { cx: x, cy: isNum(mk.y) ? Y(mk.y) : m.t + 18, r: 4.2, class: "mk-alarm" + (mk.matched ? " ok" : "") }, mg);
      else if (mk.kind === "miss") el("path", { d: `M${x - 4},${m.t + 24}l8,8m0,-8l-8,8`, class: "mk-miss" }, mg);
    });

    // playhead
    const head = el("line", { x1: 0, x2: 0, y1: m.t, y2: H - m.b, class: "playhead", style: "opacity:0" }, svg);
    const dot = el("circle", { r: 5, class: "playdot", style: "opacity:0" }, svg);

    // hover
    const tip = tooltip(host);
    const cross = el("line", { y1: m.t, y2: H - m.b, class: "crosshair", style: "opacity:0" }, svg);
    svg.addEventListener("pointermove", (e) => {
      const r = svg.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * W;
      const i = Math.round(((px - m.l) / (W - m.l - m.r)) * (n - 1));
      if (i < 0 || i >= n) return;
      cross.setAttribute("x1", X(i)); cross.setAttribute("x2", X(i)); cross.style.opacity = 1;
      const rows = opts.series.map((s) => `<div><i style="background:${s.color}"></i>${s.name || ""}: <b>${isNum(s.values[i]) ? s.values[i].toFixed(1) + (opts.yUnit || "") : "—"}</b></div>`).join("");
      tip.show(`<em>${opts.xLabel ? opts.xLabel(i, true) : i}</em>${rows}`, (X(i) / W) * r.width, ((m.t + 20) / H) * r.height + 30);
    });
    svg.addEventListener("pointerleave", () => { cross.style.opacity = 0; tip.hide(); });

    return {
      setHead(i, v) {
        head.setAttribute("x1", X(i)); head.setAttribute("x2", X(i)); head.style.opacity = 1;
        if (isNum(v)) { dot.setAttribute("cx", X(i)); dot.setAttribute("cy", Y(v)); dot.style.opacity = 1; } else dot.style.opacity = 0;
      },
      X, Y, svg,
    };
  }

  /** scatter: points [{x,y,r,label,color,data}] */
  function scatter(host, opts) {
    host.querySelector("svg")?.remove();
    const W = host.clientWidth || 600, H = opts.height || 340;
    const m = { l: 52, r: 18, t: 18, b: 44 };
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", height: H, class: "chart" }, host);
    const xs = opts.points.map((p) => p.x), ys = opts.points.map((p) => p.y);
    const [x0, x1] = opts.xDomain || [Math.min(...xs), Math.max(...xs)];
    const [y0, y1] = opts.yDomain || [Math.min(...ys), Math.max(...ys)];
    const X = (v) => m.l + ((W - m.l - m.r) * (v - x0)) / (x1 - x0);
    const Y = (v) => H - m.b - ((H - m.t - m.b) * (v - y0)) / (y1 - y0);
    const g = el("g", { class: "grid" }, svg);
    nice(y0, y1, 6).forEach((v) => { el("line", { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v) }, g); el("text", { x: m.l - 8, y: Y(v) + 4, "text-anchor": "end" }, g).textContent = v + (opts.yUnit || ""); });
    nice(x0, x1, 6).forEach((v) => { el("line", { x1: X(v), x2: X(v), y1: m.t, y2: H - m.b, class: "v" }, g); el("text", { x: X(v), y: H - m.b + 18, "text-anchor": "middle" }, g).textContent = v + (opts.xUnit || ""); });
    if (opts.zeroY !== undefined) el("line", { x1: m.l, x2: W - m.r, y1: Y(opts.zeroY), y2: Y(opts.zeroY), class: "zero" }, svg);
    el("text", { x: (W + m.l) / 2, y: H - 6, "text-anchor": "middle", class: "axis-title" }, svg).textContent = opts.xTitle || "";
    const yt = el("text", { x: 14, y: (H - m.b + m.t) / 2, "text-anchor": "middle", class: "axis-title", transform: `rotate(-90 14 ${(H - m.b + m.t) / 2})` }, svg); yt.textContent = opts.yTitle || "";
    const tip = tooltip(host);
    opts.points.forEach((p, k) => {
      const gg = el("g", { class: "pt", style: `--d:${k * 90}ms` }, svg);
      el("circle", { cx: X(p.x), cy: Y(p.y), r: (p.r || 8) + 8, fill: p.color, class: "halo" }, gg);
      el("circle", { cx: X(p.x), cy: Y(p.y), r: p.r || 8, fill: p.color, class: "core" }, gg);
      const lb = el("text", { x: X(p.x) + (p.r || 8) + 5, y: Y(p.y) - (p.r || 8) + (p.dy || 0), class: "pt-label" }, gg); lb.textContent = p.label;
      gg.addEventListener("pointerenter", () => { const r = svg.getBoundingClientRect(); tip.show(p.html || p.label, (X(p.x) / W) * r.width, (Y(p.y) / H) * r.height); gg.classList.add("on"); opts.onHover && opts.onHover(p); });
      gg.addEventListener("pointerleave", () => { tip.hide(); gg.classList.remove("on"); opts.onHover && opts.onHover(null); });
      gg.addEventListener("click", () => opts.onClick && opts.onClick(p));
    });
    return { svg, X, Y };
  }

  /** donut: items [{label, value, color}] */
  function donut(host, opts) {
    host.querySelector("svg")?.remove();
    const S = opts.size || 260, R = S / 2 - 10, r = R * 0.62;
    const svg = el("svg", { viewBox: `0 0 ${S} ${S}`, width: S, height: S, class: "donut" }, host);
    const total = opts.items.reduce((a, b) => a + b.value, 0);
    let a0 = -Math.PI / 2;
    const tip = tooltip(host);
    opts.items.forEach((it, k) => {
      const a1 = a0 + (it.value / total) * Math.PI * 2, large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (rad, a) => [S / 2 + rad * Math.cos(a), S / 2 + rad * Math.sin(a)];
      const [x0, y0] = p(R, a0), [x1, y1] = p(R, a1), [x2, y2] = p(r, a1), [x3, y3] = p(r, a0);
      const path = el("path", { d: `M${x0},${y0}A${R},${R} 0 ${large} 1 ${x1},${y1}L${x2},${y2}A${r},${r} 0 ${large} 0 ${x3},${y3}Z`, fill: it.color, class: "slice", style: `--d:${k * 70}ms` }, svg);
      const mid = (a0 + a1) / 2;
      path.addEventListener("pointerenter", () => {
        path.style.transform = `translate(${Math.cos(mid) * 8}px,${Math.sin(mid) * 8}px)`;
        const rr = svg.getBoundingClientRect();
        tip.show(`<em>${it.label}</em><div><b>Rp${it.value.toLocaleString("id-ID")}</b> · ${((it.value / total) * 100).toFixed(1)}%</div>`, rr.width / 2 + Math.cos(mid) * rr.width * 0.36, rr.height / 2 + Math.sin(mid) * rr.height * 0.36);
        opts.onHover && opts.onHover(it);
      });
      path.addEventListener("pointerleave", () => { path.style.transform = ""; tip.hide(); opts.onHover && opts.onHover(null); });
      a0 = a1;
    });
    return svg;
  }

  global.SylChart = { lineChart, scatter, donut, nice };
})(window);
