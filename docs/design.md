# Branding & Design

## Palette — editorial (Vaimo × Byredo)

Warm cream paper, near-black ink, hairline stone rules, one ochre accent used sparingly. Legacy grey-\*/yellow tokens still exist as aliases so pre-refresh code keeps working.

| Token | Value | Usage |
|---|---|---|
| `--color-paper` | `#f7f4ec` | Page background |
| `--color-paper-alt` | `#efeadb` | Sidebar highlights, secondary surfaces |
| `--color-card` | `#fdfbf6` | Article ground, popover surfaces |
| `--color-ink-90` | `#0f0e0b` | Body ink (never pure black) |
| `--color-ink-70` | `#3a362e` | Body copy default |
| `--color-ink-40` | `#857e6d` | Muted labels, timestamps |
| `--color-rule` | `#d6cfba` | Hairline borders, dividers |
| `--color-rule-soft` | `#e7e1cf` | Subtle inset lines |
| `--color-accent` | `#f4b301` | Ochre — CTAs, active nav, marker colour |
| `--color-accent-ink` | `#7a5300` | Accent-tone text on cream surfaces |
| `--color-accent-tint` | `#fff1c2` | Active-row background, status badge fill |
| `--color-ink-invert` | `#fbf7ec` | Text on ink-90 backgrounds |

### Legacy aliases

These map onto the new tokens so older component styles keep working:

| Legacy | Now points to |
|---|---|
| `--color-grey-900` | `--color-ink-90` |
| `--color-grey-700` | `--color-ink-70` |
| `--color-grey-500` | `--color-ink-40` |
| `--color-grey-300` | `--color-rule` |
| `--color-grey-100` | `--color-paper-alt` |
| `--color-yellow` | `--color-accent` |
| `--color-white` | `--color-card` |

## Typography

Loaded via `next/font/google` in `app/layout.tsx` and exposed as CSS variables — pick the right one per element, never fall back to system defaults for anything user-facing.

| Family | Variable | Usage |
|---|---|---|
| **Fraunces** (variable serif, `opsz` + `SOFT` axes) | `--font-serif` | Display type: article headings, frontmatter title/description, sign-in headline, italic emphasis in the sidebar sign-in. |
| **DM Sans** | `--font-sans` | Body copy, labels, sidebar, buttons, small caps. |
| **JetBrains Mono** | `--font-mono` | Inline `code`, code blocks, timestamps in the branch dropdown, file names in the header. |

Base size: 16px. Body line-height 1.75. Fraunces headings use optical sizing (`opsz` at 36–144 depending on level) and a slight softness (`SOFT` 20–30) so display type has some warmth without becoming decorative.

## Layout Principles

- Generous whitespace; no cramped layouts. The article column fills the main pane (no fixed max-width) — long paragraphs are allowed to be wider than 800px because tables and diagrams need the room.
- Sidebar: 338px default on desktop, drag-resizable between 140px and 800px, full-screen overlay on mobile.
- Content padding: `1.5rem 2.5rem 4rem` around `<main>`.
- **No drop shadows on standard surfaces** — separate with `1px solid var(--color-rule)`. Reserve shadows for elevated popovers (branch switcher, outline panel, mermaid zoom overlay).
- Ochre accent used **sparingly**: active nav item background + border + marker, ochre marker in prose lists, single ochre rule on the sign-in cover, and the accent tint on branch-switcher search hits.
- Faint paper grain: two very low-opacity radial gradients on `<body>` add texture without noise.

## Logo

The Vaimo logo is served from `/public/`. Variants:

| Path | When to use |
|---|---|
| `vaimo-logo-dark.png` | Light backgrounds (top nav). Dark wordmark + ochre X-mark. |
| `vaimo-logo-white.svg` | Dark backgrounds (sign-in cover left panel). |
| `vaimo-logo.svg` / `vaimo-logo-white.png` / `vaimo-logo.webp` | Legacy assets, kept for reference. Prefer the two above. |

Both used variants are rendered via `next/image` with an explicit height (28–36px) and `width: auto` for aspect-preserving scaling.

## Detail tokens

- `::selection` background is `--color-accent`.
- Scrollbars are 8px, rounded, with `--color-rule` thumbs on transparent tracks.
- Fade-up entrance on `<article>` via the `.fade-up` keyframe (`0.35s` ease-out). Kept subtle to avoid content pop-in feeling animated.
