# Reproducing SYLVARIS Benchmarks (V8, V8.1, & Strictly Split 50/20/30 Edge TinyML)

Pinned verification environment: Python `3.14.0`, `numpy==2.3.4`, `pandas==2.3.3`, `matplotlib==3.11.2`, `scikit-learn==1.9.1`.

## 1. Source Dataset & Native Missingness Integrity
- Putra, S. S., Holden, J., & Baird, A. J. (2021). *Water-level and rainfall data of Sebangau Tropical Peatland, Kalimantan, Indonesia*. Research Data Leeds Repository, University of Leeds (`doi: 10.5518/960`, CC BY 4.0). Source `leeds_readme.txt` records timestamps (`dd/mm/yyyy HH:MM`) without an explicit UTC offset tag.
- All 9 official logger series nested within 3 peatland settings (`Blocked`: BB1–BB3, `Drained`: AA1–AA3, `Forested`: AL0/AL1/AL5; `377.63` pooled logger-days in 30% evaluation tails; `39/3,021 = 1.29%` native missing 3-h slots) are SHA-256 hashed in `DATASET_MANIFEST.json` and bundled in `assets/data/loggers.js`.

## 2. Three-Tier Verification Architecture
| Tier | Scope Verified | Boundary / Caveat |
| :--- | :--- | :--- |
| **1. Dataset Integrity** | SHA-256 checksums, valid/missing counts (`DATASET_MANIFEST.json`) | Single 2019–2020 Sebangau campaign; timestamps lack explicit timezone offset |
| **2. Browser Replay (`72/72`)** | Web JS vs. Python parity across **4 baseline policies** (`Fixed_3h/6h`, `V6`, `Safety_V8`) × 9 loggers × 2 scenarios | Does **not** execute `V8_TinyML` or `Hybrid_Site6h+TinyML` in browser UI |
| **3. Python + Compiled C TinyML** | `0–50%` train weights + `50–70%` validation (`tau=0.60`) + `gcc -O2` compiled C execution of `tools/tinyml_gate.h` | Models `int8_t` stored weights with `float32` linear math & `expf()`; power unmeasured prior to Gate G1 |

## 3. Clean-Environment Reproduction Commands
```bash
pip install -r requirements.txt
python tools/v81_benchmark.py
python tools/threshold_sensitivity.py
```
`v81_benchmark.py` executes and prints:
1. Strict chronological `50%` Train (`0..50%`, 9-h boundary guard) / `20%` Validation (`50..70%`) / `30%` Retrospective Evaluation split (`PR-AUC`, `AUROC`, `Brier`, quartile calibration, `stride=1` & `no-clock` ablations, `tau` validation sweep), plus `gcc -O2` compiled C verification (`gate_only.o` `.text` size & Python-vs-C parity).
2. Disentangled causal ablation (`Fixed_3h` oracle-like grid bound, `Fixed_6h`, `Fixed_9h`, `Adaptive_V6`, `Safety_V8`, `V8_no_hold`, `V8_no_retry`, `V8_cap6h`, `Hybrid_Site6h` **without** TinyML, `V8_TinyML`, and `Hybrid_Site6h+TinyML`), directional (`Rapid Rise` vs `Rapid Fall`), and setting-wise splits.
3. Wilson 95% & 10,000-resample cluster bootstrap 95% CIs (explicitly within-campaign only).
4. Cutoff sweep (`3–6 cm`), 30-seed timestamp-matched observation loss (`q_k=0`), component-separated energy bounds (`E_sleep + E_sense_warmup + E_proc + E_LoRa_retx` across 3.3 V native vs. 4–20 mA boosted probes), 433 MHz link sweep (`≤12.15 dBm EIRP`), and itemized 24-month TCO.

## 4. Original Raw-CSV Archive Pipeline
Place raw Leeds CSVs inside `sylvaris/output_v7/leeds_official/` at repository root and run:
```bash
python tools/run_sylvaris_v8.py
python tools/build_data.py sylvaris/output_v7/leeds_official sylvaris/output_v8/v8_all_metrics.csv
```
