import Link from "next/link";
import { MODE_RULES, sheetFootnote, type ModeRuleEntry } from "@/game-engine/modes/registry";

/**
 * The rule sheet — the ruled list of the game modes and the rules they are
 * played by.
 *
 * It is one component, rendered by the Game Center and by the home route:
 * both read the same mode registry, so the rules on the two pages can never
 * disagree with each other or with the engine.
 */

/** A rule that does not apply to a mode is shown as an em dash. */
const NOT_APPLICABLE = "—";

/** The rule columns of the sheet, in the order the sheet shows them. */
const RULE_COLUMNS = [
  { key: "start", label: "Start", className: "font-mono text-score-sm tabular-nums text-ink" },
  { key: "winCondition", label: "Win condition", className: "font-body text-body text-ink-muted" },
  { key: "checkout", label: "Checkout", className: "font-body text-body text-ink-muted" },
  { key: "targets", label: "Targets", className: "font-mono text-score-sm tabular-nums text-ink" },
] as const;

/** The column heads: a caption above the sheet, never a label inside it. */
const COLUMN_HEAD =
  "pb-lg text-left font-caption text-caption uppercase tracking-[0.04em] text-ink-faint";

/** A sheet line: a rule, never a card. */
const ROW = "border-b border-rule transition-colors duration-fast ease-out hover:bg-surface";

/**
 * The mode name is the row's only link, and it names its destination.
 *
 * It is the loudest thing in the row: the mode is what the player came to
 * choose, and the numbers beside it are supporting data.
 */
const MODE_LINK =
  "inline-flex min-h-11 min-w-11 items-center font-display text-heading font-semibold tracking-[0.01em] text-ink transition-colors duration-fast ease-out hover:text-brass focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink md:text-title";

export function RuleSheet() {
  return (
    <>
      {/* The sheet is a real table from the md breakpoint up. */}
      <table className="hidden w-full border-collapse md:table">
        <caption className="sr-only">Game modes and their rules</caption>
        <thead>
          <tr>
            <th scope="col" className={COLUMN_HEAD}>
              Mode
            </th>
            {RULE_COLUMNS.map((column) => (
              <th key={column.key} scope="col" className={COLUMN_HEAD}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MODE_RULES.map((rule) => (
            <tr key={rule.id} className={ROW}>
              <th scope="row" className="py-lg pr-lg text-left align-top">
                <ModeLink rule={rule} />
              </th>
              {RULE_COLUMNS.map((column) => (
                <td key={column.key} className={`py-lg pr-lg align-top ${column.className}`}>
                  {rule[column.key] ?? NOT_APPLICABLE}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Below the md breakpoint the same sheet becomes a stacked list. */}
      <dl className="md:hidden">
        {MODE_RULES.map((rule) => (
          <div key={rule.id} className="border-b border-rule py-lg">
            <dt>
              <ModeLink rule={rule} />
            </dt>
            <dd>
              <dl className="mt-md space-y-md">
                {RULE_COLUMNS.map((column) => (
                  <div key={column.key}>
                    <dt className="font-caption text-caption uppercase tracking-[0.04em] text-ink-faint">
                      {column.label}
                    </dt>
                    <dd className={`mt-xs ${column.className}`}>
                      {rule[column.key] ?? NOT_APPLICABLE}
                    </dd>
                  </div>
                ))}
              </dl>
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-2xl font-caption text-caption text-ink-faint">{sheetFootnote()}</p>
    </>
  );
}

/** The mode name is the row's only link, and its name states its destination. */
function ModeLink({ rule }: { rule: ModeRuleEntry }) {
  return (
    <Link href={rule.href} aria-label={`Play ${rule.name}`} className={MODE_LINK}>
      {rule.name}
    </Link>
  );
}
