"""
Exploratory retrospective threshold sensitivity check for SYLVARIS policies
using assets/data/loggers.js (DOI: 10.5518/960).
Evaluates threshold_cm in {3.0, 4.0, 5.0, 6.0} across Fixed_6h, Adaptive_V6,
Safety_V8, V8_TinyML, and Hybrid_Site6h+TinyML without test-set retuning.
"""
import json
import pathlib
from v81_benchmark import LOGGERS_JS, fit_and_quantize_tinyml, sim_policy, agg


def main():
    data = json.loads(LOGGERS_JS.read_text(encoding="utf-8").split("window.SYLVARIS_DATA = ", 1)[1].rstrip(";\n "))
    loggers = data["loggers"]
    tiny_model = fit_and_quantize_tinyml(loggers, export_header=False)
    for thr in (3.0, 4.0, 5.0, 6.0):
        print(f"Threshold |dx| >= {thr:.1f} cm (Nominal, 9 loggers across 3 settings):")
        for pol in ("Fixed_6h", "Adaptive_V6", "Safety_V8", "V8_TinyML", "Hybrid_Site6h+TinyML"):
            m = agg([sim_policy(lg, pol, thr=thr, tiny_model=tiny_model) for lg in loggers])
            print(f"  {pol:20s} | N={m['ev']:2d} TP/FP/FN={m['TP']:2d}/{m['FP']:2d}/{m['FN']:2d} | Rec={m['rec']:6.2f}% | F1={m['f1']:6.2f}% | Reads={m['reads']}")


if __name__ == "__main__":
    main()
