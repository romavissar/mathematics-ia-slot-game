/**
 * Table 6–style summary for the per-spin net change Δ (`iaModel.ts` / Python scripts).
 *
 * IA notation: gross return per unit wager X = 1 + Δ, so RTP = E[X] = 1 + E[Δ],
 * expected net gain = E[Δ] = E[X] − 1, hit frequency p = P(Δ > 0), 1 − p = P(Δ = −1).
 */

import { NET_CHANGES, PROBABILITIES } from "@/lib/iaModel";

function meanDelta(): number {
  let s = 0;
  for (let i = 0; i < NET_CHANGES.length; i++) {
    s += NET_CHANGES[i]! * PROBABILITIES[i]!;
  }
  return s;
}

function centralMoments() {
  const mu = meanDelta();
  let m2 = 0;
  let m3 = 0;
  for (let i = 0; i < NET_CHANGES.length; i++) {
    const d = NET_CHANGES[i]! - mu;
    const p = PROBABILITIES[i]!;
    const d2 = d * d;
    m2 += p * d2;
    m3 += p * d2 * d;
  }
  const sd = Math.sqrt(m2);
  const skew = sd > 0 ? m3 / (sd * sd * sd) : 0;
  return { mu, variance: m2, sd, skew };
}

/** P(Δ > 0) — hit / any positive net change. */
export function hitFrequency(): number {
  let s = 0;
  for (let i = 0; i < NET_CHANGES.length; i++) {
    if (NET_CHANGES[i]! > 0) s += PROBABILITIES[i]!;
  }
  return s;
}

export type Table6Row = {
  description: string;
  notation: string;
  value: number;
  decimals: number;
};

/** Rounded values matching IA “Table 6: Summary of Probability Model”. */
export function getTable6Rows(): Table6Row[] {
  const { mu, variance, sd, skew } = centralMoments();
  const pHit = hitFrequency();
  return [
    { description: "RTP", notation: "E[X]", value: 1 + mu, decimals: 3 },
    { description: "Expected Net Gain", notation: "E[X] − 1", value: mu, decimals: 3 },
    { description: "Volatility", notation: "Var[X]", value: variance, decimals: 2 },
    { description: "Standard Deviation", notation: "σ", value: sd, decimals: 2 },
    { description: "Skewness", notation: "γ₁", value: skew, decimals: 1 },
    { description: "Hit Frequency", notation: "p", value: pHit, decimals: 3 },
    { description: "Probability of no Payout", notation: "1 − p", value: 1 - pHit, decimals: 3 },
  ];
}
