"use client";

import { useEffect, useState } from "react";
import { sampleReelSymbol, type ReelSymbol } from "@/lib/iaModel";

type SpinVisualProps = {
  isRolling: boolean;
  /** Settled reel line after spin; null before first spin. */
  reels: readonly [ReelSymbol, ReelSymbol, ReelSymbol] | null;
};

function randomLine(): readonly [ReelSymbol, ReelSymbol, ReelSymbol] {
  return [sampleReelSymbol(), sampleReelSymbol(), sampleReelSymbol()];
}

const idlePlaceholder = ["A", "B", "C"] as const;

/**
 * Three reels; while spinning shows independent A/B/C samples.
 * When idle shows the actual line or ABC placeholder.
 */
export function SpinVisual({ isRolling, reels }: SpinVisualProps) {
  const [animLine, setAnimLine] = useState<readonly [ReelSymbol, ReelSymbol, ReelSymbol] | null>(
    null,
  );

  useEffect(() => {
    if (!isRolling) return;
    const tick = () => setAnimLine(randomLine());
    const t0 = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 70);
    return () => {
      clearTimeout(t0);
      clearInterval(id);
    };
  }, [isRolling]);

  const display: readonly [ReelSymbol, ReelSymbol, ReelSymbol] = isRolling
    ? (animLine ?? idlePlaceholder)
    : (reels ?? idlePlaceholder);

  return (
    <div className="spin-visual" aria-live="polite">
      <p className="spin-visual__hint">
        Three independent reels. <strong>AAA</strong> → +1, <strong>BBB</strong> → +19,{" "}
        <strong>CCC</strong> → +99; any other combination (ABA, CCA, BCC, …) → −1 to bankroll. Reel
        faces use the same per-symbol odds so overall P(Δ) matches the IA model.
      </p>
      <div className="spin-visual__reels" aria-label={`Reel line ${display.join("")}`}>
        {display.map((sym, i) => (
          <div
            key={i}
            className={`spin-visual__cell ${isRolling ? "spin-visual__cell--blur" : ""}`}
          >
            <span className="spin-visual__glyph">{sym}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
