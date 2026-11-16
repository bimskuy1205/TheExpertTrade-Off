# Reproducing SYLVARIS Benchmarks (V8 & V8.1)

## 1. Source Dataset & Integrity Manifest
- Putra, S. S., Holden, J., & Baird, A. J. (2021). *Water-level and rainfall data of Sebangau Tropical Peatland, Kalimantan, Indonesia*. Research Data Leeds Repository, University of Leeds (`doi: 10.5518/960`, CC BY 4.0).
- All 9 official logger series nested across 3 peatland settings (`Blocked`: BB1–BB3, `Drained`: AA1–AA3, `Forested`: AL0/AL1/AL5; `377.63` pooled logger-days in the 30% test tails) are hashed in `DATASET_MANIFEST.json` and bundled after 3-h resampling inside `assets/data/loggers.js`.

## 2. Reproduce All V8.1 Experiments (Zero External Downloads Needed)
```bash
pip install -r requirements.txt
python tools/v81_benchmark.py
python tools/threshold_sensitivity.py
```
`v81_benchmark.py` outputs: (1) setting-wise breakdown, (2) exploratory ablation study, (3) Wilson & 10,000-resample cluster bootstrap 95% confidence intervals, (4) timestamp-matched fault sensitivity across 30 paired random seeds, and (5) decomposed energy/solar/RF/24-month TCO calculations.

## 3. Original Raw-CSV Archive Pipeline
Place raw Leeds CSVs inside `sylvaris/output_v7/leeds_official/` and execute:
```bash
python tools/run_sylvaris_v8.py
python tools/build_data.py <leeds_official_dir> <v8_all_metrics.csv>
```
