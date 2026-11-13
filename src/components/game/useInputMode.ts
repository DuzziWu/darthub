"use client";

import { useCallback, useEffect, useState } from "react";
import type { InputMode } from "./InputModeSwitch";

/**
 * The input mode the player has chosen.
 *
 * The choice is remembered per mode, because the way a player enters darts
 * is a habit: the one who prefers the pad on the phone wants the pad on the
 * desktop too.
 *
 * The choice is a view concern only — it says which surface takes the tap,
 * never what the match state is.
 */
const STORAGE_KEY = "darthub:input-mode";

/** The mode a player gets when they have never chosen: the pad. */
const DEFAULT_MODE: InputMode = "manual";

function isInputMode(value: unknown): value is InputMode {
  return value === "board" || value === "manual";
}

export interface UseInputMode {
  readonly mode: InputMode;
  readonly setMode: (mode: InputMode) => void;
  /** Fired when the player switches the input mode. */
  readonly onChange: (mode: InputMode) => void;
}

export function useInputMode(): UseInputMode {
  const [mode, setMode] = useState<InputMode>(DEFAULT_MODE);

  // The stored choice is read after the first paint, so the server-rendered
  // page and the client agree and React does not report a mismatch.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isInputMode(stored)) setMode(stored);
    } catch {
      // A browser that refuses storage keeps the default.
    }
  }, []);

  const onChange = useCallback((next: InputMode) => {
    setMode(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // A browser that refuses storage simply forgets the choice.
    }
  }, []);

  return { mode, setMode, onChange };
}
