"""
Monte Carlo simulation for Math AI HL IA slot-style bankroll model.

This script:
1) Runs a large batched Monte Carlo simulation for summary statistics.
2) Simulates a smaller sample of full bankroll paths for plotting.
3) Saves path plots and a session-length histogram.
4) Prints summary statistics and comparison vs Markov chain values.

Run:
    python3 monte_carlo_bankroll_paths.py
"""

from __future__ import annotations

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd


# ============================================================
# Editable simulation parameters
# ============================================================
num_paths = 1_000_000
max_steps = 20_000
starting_bankroll = 100
ruin_boundary = 0
target_bankroll = 200
random_seed = 42

# Number of full paths to draw on the bankroll chart images.
num_paths_to_plot = 200

# Batch size for the large simulation pass.
batch_size = 50_000

# Fixed model net changes and probabilities (do not change model)
net_changes = np.array([-1, 1, 19, 99], dtype=np.int16)
probabilities = np.array([0.602640, 0.389017, 0.008000, 0.000343], dtype=np.float64)

# Theoretical absorbing Markov chain values for B0=100, ruin=0, target=200
theory_p_ruin = 0.714307175964
theory_p_target = 0.285692824036
theory_expected_length = 1368.670182024205


def run_batched_simulation(
    n_paths: int,
    max_n_steps: int,
    b0: int,
    ruin: int,
    target: int,
    seed: int,
    sim_batch_size: int,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Run large Monte Carlo simulation in batches.

    We store only session-level outputs (length and outcome), not full paths,
    so this scales to very large numbers of sessions.

    Returns:
    - reached_target: bool array shape (n_paths,)
    - session_lengths: int array shape (n_paths,)
    """
    rng = np.random.default_rng(seed)
    reached_target = np.zeros(n_paths, dtype=bool)
    session_lengths = np.empty(n_paths, dtype=np.int32)

    for start in range(0, n_paths, sim_batch_size):
        end = min(start + sim_batch_size, n_paths)
        m = end - start

        bankroll = np.full(m, b0, dtype=np.int32)
        lengths = np.full(m, max_n_steps, dtype=np.int32)
        active = np.ones(m, dtype=bool)

        # Spin forward until everyone in batch absorbs or we hit max steps.
        for step in range(1, max_n_steps + 1):
            if not np.any(active):
                break

            active_idx = np.where(active)[0]

            # Sample one net change for each active session.
            delta = rng.choice(net_changes, size=active_idx.size, p=probabilities)

            # Update bankroll after the spin.
            bankroll[active_idx] += delta

            # Absorb if bankroll touches or crosses boundaries.
            ended_now = (bankroll[active_idx] <= ruin) | (bankroll[active_idx] >= target)
            ended_idx = active_idx[ended_now]
            lengths[ended_idx] = step
            active[ended_idx] = False

        reached_target[start:end] = bankroll >= target
        session_lengths[start:end] = lengths

    return reached_target, session_lengths


def simulate_paths_for_plot(
    n_paths_plot: int,
    max_n_steps: int,
    b0: int,
    ruin: int,
    target: int,
    seed: int,
) -> np.ndarray:
    """
    Simulate full bankroll trajectories for plotting only.

    Once a session absorbs, it is kept flat at the absorbing value
    for all remaining steps so all lines have equal length.
    """
    rng = np.random.default_rng(seed)
    paths = np.empty((n_paths_plot, max_n_steps + 1), dtype=np.int32)
    paths[:, 0] = b0

    active = np.ones(n_paths_plot, dtype=bool)

    for step in range(1, max_n_steps + 1):
        paths[:, step] = paths[:, step - 1]
        if not np.any(active):
            continue

        active_idx = np.where(active)[0]
        delta = rng.choice(net_changes, size=active_idx.size, p=probabilities)
        paths[active_idx, step] = paths[active_idx, step - 1] + delta

        ended_now = (paths[active_idx, step] <= ruin) | (paths[active_idx, step] >= target)
        active[active_idx[ended_now]] = False

    return paths


def save_paths_plot(
    paths: np.ndarray,
    filename: str,
    x_max: int | None = None,
) -> None:
    """Save a bankroll-path plot."""
    n_steps = paths.shape[1] - 1
    x = np.arange(n_steps + 1)
    if x_max is not None:
        x = x[: x_max + 1]
        y_data = paths[:, : x_max + 1]
    else:
        y_data = paths

    plt.figure(figsize=(12, 7))
    palette = plt.cm.tab20(np.linspace(0, 1, 20))
    for i in range(y_data.shape[0]):
        plt.plot(x, y_data[i], linewidth=0.7, alpha=0.35, color=palette[i % len(palette)])

    plt.axhline(ruin_boundary, linestyle="--", linewidth=1.2, color="red", label="Ruin boundary")
    plt.axhline(starting_bankroll, linestyle="--", linewidth=1.2, color="gray", label="Start bankroll")
    plt.axhline(target_bankroll, linestyle="--", linewidth=1.2, color="green", label="Target bankroll")
    plt.title("Monte Carlo Simulated Bankroll Paths")
    plt.xlabel("Number of Spins")
    plt.ylabel("Bankroll")
    plt.xlim(0, 2_500)
    plt.ylim(-100, 300)
    plt.grid(alpha=0.25)
    plt.legend(loc="upper right")
    plt.tight_layout()
    plt.savefig(filename, dpi=200)
    plt.close()


def save_length_histogram(lengths: np.ndarray, filename: str) -> None:
    """Save histogram of session lengths."""
    plt.figure(figsize=(10, 6))
    plt.hist(lengths, bins=60, color="tab:purple", alpha=0.85, edgecolor="white")
    plt.title("Distribution of Simulated Session Lengths")
    plt.xlabel("Session length in spins")
    plt.ylabel("Frequency")
    plt.grid(axis="y", alpha=0.25)
    plt.tight_layout()
    plt.savefig(filename, dpi=200)
    plt.close()


def main() -> None:
    print("Running large batched simulation...")
    reached_target, session_lengths = run_batched_simulation(
        n_paths=num_paths,
        max_n_steps=max_steps,
        b0=starting_bankroll,
        ruin=ruin_boundary,
        target=target_bankroll,
        seed=random_seed,
        sim_batch_size=batch_size,
    )

    ruined = ~reached_target

    p_ruin = float(np.mean(ruined))
    p_target = float(np.mean(reached_target))
    mean_len = float(np.mean(session_lengths))
    median_len = float(np.median(session_lengths))
    std_len = float(np.std(session_lengths, ddof=0))
    min_len = int(np.min(session_lengths))
    max_len = int(np.max(session_lengths))

    print("Simulating path sample for plotting...")
    plot_paths = simulate_paths_for_plot(
        n_paths_plot=num_paths_to_plot,
        max_n_steps=max_steps,
        b0=starting_bankroll,
        ruin=ruin_boundary,
        target=target_bankroll,
        seed=random_seed + 1,
    )

    save_paths_plot(plot_paths, "monte_carlo_bankroll_paths.png", x_max=None)
    save_paths_plot(plot_paths, "monte_carlo_bankroll_paths_zoom_500.png", x_max=500)
    save_length_histogram(session_lengths, "session_length_histogram.png")

    print("Monte Carlo Simulation Summary")
    print("-" * 40)
    print(f"Number of simulated sessions: {num_paths:,}")
    print(f"Number of paths shown in plot:{num_paths_to_plot:,}")
    print(f"Maximum spins per session:    {max_steps:,}")
    print(f"Probability of ruin:          {p_ruin:.12f}")
    print(f"Probability of reaching target:{p_target:.12f}")
    print(f"Mean session length:          {mean_len:.6f}")
    print(f"Median session length:        {median_len:.6f}")
    print(f"Std dev session length:       {std_len:.6f}")
    print(f"Minimum session length:       {min_len}")
    print(f"Maximum session length:       {max_len}")
    print()

    comparison_df = pd.DataFrame(
        [
            {
                "Measure": "P(ruin before doubling)",
                "Markov Chain Value": theory_p_ruin,
                "Monte Carlo Value": p_ruin,
                "Absolute Difference": abs(theory_p_ruin - p_ruin),
            },
            {
                "Measure": "P(double before ruin)",
                "Markov Chain Value": theory_p_target,
                "Monte Carlo Value": p_target,
                "Absolute Difference": abs(theory_p_target - p_target),
            },
            {
                "Measure": "Expected session length E[T]",
                "Markov Chain Value": theory_expected_length,
                "Monte Carlo Value": mean_len,
                "Absolute Difference": abs(theory_expected_length - mean_len),
            },
        ]
    )

    print("Comparison: Markov Chain vs Monte Carlo")
    print("-" * 40)
    print(comparison_df.to_string(index=False))
    print()
    print("Saved figures:")
    print(" - monte_carlo_bankroll_paths.png")
    print(" - monte_carlo_bankroll_paths_zoom_500.png")
    print(" - session_length_histogram.png")


if __name__ == "__main__":
    main()
