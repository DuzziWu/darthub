import { VisuallyHidden } from "@/components/ui/VisuallyHidden";

/**
 * The shell's footer.
 *
 * The shell owns the footer, not the pages: a page that rendered one of its
 * own would give the document two footer regions. It sits inside the shell's
 * `<main>`, whose bottom padding reserves the space the fixed mobile tab bar
 * occupies.
 */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-rule py-lg text-center font-caption text-caption text-ink-faint">
      <p>
        DartHub
        <VisuallyHidden> — the board, after dark.</VisuallyHidden>
      </p>
    </footer>
  );
}
