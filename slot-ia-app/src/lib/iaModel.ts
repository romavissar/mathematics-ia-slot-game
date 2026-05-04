/**
 * IA slot bankroll model — matches Python `monte_carlo_bankroll_paths.py` /
 * `absorbing_markov_chain.py` (fixed probabilities; do not change).
 *
 * Three independent reels with symbols A, B, C. Per reel,
 *   P(A) = ∛P(Δ=+1), P(B) = ∛P(Δ=+19), P(C) = ∛P(Δ=+99)
 * so P(AAA)=P(+1), P(BBB)=P(+19), P(CCC)=P(+99), and every other combination has Δ = −1.
 */

export const NET_CHANGES = [-1, 1, 19, 99] as const;

/** Payout net-change probabilities (IA Python scripts). */
export const PROBABILITIES = [0.60264, 0.389017, 0.008, 0.000343] as const;

export const START_BANKROLL = 100;
export const RUIN = 0;
export const TARGET = 200;

const probSum = PROBABILITIES.reduce((a, b) => a + b, 0);
if (Math.abs(probSum - 1) > 1e-9) {
  throw new Error(`IA probabilities must sum to 1, got ${probSum}`);
}

/** P(AAA), P(BBB), P(CCC) equal P(+1), P(+19), P(+99). */
const P_TRIPLE_A = PROBABILITIES[1]!;
const P_TRIPLE_B = PROBABILITIES[2]!;
const P_TRIPLE_C = PROBABILITIES[3]!;

/** Per-reel symbol probabilities (cube roots of triple win probabilities). */
export const REEL_P_A = Math.cbrt(P_TRIPLE_A);
export const REEL_P_B = Math.cbrt(P_TRIPLE_B);
export const REEL_P_C = Math.cbrt(P_TRIPLE_C);

const reelProbSum = REEL_P_A + REEL_P_B + REEL_P_C;
if (Math.abs(reelProbSum - 1) > 1e-9) {
  throw new Error(`Reel symbol probabilities must sum to 1, got ${reelProbSum}`);
}

/**
 * Uniform on [0, 1). Uses full 32 random bits — the previous 53-bit assembly used a
 * numerator bounded by ≈2^42 while dividing by 2^53, so u was always < 1/2048 and
 * only the Δ = −1 branch could fire.
 */
function randomU01(): number {
  const buf = new Uint32Array(1);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(buf);
    return buf[0]! / 4294967296;
  }
  return Math.random();
}

export type NetChange = (typeof NET_CHANGES)[number];

export type ReelSymbol = "A" | "B" | "C";

export type TripleSpinResult = {
  reels: readonly [ReelSymbol, ReelSymbol, ReelSymbol];
  /** Net bankroll change; −1 for any non-AAA/BBB/CCC combination. */
  delta: NetChange;
};

/** One reel stop: A, B, or C with IA-derived marginal probabilities. */
export function sampleReelSymbol(): ReelSymbol {
  const u = randomU01();
  if (u < REEL_P_A) return "A";
  if (u < REEL_P_A + REEL_P_B) return "B";
  return "C";
}

/** Full spin: three independent reels, then triple rule → same Δ law as inverse-CDF on NET_CHANGES. */
export function spinTripleReels(): TripleSpinResult {
  const a = sampleReelSymbol();
  const b = sampleReelSymbol();
  const c = sampleReelSymbol();
  const reels = [a, b, c] as const;
  if (a === "A" && b === "A" && c === "A") return { reels, delta: 1 };
  if (a === "B" && b === "B" && c === "B") return { reels, delta: 19 };
  if (a === "C" && b === "C" && c === "C") return { reels, delta: 99 };
  return { reels, delta: -1 };
}

/**
 * Apply one net change from bankroll `b`, same boundary rules as the Markov chain
 * (loss floor 0, wins cap at TARGET).
 */
export function applyNetChange(bankroll: number, delta: number): number {
  const next = bankroll + delta;
  if (delta < 0) {
    return Math.max(next, RUIN);
  }
  return Math.min(next, TARGET);
}

export function isAbsorbed(bankroll: number): boolean {
  return bankroll <= RUIN || bankroll >= TARGET;
}

/** Table / legend: winning line vs symbol. */
export function outcomePatternLabel(delta: number): string {
  switch (delta) {
    case 1:
      return "AAA";
    case 19:
      return "BBB";
    case 99:
      return "CCC";
    case -1:
      return "ABA, CCA, …";
    default:
      return "?";
  }
}
