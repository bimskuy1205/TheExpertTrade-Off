/* ==========================================================================
   SYLVARIS ENGINE — faithful JavaScript port of run_sylvaris_v8.py
   --------------------------------------------------------------------------
   - reference episode detection (|Δx| >= 5 cm between consecutive 3-h slots)
   - 4 sampling policies: Fixed_3h, Fixed_6h, Adaptive_V6, Safety_V8
   - deterministic fault injection (every N-th scheduled read fails)
   - illustrative energy ledger  E = I_sleep·T + N_read·e_read + N_dec·e_dec
   - one-to-one onset matching within 0–6 h
   All numbers are retrospective & illustrative (not hardware measurements).
   ========================================================================== */
(function (global) {
  "use strict";

  const DEFAULTS = {
    eventCm: 5.0,      // reference episode threshold (cm)
    gapH: 6.0,         // grouping window (h)
    matchH: 6.0,       // alarm → onset matching window (h)
    sleepMa: 0.12,     // I_sleep (mA)
    readMah: 0.12,     // e_read (mAh)
    decisionMah: 0.01, // e_dec (mAh)
    stepH: 3,          // grid resolution (h)
    v8Fast: 2.0,       // cm / 3 h → 3 h interval + fast-hold
    v8Medium: 0.8,     // cm / 3 h → 6 h interval
    v8Hold: 2,         // fast-hold reads
    v8MaxSlots: 3,     // quiet interval = 3 slots = 9 h
  };

  const V6_CONFIG = {
    blocked: { fast: 5.0, medium: 1.0, maxSlots: 3 },
    drained: { fast: 5.0, medium: 0.5, maxSlots: 4 },
    forested: { fast: 2.0, medium: 1.0, maxSlots: 4 },
  };

  const POLICIES = ["Fixed_3h", "Fixed_6h", "Adaptive_V6", "Safety_V8"];

  const isNum = (v) => v !== null && v !== undefined && Number.isFinite(v);

  /** group sorted hour-stamps: a new group starts when gap > gapH; returns first of each */
  function groupEvents(hours, gapH) {
    const sorted = [...hours].sort((a, b) => a - b);
    const groups = [];
    for (const t of sorted) {
      if (!groups.length || t - groups[groups.length - 1][groups[groups.length - 1].length - 1] > gapH) groups.push([t]);
      else groups[groups.length - 1].push(t);
    }
    return groups.map((g) => g[0]);
  }

  /** reference episodes on a 3-h series (values with null for gaps) → hour offsets */
  function referenceEvents(values, p) {
    const cfg = Object.assign({}, DEFAULTS, p);
    const hits = [];
    for (let i = 1; i < values.length; i++) {
      const a = values[i], b = values[i - 1];
      if (isNum(a) && isNum(b) && Math.abs(a - b) >= cfg.eventCm) hits.push(i * cfg.stepH);
    }
    return groupEvents(hits, cfg.gapH);
  }

  /**
   * Run one sampling policy across the series.
   * Returns alarms (hours), reads, decisions, failures, energy and a per-read trace.
   */
  function simulate(values, policy, group, opts) {
    const cfg = Object.assign({}, DEFAULTS, opts);
    const faultEvery = cfg.faultEvery || 0;
    const v6 = V6_CONFIG[group] || V6_CONFIG.blocked;

    let lastValue = null, lastTime = null;
    let nextSlot = 0, reads = 0, decisions = 0, failures = 0, fastHold = 0;
    const rawAlarms = [];
    const trace = []; // {i, value, ok, rate, slots, fault, alarm}

    for (let i = 0; i < values.length; i++) {
      if (i < nextSlot) continue;
      const t = i * cfg.stepH;
      reads += 1;
      const injected = !!(faultEvery && reads % faultEvery === 0);
      const value = injected ? null : values[i];
      if (injected) failures += 1;

      let slots;
      if (policy === "Fixed_3h") slots = 1;
      else if (policy === "Fixed_6h") slots = 2;
      else { decisions += 1; slots = 1; }

      let rate = null, alarm = false;
      if (isNum(value)) {
        if (lastValue !== null) {
          const elapsed = t - lastTime;
          if (elapsed > 0) {
            const change = Math.abs(value - lastValue);
            rate = (change * 3) / elapsed;
            if (change >= cfg.eventCm) { rawAlarms.push(t); alarm = true; }
          }
        }
        if (policy === "Adaptive_V6") {
          if (rate === null || rate >= v6.fast) slots = 1;
          else if (rate >= v6.medium) slots = 2;
          else slots = v6.maxSlots;
        } else if (policy === "Safety_V8") {
          if (rate === null || rate >= cfg.v8Fast) fastHold = cfg.v8Hold;
          if (fastHold > 0) { slots = 1; fastHold -= 1; }
          else if (rate >= cfg.v8Medium) slots = 2;
          else slots = cfg.v8MaxSlots;
        }
        lastValue = value;
        lastTime = t;
      } else if (policy === "Adaptive_V6" || policy === "Safety_V8") {
        slots = 1; // retry soon when a reading is missing
        if (policy === "Safety_V8") fastHold = cfg.v8Hold;
      }
      trace.push({ i, value, ok: isNum(value), rate, slots, fault: injected, alarm });
      nextSlot = i + slots;
    }

    const alarms = groupEvents(rawAlarms, cfg.gapH);
    const durationH = values.length * cfg.stepH;
    const energy = durationH * cfg.sleepMa + reads * cfg.readMah + decisions * cfg.decisionMah;
    return { alarms, reads, decisions, failures, energy, trace, durationH };
  }

  /** full evaluation with one-to-one matching */
  function evaluate(values, policy, group, opts) {
    const cfg = Object.assign({}, DEFAULTS, opts);
    const refs = referenceEvents(values, cfg);
    const sim = simulate(values, policy, group, cfg);
    const unmatched = new Set(sim.alarms.map((_, i) => i));
    const delays = [];
    const matches = [];
    for (const ev of refs) {
      const options = [...unmatched].filter((k) => {
        const d = sim.alarms[k] - ev;
        return d >= 0 && d <= cfg.matchH;
      });
      if (options.length) {
        const sel = options.reduce((a, b) => (sim.alarms[a] <= sim.alarms[b] ? a : b));
        unmatched.delete(sel);
        delays.push(sim.alarms[sel] - ev);
        matches.push({ ref: ev, alarm: sim.alarms[sel] });
      } else {
        matches.push({ ref: ev, alarm: null });
      }
    }
    const tp = delays.length, fp = sim.alarms.length - tp, fn = refs.length - tp;
    return {
      policy,
      events: refs.length, refs, matches,
      TP: tp, FP: fp, FN: fn,
      precision: tp + fp ? tp / (tp + fp) : NaN,
      recall: tp + fn ? tp / (tp + fn) : NaN,
      f1: 2 * tp + fp + fn ? (2 * tp) / (2 * tp + fp + fn) : NaN,
      delay: delays.length ? delays.reduce((a, b) => a + b, 0) / delays.length : NaN,
      reads: sim.reads, fails: sim.failures, decisions: sim.decisions,
      energy: sim.energy, alarms: sim.alarms, trace: sim.trace, durationH: sim.durationH,
    };
  }

  /** test split = last 30% of the 3-h series (as in V7/V8) */
  function testSlice(logger) {
    return logger.values.slice(logger.cut);
  }

  /** compare engine output with the official CSV numbers shipped in loggers.js */
  function verify(data) {
    let checks = 0, ok = 0;
    const rows = [];
    for (const lg of data.loggers) {
      const vals = testSlice(lg);
      for (const [scenario, faultEvery] of [["nominal", 0], ["every_17th_read_fails", 17]]) {
        for (const pol of POLICIES) {
          const ref = lg.official?.[scenario]?.[pol];
          if (!ref) continue;
          const r = evaluate(vals, pol, lg.group, { faultEvery });
          const same =
            r.events === ref.events && r.TP === ref.TP && r.FP === ref.FP && r.FN === ref.FN &&
            r.reads === ref.reads && r.fails === ref.fails && r.decisions === ref.decisions &&
            Math.abs(r.energy - ref.energy) < 0.01;
          checks++; if (same) ok++;
          rows.push({ id: lg.id, scenario, pol, same });
        }
      }
    }
    return { checks, ok, rows };
  }

  global.SylvarisEngine = { DEFAULTS, V6_CONFIG, POLICIES, referenceEvents, simulate, evaluate, testSlice, verify, groupEvents };
})(window);
