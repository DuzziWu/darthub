"use client";

import { DART_501_MATCH_FORMATS, X01MatchView } from "@/components/x01/X01MatchView";
import { AI_AVERAGE_LEVELS, DEFAULT_AI_AVERAGE } from "@/ai/averages";
import { outRuleChoices } from "@/game-engine/modes/registry";

/**
 * The 501 match: the board is the input, the dart pad is the accessible
 * equivalent, and the checkout rule is chosen at setup.
 *
 * The 501 is the mode with seats: two to four players, each of them a
 * person or the AI, and the order they play in is the order they were set
 * up in. It offers straight out and double out — master out is not part of
 * its scope, though the engine still knows the rule.
 */
export default function GamePage() {
  return (
    <X01MatchView
      startScore={501}
      modeName="501"
      minPlayers={2}
      outRuleChoices={outRuleChoices(["straight", "double"])}
      seatConfig={{ averages: AI_AVERAGE_LEVELS, defaultAverage: DEFAULT_AI_AVERAGE }}
      matchFormats={DART_501_MATCH_FORMATS}
    />
  );
}
