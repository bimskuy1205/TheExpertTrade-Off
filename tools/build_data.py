"""
SYLVARIS web data builder
-------------------------
Converts the official University of Leeds logger CSVs (DOI 10.5518/960)
into a compact JSON file used by the website dashboard.

The loading rule mirrors run_sylvaris_v8.py exactly:
  - parse "date" with %d/%m/%Y %H:%M, coerce "-" to NaN
  - drop conflicting timestamps / duplicates
  - resample to a 3-hour grid (mean), missing slots stay null

Usage (from repo root):
  python tools/build_data.py <folder_with_leeds_official_csv> <v8_all_metrics.csv>
"""
import json
import sys
from pathlib import Path

import pandas as pd

LOGGERS = [
    ("blocked", "BB1"), ("blocked", "BB2"), ("blocked", "BB3"),
    ("drained", "AA1"), ("drained", "AA2"), ("drained", "AA3"),
    ("forested", "AL0"), ("forested", "AL1"), ("forested", "AL5"),
]


def load(path: Path) -> pd.Series:
    raw = pd.read_csv(path, na_values=["-", ""])
    raw.columns = [str(c).strip() for c in raw.columns]
    col = "absolute water-level (cm)"
    data = pd.DataFrame({
        "date": pd.to_datetime(raw["date"], format="%d/%m/%Y %H:%M", errors="coerce"),
        "value": pd.to_numeric(raw[col], errors="coerce"),
    }).dropna()
    counts = data.groupby("date")["value"].nunique()
    data = data.loc[~data["date"].isin(counts[counts > 1].index)]
    data = data.drop_duplicates("date").sort_values("date")
    return data.set_index("date")["value"].resample("3h").mean()


def main():
    src = Path(sys.argv[1])
    metrics_csv = Path(sys.argv[2])
    out = Path(__file__).resolve().parents[1] / "assets" / "data" / "loggers.js"
    out.parent.mkdir(parents=True, exist_ok=True)

    metrics = pd.read_csv(metrics_csv)
    loggers = []
    for group, sensor in LOGGERS:
        s = load(src / f"{group}_auto_wl_{sensor}.csv")
        cut = int(len(s) * 0.70)
        site = f"{group}_{sensor}"
        m = metrics[metrics.site == site]
        official = {}
        for _, r in m.iterrows():
            official.setdefault(r.scenario, {})[r.policy] = {
                "events": int(r.events), "TP": int(r.TP), "FP": int(r.FP), "FN": int(r.FN),
                "recall": None if pd.isna(r.recall) else round(float(r.recall), 4),
                "precision": None if pd.isna(r.precision) else round(float(r.precision), 4),
                "f1": None if pd.isna(r.f1) else round(float(r.f1), 4),
                "delay": None if pd.isna(r.mean_delay_h) else round(float(r.mean_delay_h), 2),
                "reads": int(r.scheduled_reads), "fails": int(r.injected_failures),
                "decisions": int(r.decisions), "energy": round(float(r.energy_mAh_sim), 3),
            }
        loggers.append({
            "id": sensor,
            "group": group,
            "start": s.index[0].strftime("%Y-%m-%dT%H:%M:%S"),
            "cut": cut,
            "values": [None if pd.isna(v) else round(float(v), 6) for v in s.values],
            "official": official,
        })
        print(f"{site}: {len(s)} slots, cut={cut}, valid={int(s.notna().sum())}")

    payload = {
        "source": "Putra, Holden & Baird (2021), University of Leeds, DOI 10.5518/960, CC BY 4.0",
        "unit": "cm (absolute water level relative to local benchmark)",
        "stepHours": 3,
        "loggers": loggers,
    }
    out.write_text("window.SYLVARIS_DATA = " + json.dumps(payload, separators=(",", ":")) + ";\n",
                   encoding="utf-8")
    print("written", out, out.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
