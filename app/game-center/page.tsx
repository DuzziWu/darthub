import { RuleSheet } from "@/components/game/RuleSheet";

/**
 * The Game Center: a ruled sheet of the game modes and the rules they are
 * played by.
 *
 * Every rule value is read from the mode registry, so the sheet can never
 * describe a rule the engine does not implement. The sheet itself is the
 * shared component the home route renders too.
 */
export default function GameCenterPage() {
  return (
    <div className="mx-auto w-full max-w-[900px] space-y-2xl py-xl xl:max-w-[1200px]">
      <header className="space-y-xs">
        {/* The heading steps down below 1280, where the sheet narrows with it. */}
        <h1 className="font-display text-title font-bold uppercase tracking-[-0.01em] text-ink xl:text-display">
          Game Center
        </h1>
        <p className="font-body text-body text-ink-muted">
          Five ways to play. Each mode has its own rules — pick by the rules, not the colour.
        </p>
      </header>

      <RuleSheet />
    </div>
  );
}
