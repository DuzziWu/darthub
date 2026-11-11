"use client";

import { X01MatchView } from "@/components/x01/X01MatchView";

/**
 * The 301 match: the same view as 501, starting from 301.
 */
export default function Game301Page() {
  return <X01MatchView startScore={301} modeName="301" />;
}
