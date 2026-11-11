"use client";

import { useEffect, useState } from "react";

/**
 * Whether the viewport is below the md breakpoint.
 *
 * Below 768 px the board stops being an input: its treble band is a handful
 * of pixels tall and a finger is far wider, so the board becomes a read-only
 * preview and the dart pad is the input.
 *
 * The rule lives here, in one place, because two different thresholds would
 * be a silent drift between the five match views.
 */
export function useIsCompact(): boolean {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setCompact(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return compact;
}
