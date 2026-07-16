# Roadmap / next sessions

State as of **16 Jul 2026** (evening). The site was overhauled with real centre content and
a light "ISRO-blue" theme; day-to-day planning notes from the Windows sessions live in
`tasks/` (see `tasks/hand_off.md`). This file is the top-level roadmap.

## Open

- [ ] **`respond-basket.html` is missing** — the "BalloonSat Project Basket 2026" news card
      links to it (404 on the live site). Source material: `~/BalloonSat_Project_Basket.{docx,pdf,xlsx}`.
- [ ] **Dead news links** — "Read full report" (SatNOGS card), "View highlights" (telemetry
      workshop) and "Mission details" (balloon test) still point at `#`.
- [ ] **Contact form backend** — form exists; verify where submissions actually go
      (service/backend still to be decided with the college).
- [ ] **Refresh the bundled TLE set** in `assets/js/passes.js` (`BAKED`) every few weeks or
      whenever editing — it is the offline fallback for the passes panel.
- [ ] **DESIGN.md rewrite** — it still documents the retired dark single-file design; the
      testing recipe section remains valid.
- [ ] Custom domain (e.g. a `cuchd.in` subdomain) — CNAME file + Pages settings.
- [ ] Lighthouse re-audit after the July 16 changes.
- [ ] Hindi / Punjabi language toggle (long-standing wish-list item).

## Done

- [x] Single-file → multi-file split (`assets/css`, `assets/js`)
- [x] Content overhaul with real material: internship report + schedule pages, photo
      gallery with lightbox, team/leadership, news dispatches, mission roadmap, visitors
      wall, contact section (parallel Windows sessions, see `tasks/`)
- [x] Light ISRO-blue redesign; CUSAT/ground-station sections retired per centre direction
- [x] **Upcoming-passes panel with real predictions** — in-browser SGP4 (WGS-72, near-Earth)
      over Gharuan 30.77°N 76.57°E; live CelesTrak GP elements → 12 h localStorage cache →
      bundled fallback; verified against python-sgp4 (positions ≤1e-8 km) and Skyfield
      (49 passes, AOS/LOS ≤0.5 s, max-el ≤0.01°). LEO satellites only (no deep-space terms).
- [x] Print stylesheet (incl. fix: scroll-reveal sections were invisible in print)
- [x] SEO: robots.txt, sitemap.xml (all three pages), de-CUSAT'd meta/og descriptions,
      1200×630 `assets/og.jpg`, `color-scheme` meta matched to the light theme
- [x] Image optimization: ~25 MB → ~2.4 MB (group photo 5.4 MB→254 KB, certificate PNG→JPG
      3.9 MB→379 KB, etc.); references updated
- [x] Render-tested: desktop/mobile/print via headless Chrome; passes panel exercised on
      live-fetch, cached and offline (DNS-blackholed) element paths

## Notes for editors

- **Encoding:** edit HTML strictly as UTF-8 (see `tasks/hand_off.md` — PowerShell
  `Set-Content` without `-Encoding UTF8` corrupted the file once).
- **Passes panel:** satellites are configured in `SATS` at the top of `assets/js/passes.js`;
  keep them LEO (period < 225 min). Cache-bust `?v=` on `passes.js`/`style.css` when editing.
- Local dev: any static server from the repo root (currently `http://localhost:8080/`).
