> **STATUS 2026-07-16:** this document describes the original dark single-file
> "mission control" design, which was retired in the July 2026 overhaul (light
> ISRO-blue theme, multi-file layout, real centre content — see `tasks/hand_off.md`
> and `TODO.md`). Kept for history; the headless-Chrome **testing recipe** below is
> still the way we verify renders.

# Design system & build notes

Reference for anyone (human or AI) continuing work on `index.html`. Read this before
changing styles, fonts, or the animated graphics.

## Concept

**"Mission control over Punjab."** A committed single dark theme — the page *is* the night
sky, so there is deliberately no light mode. Two voices carry the identity:

- **Engineering voice** — geometric space-age display type, monospace telemetry labels,
  console panels, hairline rules, flat corners (2px max — no rounded-card look).
- **Human voice** — a bookish italic serif, used only where Kalpana Chawla herself is
  present (hero name, tribute quote, one italic word in the closing CTA).

That contrast — hard engineering vs. the dream — is the design thesis. Keep it.

## Palette (CSS custom properties in `:root`)

| Token | Value | Role |
|---|---|---|
| `--void` | `#060A14` | page ground (indigo-black, deliberately blue-biased) |
| `--panel` | `#0C1424` | raised console surfaces |
| `--panel-2` | `#101A2E` | secondary surface (rarely used) |
| `--line` / `--line-strong` | `rgba(148,166,201,.16/.30)` | hairlines / emphasized rules |
| `--ink` | `#EAEEF7` | primary text ("starlight") |
| `--muted` | `#93A1BC` | secondary text (≈7:1 on void) |
| `--faint` | `#5C6A85` | tertiary labels |
| `--saffron` | `#F5A62B` | **the one bold accent** — CTAs, emphasis, station marker, CUSAT |
| `--signal` | `#6FD8E8` | telemetry cyan — data marks only (tracks, console values, live dots) |

Discipline: saffron = action/identity, cyan = data. Don't introduce a third accent and
don't swap their roles.

## Typography

| Role | Face | Delivery |
|---|---|---|
| Display (`--display`) | **URW Gothic Demi** (Avant Garde Gothic clone) | embedded WOFF2 data-URI |
| Tribute italic (`--serif`) | **C059 Italic** (Century Schoolbook clone) | embedded WOFF2 data-URI |
| Body (`--body`) | Helvetica/Arial system stack | system |
| Data/labels (`--mono`) | ui-monospace stack | system |

Mono conventions: eyebrows and labels are uppercase, `letter-spacing:.14–.24em`; digits
use `font-variant-numeric:tabular-nums` (`.num`).

### Regenerating the embedded fonts

The two `@font-face` data URIs at the top of `<style>` were produced from the URW base-35
fonts (open-licensed, ship with Ghostscript/most Linux distros), subset to Basic Latin +
punctuation (~10–15 KB each):

```bash
UNI="U+0020-007E,U+00A0,U+00A9,U+00B0,U+00B7,U+2013,U+2014,U+2018-2019,U+201C-201D,U+2022,U+2026,U+20B9,U+2192"
python3 -m fontTools.subset URWGothic-Demi.otf --unicodes="$UNI" \
  --flavor=woff2 --layout-features='kern' --output-file=gothic-demi.woff2
base64 -w0 gothic-demi.woff2   # paste into the @font-face src url(data:font/woff2;base64,…)
```

(needs `fonttools` + `brotli` Python packages). Note: neither face contains `₹` (U+20B9) —
rupee amounts are set in body/mono stacks where system fonts supply the glyph. If you add
glyphs beyond the subset ranges above, re-subset with them included.

## Animated / generative graphics (all in the `<script>` block)

| Piece | Tech | Notes |
|---|---|---|
| Starfield | `<canvas id="stars">` rAF loop | density = area/7800, twinkle via sin phase, occasional meteor every 8–17 s; pauses when hero off-screen or tab hidden |
| Hero orbit | inline SVG + CSS `offset-path` | CUSAT (saffron) 34 s, second satellite (cyan) 52 s reverse; static fallback dots shown via `@supports not (offset-path…)` |
| Ground-track panel | `<canvas id="track">` rAF loop | dot-grid "map", 3 sine ground tracks, satellite dot on the bright track; the saffron diamond sits at the station's **true equirectangular position** (30.77°N 76.57°E) — keep it there |
| Stat count-up | rAF, ease-out cubic, 1.15 s | numbers come from `data-count` attributes |
| Scroll reveals | IntersectionObserver adds `.in` to `.rv` | stagger via inline `--d` custom property |

**Reduced motion**: every effect checks `prefers-reduced-motion` — reveals apply instantly,
counters jump to final values, canvases draw one static frame, orbit/cursor animations stop.
Any new animation must follow the same rule.

## Cascade gotchas (real bugs, already fixed once)

1. `section.flush` (specificity 0,1,1) **beats** `.hero`/`.stats` (0,1,0). It must only
   remove the border — if it ever sets `padding-top:0` again, the hero's top padding
   silently dies and the coords line hides under the fixed header.
2. The hero centers its content with `margin-block:auto` on `.hero>.wrap` — **not**
   `align-items:center` — so that when content is taller than the viewport (mobile) it
   top-aligns instead of clipping above the fold (`overflow:hidden` on the hero).
3. The nav CTA needs `white-space:nowrap` and is hidden ≤560px; the burger menu covers
   navigation there.

## Testing recipe

Headless-Chrome render checks (what caught every bug so far):

```bash
# real-viewport hero
google-chrome --headless=new --hide-scrollbars --window-size=1440,900 \
  --virtual-time-budget=6000 --screenshot=hero.png index.html

# full page: neutralize the 100svh hero, force reduced motion for a stable render
#   inject: .hero{min-height:auto!important;padding-block:9rem 4rem!important}
google-chrome --headless=new --hide-scrollbars --force-prefers-reduced-motion \
  --window-size=1440,8700 --virtual-time-budget=6000 --screenshot=full.png flat.html

# mobile
google-chrome --headless=new --hide-scrollbars --window-size=390,844 \
  --virtual-time-budget=5000 --screenshot=mob.png index.html
```

Screenshot with a huge window *without* flattening the hero and the `100svh` hero will
swallow the whole capture — that's a test artifact, not a page bug.

