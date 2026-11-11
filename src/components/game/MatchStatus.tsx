"use client";

/**
 * The match's status line.
 *
 * One `aria-live="polite"` region per match screen, and it is always in the
 * document — a live region that is created at the same moment as its first
 * message is not announced by every screen reader.
 *
 * The line reads the same in all five modes: a caption under the score, not
 * a panel of its own.
 */
export function MatchStatus({ message }: { message: string }) {
  return (
    <p role="status" aria-live="polite" className="font-caption text-caption text-ink-muted">
      {message}
    </p>
  );
}
