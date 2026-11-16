"""
Exploratory retrospective threshold sensitivity check for SYLVARIS policies
using the exact archived 3-h series in assets/data/loggers.js (DOI: 10.5518/960).
Evaluates threshold_cm in {3.0, 4.0, 5.0, 6.0} with Safety_V8 parameters fixed
(no test-set retuning). All metrics are retrospective exploratory benchmarks.
"""
import json, math, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
LOGGERS_JS = ROOT / "assets" / "data" / "loggers.js"

V6_CFG = {
    "blocked": (5.0, 1.0, 3),
    "drained": (5.0, 0.5, 4),
    "forested": (2.0, 1.0, 4),
}

def is_num(v): return v is not None and math.isfinite(v)

def group_events(hours, gap_h=6.0):
    groups = []
    for t in sorted(hours):
        if not groups or t - groups[-1][-1] > gap_h:
            groups.append([t])
        else:
            groups[-1].append(t)
    return [g[0] for g in groups]

def ref_events(vals, thr):
    hits = [i * 3 for i in range(1, len(vals)) if is_num(vals[i]) and is_num(vals[i - 1]) and abs(vals[i] - vals[i - 1]) >= thr]
    return group_events(hits, 6.0)

def sim_eval(vals, pol, grp, thr, fault_every=0):
    refs = ref_events(vals, thr)
    last_v, last_t, next_slot = None, None, 0
    reads, decs, fails, hold = 0, 0, 0, 0
    raw_alarms = []
    for i, val in enumerate(vals):
        if i < next_slot: continue
        t = i * 3
        reads += 1
        inj = bool(fault_every and reads % fault_every == 0)
        v = None if inj else val
        if inj: fails += 1
        slots = 1 if pol == "Fixed_3h" else (2 if pol == "Fixed_6h" else 1)
        if pol in ("Adaptive_V6", "Safety_V8"): decs += 1
        rate = None
        if is_num(v):
            if last_v is not None and (t - last_t) > 0:
                ch = abs(v - last_v)
                rate = (ch * 3.0) / (t - last_t)
                if ch >= thr: raw_alarms.append(t)
            if pol == "Adaptive_V6":
                f_th, m_th, mx = V6_CFG[grp]
                slots = 1 if (rate is None or rate >= f_th) else (2 if rate >= m_th else mx)
            elif pol == "Safety_V8":
                if rate is None or rate >= 2.0: hold = 2
                if hold > 0: slots = 1; hold -= 1
                elif rate >= 0.8: slots = 2
                else: slots = 3
            last_v, last_t = v, t
        elif pol in ("Adaptive_V6", "Safety_V8"):
            slots = 1
            if pol == "Safety_V8": hold = 2
        next_slot = i + slots
    alarms = group_events(raw_alarms, 6.0)
    unmatched = set(range(len(alarms)))
    tp = 0
    for ev in refs:
        opts = [k for k in unmatched if 0 <= alarms[k] - ev <= 6.0]
        if opts:
            unmatched.remove(min(opts, key=lambda k: alarms[k]))
            tp += 1
    fp, fn = len(alarms) - tp, len(refs) - tp
    return len(refs), tp, fp, fn, reads

def main():
    txt = LOGGERS_JS.read_text(encoding="utf-8")
    data = json.loads(txt.split("window.SYLVARIS_DATA = ", 1)[1].rstrip(";\n "))
    for thr in (3.0, 4.0, 5.0, 6.0):
        print(f"Threshold |dx| >= {thr:.1f} cm (Nominal, N_sites=9):")
        for pol in ("Fixed_6h", "Adaptive_V6", "Safety_V8"):
            EV = TP = FP = FN = RD = 0
            for lg in data["loggers"]:
                ev, tp, fp, fn, rd = sim_eval(lg["values"][lg["cut"]:], pol, lg["group"], thr, 0)
                EV += ev; TP += tp; FP += fp; FN += fn; RD += rd
            rec = TP / EV * 100.0
            f1 = 2 * TP / (2 * TP + FP + FN) * 100.0
            print(f"  {pol:11s} | N={EV:2d} TP/FP/FN={TP:2d}/{FP:2d}/{FN:2d} | Rec={rec:6.2f}% | F1={f1:6.2f}% | Reads={RD}")

if __name__ == "__main__":
    main()
