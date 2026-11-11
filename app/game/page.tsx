"use client";

import { X01MatchView } from "@/components/x01/X01MatchView";

/**
 * The 501 match: the board is the input, the dart pad is the accessible
 * equivalent, and the checkout rule is chosen at setup.
 */
export default function GamePage() {
  return <X01MatchView startScore={501} modeName="501" />;
}
