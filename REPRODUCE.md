# Reproducing SYLVARIS Benchmarks (V8 & V8.1 + Edge TinyML)

## 1. Source Dataset & Integrity Manifest
- Putra, S. S., Holden, J., & Baird, A. J. (2021). *Water-level and rainfall data of Sebangau Tropical Peatland, Kalimantan, Indonesia*. Research Data Leeds Repository, University of Leeds (`doi: 10.5518/960`, CC BY 4.0).
- All 9 official logger series nested across 3 peatland settings (`Blocked`: BB1–BB3, `Drained`: AA1–AA3, `Forested`: AL0/AL1/AL5; `377.63` pooled logger-days in the 30% test tails) are hashed in `DATASET_MANIFEST.json` and bundled after 3-h resampling inside `assets/data/loggers.js`.

## 2. Reproduce All Paper Tables, Figures & ESP32-S3 TinyML Weights
```bash
pip install -r requirements.txt
python tools/v81_benchmark.py
python tools/threshold_sensitivity.py
```
`v81_benchmark.py` executes and prints all 6 validation modules:
1. 70% training hydrological calm/surge signature + strictly train-fitted `int8` TinyML Gate (`C=0.01`, `tau=0.60`), auto-exporting `tools/tinyml_gate.h` (12 `int8_t` weights, 12 MACs/wake).
2. Setting-wise breakdown (`Blocked`, `Drained`, `Forested`) & exploratory ablation (`Fixed_3h` oracle-like 3-h grid reference, `Fixed_6h`, `Fixed_9h`, `Adaptive_V6`, `Safety_V8`, `V8_no_hold`, `V8_no_retry`, `V8_cap6h`, `V8_TinyML`, `Hybrid_Site6h`, `Hybrid_Site6h+TinyML`).
3. Wilson 95% CI & 10,000-resample cluster logger bootstrap 95% confidence intervals.
4. Exploratory cutoff sensitivity sweep (`3.0, 4.0, 5.0, 6.0 cm`).
5. Timestamp-matched fault injection (`1%, 5%, 10%` i.i.d. across 30 paired random seeds, `9 h` burst outage, and direct onset corruption).
6. Decomposed energy (`Cases A–C` & extreme 95% solar shading), `12.15 dBm` legal EIRP radio margins, and 24-month 10-node TCO.

## 3. Original Raw-CSV Archive Pipeline
Place raw Leeds CSVs inside `sylvaris/output_v7/leeds_official/` at the repository root and execute:
```bash
python tools/run_sylvaris_v8.py
python tools/build_data.py sylvaris/output_v7/leeds_official sylvaris/output_v8/v8_all_metrics.csv
```
