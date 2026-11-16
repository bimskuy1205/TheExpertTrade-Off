from pathlib import Path
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

# ============================================================
# CONFIGURATION
# ============================================================

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "sylvaris" / "output_v7" / "leeds_official"
OUT = ROOT / "sylvaris" / "output_v8"
OUT.mkdir(parents=True, exist_ok=True)

EVENT_CM = 5.0
GAP_H = 6.0
MATCH_H = 6.0

# Illustrative energy assumptions, not hardware measurements
SLEEP_MA = 0.12
READ_MAH = 0.12
DECISION_MAH = 0.01

LOGGERS = [
    ("blocked", "BB1"),
    ("blocked", "BB2"),
    ("blocked", "BB3"),
    ("drained", "AA1"),
    ("drained", "AA2"),
    ("drained", "AA3"),
    ("forested", "AL0"),
    ("forested", "AL1"),
    ("forested", "AL5"),
]

# Original V6 configurations, frozen for comparison
V6_CONFIG = {
    "blocked": {
        "fast": 5.0,
        "medium": 1.0,
        "max_slots": 3
    },
    "drained": {
        "fast": 5.0,
        "medium": 0.5,
        "max_slots": 4
    },
    "forested": {
        "fast": 2.0,
        "medium": 1.0,
        "max_slots": 4
    }
}

POLICIES = [
    "Fixed_3h",
    "Fixed_6h",
    "Adaptive_V6",
    "Safety_V8"
]


# ============================================================
# LOAD ORIGINAL DATA
# ============================================================

def load_data(path):
    raw = pd.read_csv(path, na_values=["-", ""])
    raw.columns = [str(x).strip() for x in raw.columns]

    column = "absolute water-level (cm)"

    if "date" not in raw or column not in raw:
        raise ValueError(
            f"Unexpected columns in {path.name}"
        )

    data = pd.DataFrame({
        "date": pd.to_datetime(
            raw["date"],
            format="%d/%m/%Y %H:%M",
            errors="coerce"
        ),
        "value": pd.to_numeric(
            raw[column],
            errors="coerce"
        )
    }).dropna()

    counts = data.groupby("date")["value"].nunique()
    conflicts = counts[counts > 1].index

    data = data.loc[
        ~data["date"].isin(conflicts)
    ]

    data = (
        data.drop_duplicates("date")
        .sort_values("date")
    )

    if data.empty:
        raise ValueError("No valid observations")

    return (
        data.set_index("date")["value"]
        .resample("3h")
        .mean()
    )


# ============================================================
# EVENT REFERENCE
# ============================================================

def group_events(times):
    groups = []

    for t in sorted(times):
        if (
            not groups
            or (t - groups[-1][-1]).total_seconds()
            / 3600 > GAP_H
        ):
            groups.append([t])
        else:
            groups[-1].append(t)

    return [g[0] for g in groups]


def reference_events(series):
    previous = series.shift(1)

    mask = (
        series.notna()
        & previous.notna()
        & (series - previous).abs().ge(EVENT_CM)
    )

    return group_events(
        list(series.index[mask])
    )


# ============================================================
# SAMPLING CONTROLLER
# ============================================================

def simulate(series, policy, group, fault_every=0):

    config = V6_CONFIG[group]

    last_value = None
    last_time = None

    next_slot = 0
    reads = 0
    decisions = 0
    failures = 0

    fast_hold = 0
    raw_alarms = []

    for i, timestamp in enumerate(series.index):

        if i < next_slot:
            continue

        reads += 1

        # Deterministic simulated sensor failure
        injected_failure = bool(
            fault_every
            and reads % fault_every == 0
        )

        value = (
            np.nan
            if injected_failure
            else series.iloc[i]
        )

        if injected_failure:
            failures += 1

        if policy == "Fixed_3h":
            slots = 1

        elif policy == "Fixed_6h":
            slots = 2

        else:
            decisions += 1
            slots = 1

        if pd.notna(value):

            rate = None

            if last_value is not None:

                elapsed = (
                    timestamp - last_time
                ).total_seconds() / 3600

                if elapsed > 0:

                    change = abs(
                        float(value) - last_value
                    )

                    rate = change * 3 / elapsed

                    # Hydrological change alarm
                    if change >= EVENT_CM:
                        raw_alarms.append(timestamp)

            # --------------------------------------------
            # ORIGINAL V6 ADAPTIVE POLICY
            # --------------------------------------------

            if policy == "Adaptive_V6":

                if (
                    rate is None
                    or rate >= config["fast"]
                ):
                    slots = 1

                elif rate >= config["medium"]:
                    slots = 2

                else:
                    slots = config["max_slots"]

            # --------------------------------------------
            # NEW V8 SAFETY-AWARE POLICY
            # --------------------------------------------

            elif policy == "Safety_V8":

                # Engineering hypothesis:
                # Faster monitoring after observed change.
                if rate is None or rate >= 2.0:
                    fast_hold = 2

                if fast_hold > 0:
                    slots = 1
                    fast_hold -= 1

                elif rate >= 0.8:
                    slots = 2

                else:
                    slots = 3

            last_value = float(value)
            last_time = timestamp

        else:

            # Retry soon if sensor reading is missing
            if policy in ("Adaptive_V6", "Safety_V8"):
                slots = 1

                if policy == "Safety_V8":
                    fast_hold = 2

        next_slot = i + slots

    alarms = group_events(raw_alarms)

    duration_h = len(series) * 3

    energy = (
        duration_h * SLEEP_MA
        + reads * READ_MAH
        + decisions * DECISION_MAH
    )

    return alarms, reads, decisions, failures, energy


# ============================================================
# EVALUATION
# ============================================================

def evaluate(series, policy, group, fault_every=0):

    refs = reference_events(series)

    alarms, reads, decisions, failures, energy = simulate(
        series,
        policy,
        group,
        fault_every
    )

    unmatched = set(range(len(alarms)))
    delays = []

    for event in refs:

        options = [
            i for i in unmatched
            if 0 <= (
                alarms[i] - event
            ).total_seconds() / 3600 <= MATCH_H
        ]

        if options:

            selected = min(
                options,
                key=lambda i: alarms[i]
            )

            unmatched.remove(selected)

            delays.append(
                (
                    alarms[selected] - event
                ).total_seconds() / 3600
            )

    tp = len(delays)
    fp = len(alarms) - tp
    fn = len(refs) - tp

    precision = (
        tp / (tp + fp)
        if tp + fp
        else np.nan
    )

    recall = (
        tp / (tp + fn)
        if tp + fn
        else np.nan
    )

    f1 = (
        2 * tp / (2 * tp + fp + fn)
        if 2 * tp + fp + fn
        else np.nan
    )

    return {
        "events": len(refs),
        "TP": tp,
        "FP": fp,
        "FN": fn,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "mean_delay_h": (
            float(np.mean(delays))
            if delays
            else np.nan
        ),
        "scheduled_reads": reads,
        "injected_failures": failures,
        "decisions": decisions,
        "energy_mAh_sim": energy
    }


# ============================================================
# MAIN
# ============================================================

def main():

    print()
    print("=" * 65)
    print("SYLVARIS V8 - SAFETY-AWARE CONTROLLER")
    print("=" * 65)
    print("Dataset:", DATA)
    print("Output:", OUT)
    print()

    results = []
    errors = []

    for group, sensor in LOGGERS:

        site = f"{group}_{sensor}"

        path = DATA / f"{group}_auto_wl_{sensor}.csv"

        if not path.exists():

            errors.append({
                "site": site,
                "error": "CSV not found"
            })

            print("MISSING:", site)
            continue

        try:

            full = load_data(path)

            # Use last 30% for retrospective analysis.
            cut = int(len(full) * 0.70)
            test = full.iloc[cut:]

            for fault_every in (0, 17):

                scenario = (
                    "nominal"
                    if fault_every == 0
                    else "every_17th_read_fails"
                )

                for policy in POLICIES:

                    metrics = evaluate(
                        test,
                        policy,
                        group,
                        fault_every
                    )

                    results.append({
                        "site": site,
                        "group": group,
                        "scenario": scenario,
                        "policy": policy,
                        "test_start": str(test.index.min()),
                        "test_end": str(test.index.max()),
                        **metrics
                    })

            print(
                "OK:",
                site,
                "| episodes:",
                len(reference_events(test))
            )

        except Exception as error:

            errors.append({
                "site": site,
                "error": repr(error)
            })

            print("ERROR:", site, error)

    pd.DataFrame(
        errors,
        columns=["site", "error"]
    ).to_csv(OUT / "errors.csv", index=False)

    if not results:
        print("No results. Check original V7 CSV files.")
        return

    df = pd.DataFrame(results)

    df.to_csv(
        OUT / "v8_all_metrics.csv",
        index=False
    )

    comparisons = []

    for (site, scenario), group in df.groupby(
        ["site", "scenario"]
    ):

        p3 = group.loc[
            group.policy == "Fixed_3h"
        ].iloc[0]

        p6 = group.loc[
            group.policy == "Fixed_6h"
        ].iloc[0]

        v6 = group.loc[
            group.policy == "Adaptive_V6"
        ].iloc[0]

        v8 = group.loc[
            group.policy == "Safety_V8"
        ].iloc[0]

        comparisons.append({
            "site": site,
            "scenario": scenario,
            "events": int(v8.events),

            "fixed6_recall": p6.recall,
            "v6_recall": v6.recall,
            "v8_recall": v8.recall,

            "fixed6_f1": p6.f1,
            "v8_f1": v8.f1,

            "v8_recall_delta_vs_fixed6":
                v8.recall - p6.recall,

            "v8_f1_delta_vs_fixed6":
                v8.f1 - p6.f1,

            "v8_energy_saving_vs_fixed3_pct":
                100 * (
                    1 - v8.energy_mAh_sim
                    / p3.energy_mAh_sim
                ),

            "v8_energy_saving_vs_fixed6_pct":
                100 * (
                    1 - v8.energy_mAh_sim
                    / p6.energy_mAh_sim
                ),

            "v8_reads": int(v8.scheduled_reads),

            "injected_failures":
                int(v8.injected_failures)
        })

    summary = pd.DataFrame(comparisons)

    summary.to_csv(
        OUT / "v8_comparison.csv",
        index=False
    )

    nominal = summary.loc[
        summary.scenario == "nominal"
    ]

    stressed = summary.loc[
        summary.scenario != "nominal"
    ]

    print()
    print("=" * 65)
    print("NOMINAL V8 VS FIXED 6H")
    print("=" * 65)

    columns = [
        "site",
        "events",
        "fixed6_recall",
        "v8_recall",
        "v8_f1",
        "v8_energy_saving_vs_fixed3_pct",
        "v8_energy_saving_vs_fixed6_pct"
    ]

    print(
        nominal[columns]
        .round(4)
        .to_string(index=False)
    )

    print()
    print("=" * 65)
    print("SYNTHETIC SENSOR-FAILURE SCENARIO")
    print("=" * 65)

    columns_fault = [
        "site",
        "events",
        "fixed6_recall",
        "v8_recall",
        "v8_energy_saving_vs_fixed6_pct",
        "injected_failures"
    ]

    print(
        stressed[columns_fault]
        .round(4)
        .to_string(index=False)
    )

    # ========================================================
    # GRAPH
    # ========================================================

    fig, ax = plt.subplots(figsize=(9, 5.5))

    for _, row in nominal.iterrows():

        x = row.v8_energy_saving_vs_fixed6_pct
        y = row.v8_recall_delta_vs_fixed6

        if pd.notna(x) and pd.notna(y):

            ax.scatter(x, y, s=55)

            ax.annotate(
                row.site,
                (x, y),
                xytext=(5, 4),
                textcoords="offset points",
                fontsize=8
            )

    ax.axhline(0, linestyle="--", linewidth=1)
    ax.axvline(0, linestyle="--", linewidth=1)

    ax.set_xlabel(
        "V8 simulated energy saving vs Fixed 6h (%)"
    )

    ax.set_ylabel(
        "V8 recall difference vs Fixed 6h"
    )

    ax.set_title(
        "SYLVARIS V8: Energy vs Hydrological Detection"
    )

    ax.grid(alpha=0.25)
    fig.tight_layout()

    fig.savefig(
        OUT / "v8_energy_recall.png",
        dpi=220
    )

    plt.close(fig)

    limitations = """
SYLVARIS V8 - SCIENTIFIC LIMITATIONS

1. This is retrospective evaluation, not an independent holdout.
2. V7 loggers were previously inspected.
3. Reference episodes are heuristic hydrological changes.
4. No wildfire labels are available.
5. Fixed 3h shares its event definition with the reference.
6. Cumulative alarms differ from the 3-hour reference rule.
7. Energy assumptions are illustrative, not physical measurements.
8. Fault injection occurs every 17th scheduled read.
9. Fault timing therefore differs across sampling policies.
10. No deployed TinyML or hardware feasibility is proven.
11. Do not retune the policy using these same test results
    and then claim independent validation.
"""

    (OUT / "LIMITATIONS.txt").write_text(
        limitations.strip(),
        encoding="utf-8"
    )

    print()
    print("=" * 65)
    print("SYLVARIS V8 FINISHED")
    print("=" * 65)
    print("Results saved at:", OUT.resolve())


if __name__ == "__main__":
    main()
