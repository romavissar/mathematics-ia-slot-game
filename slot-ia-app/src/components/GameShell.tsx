"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  NET_CHANGES,
  PROBABILITIES,
  START_BANKROLL,
  TARGET,
  RUIN,
  applyNetChange,
  isAbsorbed,
  outcomePatternLabel,
  spinTripleReels,
  type ReelSymbol,
} from "@/lib/iaModel";
import {
  THEORY_EXPECTED_LENGTH,
  THEORY_P_RUIN,
  THEORY_P_TARGET,
} from "@/lib/iaTheory";
import { getTable6Rows } from "@/lib/iaSummary";
import { SpinVisual } from "@/components/SpinVisual";

const TABLE_6_ROWS = getTable6Rows();

const ROLL_MS = 900;

export function GameShell() {
  const [bankroll, setBankroll] = useState(START_BANKROLL);
  const [isRolling, setIsRolling] = useState(false);
  const [lastReels, setLastReels] = useState<readonly [ReelSymbol, ReelSymbol, ReelSymbol] | null>(
    null,
  );
  const [spinCount, setSpinCount] = useState(0);
  /** Remount reels each spin so animation state starts clean. */
  const [spinVisualKey, setSpinVisualKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const absorbed = isAbsorbed(bankroll);
  const canSpin = !absorbed && !isRolling;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const newSession = useCallback(() => {
    clearTimer();
    setIsRolling(false);
    setBankroll(START_BANKROLL);
    setLastReels(null);
    setSpinCount(0);
  }, [clearTimer]);

  const runSpin = useCallback(() => {
    if (!canSpin) return;
    setSpinVisualKey((k) => k + 1);
    setIsRolling(true);
    setLastReels(null);
    clearTimer();
    timerRef.current = setTimeout(() => {
      const { reels, delta } = spinTripleReels();
      setBankroll((b) => applyNetChange(b, delta));
      setLastReels(reels);
      setSpinCount((n) => n + 1);
      setIsRolling(false);
      timerRef.current = null;
    }, ROLL_MS);
  }, [canSpin, clearTimer]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (absorbed) newSession();
        else runSpin();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [absorbed, newSession, runSpin]);

  const pct = (bankroll / TARGET) * 100;

  return (
    <div className="game-shell">
      <header className="game-shell__header">
        <h1 className="game-shell__title">IA bankroll slot</h1>
        <p className="game-shell__subtitle">
          Start {START_BANKROLL} · Ruin {RUIN} · Target {TARGET}
        </p>
      </header>

      <section className="table6-panel" aria-labelledby="table6-heading">
        <h2 id="table6-heading" className="table6-panel__title">
          Table 6: Summary of Probability Model
        </h2>
        <p className="table6-panel__note">
          X is gross return per unit wager (net bankroll change Δ = X − 1). Figures below are
          computed from the same per-spin P(Δ) as gameplay; rounded to match the IA table.
        </p>
        <table className="table6-panel__table">
          <thead>
            <tr>
              <th scope="col">Quantity</th>
              <th scope="col">Notation</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            {TABLE_6_ROWS.map((row) => (
              <tr key={row.description}>
                <td>{row.description}</td>
                <td className="table6-panel__notation">{row.notation}</td>
                <td className="table6-panel__value">{row.value.toFixed(row.decimals)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <SpinVisual key={spinVisualKey} isRolling={isRolling} reels={lastReels} />

      <div className="game-shell__meter-wrap">
        <div className="game-shell__meter-labels">
          <span>Bankroll</span>
          <span className="game-shell__meter-value">{bankroll}</span>
        </div>
        <div className="game-shell__meter" role="progressbar" aria-valuemin={0} aria-valuemax={TARGET} aria-valuenow={bankroll}>
          <div className="game-shell__meter-fill" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        <div className="game-shell__ticks">
          <span>{RUIN}</span>
          <span>{TARGET}</span>
        </div>
      </div>

      {absorbed && (
        <div className={`game-shell__banner ${bankroll >= TARGET ? "game-shell__banner--win" : "game-shell__banner--ruin"}`}>
          {bankroll >= TARGET ? "Target reached — session complete" : "Ruin — session complete"}
        </div>
      )}

      <div className="game-shell__actions">
        <button type="button" className="btn btn--spin" disabled={!canSpin} onClick={runSpin}>
          {isRolling ? "Spinning…" : "Spin"}
        </button>
        <button type="button" className="btn btn--ghost" onClick={newSession}>
          New session
        </button>
      </div>

      <p className="game-shell__meta">
        Spins this session: {spinCount}
        {lastReels && (
          <>
            {" "}
            · Last line: <strong>{lastReels.join("")}</strong>
          </>
        )}
      </p>

      <section className="theory-panel" aria-labelledby="theory-heading">
        <h2 id="theory-heading" className="theory-panel__title">
          IA reference (Markov chain)
        </h2>
        <p className="theory-panel__note">
          From B₀ = 100 with ruin at {RUIN} and target at {TARGET}. Not used for gameplay RNG.
        </p>
        <dl className="theory-panel__grid">
          <div>
            <dt>P(ruin before doubling)</dt>
            <dd>{THEORY_P_RUIN.toFixed(12)}</dd>
          </div>
          <div>
            <dt>P(double before ruin)</dt>
            <dd>{THEORY_P_TARGET.toFixed(12)}</dd>
          </div>
          <div>
            <dt>E[T] expected spins</dt>
            <dd>{THEORY_EXPECTED_LENGTH.toFixed(12)}</dd>
          </div>
        </dl>
        <table className="theory-panel__table" aria-label="Net change distribution">
          <caption className="theory-panel__caption">
            Per-spin net change Δ from three reels (triple wins only; mixed lines → −1).
          </caption>
          <thead>
            <tr>
              <th scope="col">Outcome</th>
              <th scope="col">Δ</th>
              <th scope="col">P(Δ)</th>
            </tr>
          </thead>
          <tbody>
            {NET_CHANGES.map((d, i) => (
              <tr key={d}>
                <td className="theory-panel__pattern">{outcomePatternLabel(d)}</td>
                <td>{d > 0 ? `+${d}` : `${d}`}</td>
                <td>{PROBABILITIES[i]!.toFixed(6)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
