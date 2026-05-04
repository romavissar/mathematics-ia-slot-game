import numpy as np


def main() -> None:
    # ----------------------------
    # Model setup
    # ----------------------------
    max_state = 200
    transient_states = np.arange(1, max_state)  # 1..199
    n_states = max_state + 1  # 0..200

    # Payout-based net-change probabilities
    p_minus_1 = 0.602640
    p_plus_1 = 0.389017
    p_plus_19 = 0.008000
    p_plus_99 = 0.000343

    # ----------------------------
    # 1-3) Build full transition matrix P (201 x 201)
    # ----------------------------
    P = np.zeros((n_states, n_states), dtype=float)

    # 2) Absorbing states
    P[0, 0] = 1.0
    P[200, 200] = 1.0

    # 3) Transient state transitions
    for i in transient_states:
        P[i, max(i - 1, 0)] += p_minus_1
        P[i, min(i + 1, 200)] += p_plus_1
        P[i, min(i + 19, 200)] += p_plus_19
        P[i, min(i + 99, 200)] += p_plus_99

    # ----------------------------
    # 4) Row-sum check
    # ----------------------------
    row_sums = P.sum(axis=1)
    row_sum_min = row_sums.min()
    row_sum_max = row_sums.max()
    rows_allclose_1 = np.allclose(row_sums, 1.0, atol=1e-12)

    # ----------------------------
    # 5) Extract Q (states 1..199 to 1..199)
    # 6) Extract R (states 1..199 to absorbing states [0, 200])
    # ----------------------------
    transient_idx = np.arange(1, 200)  # python indices for bankroll states 1..199
    absorbing_idx = np.array([0, 200])  # ruin, doubled

    Q = P[np.ix_(transient_idx, transient_idx)]  # 199 x 199
    R = P[np.ix_(transient_idx, absorbing_idx)]  # 199 x 2

    # ----------------------------
    # 7) Fundamental matrix N = (I - Q)^(-1)
    # ----------------------------
    I = np.eye(Q.shape[0], dtype=float)
    N = np.linalg.inv(I - Q)

    # ----------------------------
    # 8) Expected session lengths t = N @ ones
    # ----------------------------
    ones = np.ones((Q.shape[0], 1), dtype=float)
    t = N @ ones  # 199 x 1

    # ----------------------------
    # 9) Absorption probabilities A = N @ R
    #    Column 0 -> absorb at state 0 (ruin)
    #    Column 1 -> absorb at state 200 (double)
    # ----------------------------
    A = N @ R  # 199 x 2

    # ----------------------------
    # 10) Results for B0 = 100
    #     transient index mapping: state 100 -> index 99
    # ----------------------------
    b0_state = 100
    b0_index = b0_state - 1  # 99

    p_ruin = A[b0_index, 0]
    p_double = A[b0_index, 1]
    expected_length = t[b0_index, 0]

    # ----------------------------
    # Reporting
    # ----------------------------
    print("Absorbing Markov Chain Results (No Monte Carlo)")
    print("-" * 52)
    print("Matrix dimensions:")
    print(f"  P: {P.shape}")
    print(f"  Q: {Q.shape}")
    print(f"  R: {R.shape}")
    print(f"  N: {N.shape}")
    print(f"  t: {t.shape}")
    print(f"  A: {A.shape}")
    print()

    print("Row-sum check for P (each row should sum to 1):")
    print(f"  min(row_sum) = {row_sum_min:.12f}")
    print(f"  max(row_sum) = {row_sum_max:.12f}")
    print(f"  all rows close to 1? -> {rows_allclose_1}")
    print()

    print("Short calculation notes:")
    print("  - Q contains transient->transient transitions for bankroll states 1..199.")
    print("  - R contains transient->absorbing transitions into states 0 and 200.")
    print("  - N=(I-Q)^(-1) gives expected visit counts to transient states before absorption.")
    print("  - t=N@1 gives expected number of spins until absorption.")
    print("  - A=N@R gives absorption probabilities for ruin vs doubling.")
    print()

    print("Final results for starting bankroll B0 = 100 (transient index 99):")
    print("+-----------------------------+------------------+")
    print("| Quantity                    | Value            |")
    print("+-----------------------------+------------------+")
    print(f"| P(ruin before doubling)     | {p_ruin:0.12f} |")
    print(f"| P(double before ruin)       | {p_double:0.12f} |")
    print(f"| Expected session length E[T]| {expected_length:0.12f} |")
    print("+-----------------------------+------------------+")


if __name__ == "__main__":
    main()
