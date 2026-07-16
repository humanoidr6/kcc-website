# KCC Website Project: Hand-Off Document

**Date:** July 13, 2026
**Project:** Kalpana Chawla Centre (KCC) Website Refactor
**Local Dev Server:** `http://localhost:8000`

## 1. Current State & Architecture
- **Structure:** Single-page application built with HTML5, CSS3 (Vanilla), and minimal JS.
- **Theme:** Dark mode space-aesthetic with glassmorphism effects, a dynamic starfield background (`assets/js/starfield.js`), and smooth CSS animations.
- **Key Files:** 
  - `index.html` (Main markup)
  - `assets/css/style.css` (All styling and keyframes)
  - `assets/js/main.js` (Lightbox and UI events)
  - `tasks/` (Contains utility Python scripts used for regex cleanups and image processing).

## 2. Recent Major Changes (Session Summary)
- **CUSAT & KCCRSST Purged:** Removed all mentions of "CUSAT" and replaced all instances of "KCCRSST" with just "KCC".
- **Roadmap Added:** Extracted a 6-step mission roadmap from a user-provided poster and built a brand-new responsive CSS grid section (`#roadmap`) along with 6 core values.
- **Facilities & Ground Station Removed:** Completely stripped out the `#groundstation` section, Model Rocketry Lab, and `#facilities` sections.
- **Mission Log Updated:** Rewrote the `#missionlog` with 4 generic historical milestones since specific CUSAT items were removed.
- **Team Updated:** Added Prof. Eswar Sunkara as Senior Director with his image. Removed "Aerospace & Electronics" label from Faculty Mentors.
- **UI Tweaks:** Enlarged the `.datastrip` top bar text to `0.85rem` for better readability. Fixed the satellite image (converted from JPEG with a black background to a transparent PNG) and slowed its orbit from 52s to 75s.

## 3. Critical Quirks & Lessons Learned (WARNING)
- **The Mojibake Incident:** The `index.html` file suffered from severe double-encoding issues on Windows resulting in `â€”` characters scattering throughout the file. 
- **Cause:** Modifying `index.html` using Windows PowerShell `Set-Content` defaults to ANSI/Windows-1252, corrupting UTF-8 characters. 
- **Solution:** A Python script (`tasks/fix_and_log.py`) was written to strictly use `encoding="utf-8"` to purge and repair the characters. **Future developers MUST avoid using native PowerShell redirection or `Set-Content` without explicit `-Encoding UTF8` flags when modifying the HTML.**

## 4. Pending Tasks / Next Steps
- [x] **News/Updates Section:** Build a dynamic or static news ticker/grid.
- [x] **Contact Form:** Implement a functional contact section with form validation.
- [x] **SEO Optimization:** Generate `sitemap.xml`, `robots.txt`, and audit with Google Lighthouse.
- [x] **Print Stylesheet:** Add `@media print` rules for PDF generation.
- [ ] **Deployment:** Map to a custom domain when ready.

---

## Session Log — 16 Jul 2026 (Linux/Claude Code)

- **Passes panel is now real**: `assets/js/passes.js` — vanilla SGP4 (WGS-72, near-Earth)
  computing live pass predictions over Gharuan; CelesTrak GP fetch → 12 h localStorage
  cache → bundled TLE fallback (works offline/file://). Verified against python-sgp4 and
  Skyfield before shipping. New `#passes` section after News; on-brand console styling
  replaced the orphaned `.passes-panel` placeholder CSS.
- **Print fixed**: `.rv` scroll-reveal elements printed as blank pages; print block now
  forces them visible.
- **Meta hygiene**: CUSAT removed from meta/og descriptions; `color-scheme` meta now
  `light` to match the CSS; og:image → optimized `assets/og.jpg` (1200×630).
- **Images**: ~25 MB → ~2.4 MB (certificate + inaugural PNGs converted to JPG, refs updated).
- **sitemap.xml**: now lists internship-report and internship-schedule pages.
- **Known gap**: `respond-basket.html` (BalloonSat news card) still missing → 404.
