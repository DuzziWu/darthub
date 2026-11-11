# Shell — Page Overrides

> **PROJECT:** DartHub
> **Page type:** App shell — header, navigation, skip link, landmarks
> **Overrides Master where stated.** For everything else, `design-system/darthub/MASTER.md` applies.

---

## 1. What this is

The frame every route sits in: the header, the navigation, the skip link, the landmarks,
and the mobile bottom tab bar. It is defined once, in `app/layout.tsx`, and it is
**identical on every page** — the nav does not move per page.

---

## 2. Structure

```tsx
// app/layout.tsx
<html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
  <body>
    <a href="#main" className="skip-link">
      Skip to main content
    </a>
    <SiteHeader />
    <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1440px] px-4 md:px-8">
      {children}
    </main>
  </body>
</html>
```

**The shell owns the `<main>` landmark.** Every route page renders its content as a
`<div>` — **never** a second `<main>`. Exactly one main landmark per route.

`tabIndex={-1}` on `<main>` is required. Without it, the skip link scrolls but focus does
not move, and the next `Tab` press continues from the header instead of the content.

---

## 3. The header

Sticky, 56 px, `bg-board`, `border-b border-rule`.

Sticky — not fixed — is what "reserve space" means here: a sticky header occupies its own
space in flow, so content is never hidden behind it and no padding hack is needed.

| Element         | Spec                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------- |
| Wordmark        | `font-display` 700, `text-ink`, letter-spacing `0.08em`, uppercase. **The "D" is brass.** |
| Nav             | Right-aligned. 44 px minimum target height.                                               |
| Nav link        | `font-label` `text-label`, `text-ink-muted` → hover `text-ink` at 120 ms.                 |
| Active nav link | `text-ink` + a **2 px brass underline** on the bottom edge, and `aria-current="page"`.    |

**The current location is never marked by colour alone** — it has the underline _and_
`aria-current="page"` _and_ a weight change.

---

## 4. The navigation

**Exactly five destinations**, and every one of them must exist as a route — a nav link
to a 404 is a broken product.

| Destination | Route          | Icon (Lucide)     |
| ----------- | -------------- | ----------------- |
| Game Center | `/game-center` | `Target`          |
| Lobby       | `/lobby`       | `Users`           |
| Career      | `/career`      | `Map`             |
| Dashboard   | `/dashboard`   | `LayoutDashboard` |

The fifth destination is the **home route** (`/`), which is reached through the **wordmark**
— the wordmark is the home link. That keeps the header at four nav items plus the
wordmark, and the mobile tab bar at five.

**The nav is identical on every page.** It does not move, reorder or resize per route.

**Icons:** one Lucide family, 2 px stroke, round caps and joins, sized by token
(`--icon-md` = 20 px for nav). Decorative icons beside visible text are `aria-hidden="true"`;
the icon-only case, if one arises, gets an `aria-label`.

---

## 5. The skip link

The **first focusable element** in the document. Visually hidden until focused; on focus
it becomes a visible `bg-brass text-board` bar at the top-left, `z-60`.

It targets `#main`, and activating it **moves focus** to the main landmark — not merely
scrolls to it. `tabIndex={-1}` on `<main>` is what makes that possible.

---

## 6. The mobile bottom tab bar

At **< 768 px** the nav collapses to a bottom tab bar: up to **5 destinations**, icon +
label, `bg-board`, `border-t border-rule`, **64 px tall plus the safe-area inset**.

At that width the header collapses to the wordmark alone.

**The tab bar's height must be reserved as padding on the shell's `<main>`**, or it covers
the last row of content. The reservation applies **only below 768 px**, since the bar does
not exist above it.

The tab bar is a `<nav aria-label="Primary">` containing a `<ul>`. Each item is a link
with an icon and a label — the label is always visible (never icon-only), so no tab needs
an `aria-label` to be understood.

**The active tab** carries the same brass treatment as the desktop nav link: brass fill on
the icon plus `aria-current="page"`.

---

## 7. Landmarks

| Landmark                     | Owner                                                                                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<header>`                   | the shell                                                                                                                                                  |
| `<nav aria-label="Primary">` | the shell (desktop header nav **and** the mobile tab bar are two navs; the second is `<nav aria-label="Primary">` too, but only one is rendered at a time) |
| `<main id="main">`           | the shell                                                                                                                                                  |
| `<footer>`                   | the shell                                                                                                                                                  |

**One `<h1>` per page, no level skips.**

---

## 8. Reduced motion

`prefers-reduced-motion: reduce` collapses all durations to `0.01ms` and all loops to 1.
This is a **hard requirement** — there is no such rule anywhere in the codebase today.

**Nothing in the shell depends on an animation ending to become correct.** The nav, the
skip link and the tab bar are all correct in their final state instantly.

---

## 9. Accessibility floor

- Text contrast ≥ 4.5:1 using `--color-ink` on `--color-board` / `--color-surface`.
- **Focus rings are visible on every interactive element and are never removed.** The house
  ring is `outline: 2px solid var(--color-ink); outline-offset: 2px` — cream, never brass
  (brass-on-brass measures 1.0:1 and is invisible).
- Interactive targets ≥ 44×44 px with ≥ 8 px separation.
- Logical focus order matching visual order.
- Focus is never obscured by the sticky header or the bottom tab bar — content gets
  `scroll-margin-top` matching the header height.
- **Focus moves to `<main>` on navigation**, so a screen-reader user starts at the content
  rather than re-reading the nav.

---

## 10. Anti-patterns for the shell

- ❌ A nav link to a route that does not exist
- ❌ The nav changing between pages
- ❌ A `fixed` header with no space reserved
- ❌ A mobile tab bar that covers the last row of content
- ❌ An icon-only nav item with no accessible name
- ❌ `focus:outline-none`
- ❌ A second `<main>` from a page
- ❌ A skip link that scrolls but does not move focus
- ❌ A bottom tab bar with more than 5 items — the targets would drop below 44 px
