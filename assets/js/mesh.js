/* ==========================================================================
   SYLVARIS — Interactive Sensor-Mesh Background Canvas
   Nodes drift gently and form LoRa-style telemetry links toward the pointer.
   Respects prefers-reduced-motion and the .no-motion toggle.
   ========================================================================== */
(function () {
  "use strict";
  const canvas = document.getElementById("mesh");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let W = 0, H = 0, DPR = Math.min(devicePixelRatio || 1, 2);
  let mx = -9999, my = -9999;

  const nodes = [];
  const COUNT = innerWidth < 768 ? 28 : 54;

  function resize() {
    W = canvas.clientWidth || innerWidth;
    H = canvas.clientHeight || innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function seed() {
    nodes.length = 0;
    for (let i = 0; i < COUNT; i++) {
      nodes.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: 1.4 + Math.random() * 1.8,
        c: i % 5 === 0 ? "#D6EE79" : i % 3 === 0 ? "#22D3EE" : "#2DF5A6",
        p: Math.random() * Math.PI * 2,
      });
    }
  }

  addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    mx = e.clientX - r.left;
    my = e.clientY - r.top;
  }, { passive: true });
  addEventListener("pointerleave", () => { mx = -9999; my = -9999; });
  addEventListener("resize", () => { resize(); });

  resize();
  seed();

  let active = true;
  new IntersectionObserver(([en]) => { active = en.isIntersecting; }, { threshold: 0.01 }).observe(canvas);

  function frame(t) {
    requestAnimationFrame(frame);
    if (!active || reduce || document.documentElement.classList.contains("no-motion")) return;

    ctx.clearRect(0, 0, W, H);
    const isLight = document.documentElement.dataset.theme === "light";
    const linkAlpha = isLight ? 0.18 : 0.14;

    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      a.x += a.vx; a.y += a.vy;
      if (a.x < 0 || a.x > W) a.vx *= -1;
      if (a.y < 0 || a.y > H) a.vy *= -1;

      const dm = Math.hypot(a.x - mx, a.y - my);
      if (dm < 190) {
        ctx.strokeStyle = isLight
          ? `rgba(0,168,107,${(1 - dm / 190) * 0.42})`
          : `rgba(214,238,121,${(1 - dm / 190) * 0.45})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(mx, my);
        ctx.stroke();
      }

      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 135) {
          ctx.strokeStyle = isLight
            ? `rgba(8,145,178,${(1 - d / 135) * linkAlpha})`
            : `rgba(45,245,166,${(1 - d / 135) * linkAlpha})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      const pulse = 0.65 + 0.35 * Math.sin(t * 0.002 + a.p);
      ctx.globalAlpha = pulse;
      ctx.fillStyle = a.c;
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  requestAnimationFrame(frame);
})();
