# Roadmap / next sessions

Working list for continuing the site. Ordered roughly by impact.

## Content (needs material from the centre)

- [ ] **Real photographs** — the centre, antennas, rocketry lab, star-gazing nights,
      inauguration. Add a gallery section (keep images optimized, ~200 KB each; consider
      moving to an `assets/` folder once the single-file constraint is no longer needed).
- [ ] **Team / leadership** — centre head, faculty mentors, CUSAT student team. New section
      between Research and Mission log.
- [ ] **Contact details** — official email/phone for the centre (only the cuchd.in links
      are real today; nothing invented).
- [ ] **Verify current figures** — SatNOGS reach (380+/810+/50+) and the CUSAT launch
      status date from January 2022 announcements; get the centre's current numbers and
      update the stats band + `data-count` attributes and the mission log.
- [ ] **Events/outreach** — workshops, star-gazing schedules, satellite-design courses,
      admission pointers for the aerospace programme.

## Features

- [ ] Photo gallery with lightbox (keep it dependency-free).
- [ ] "Upcoming passes" panel — real satellite pass predictions over Gharuan via a small
      embedded TLE propagation, or link out to the station's SatNOGS dashboard page.
- [ ] News/updates section fed by simple hand-edited entries.
- [ ] Hindi / Punjabi language toggle.
- [ ] Contact form (needs a backend or a form service — decide with the college).

## Technical

- [ ] Decide single-file vs. multi-file: current single `index.html` is great for handing
      in and hosting anywhere; if the site grows (gallery, news), split CSS/JS out and add
      an `assets/` directory.
- [ ] SEO: sitemap.xml + robots.txt once the final URL is known; refine meta description.
- [ ] Custom domain (e.g. a `cuchd.in` subdomain) — CNAME file + Pages settings.
- [ ] Lighthouse pass (currently untested for a11y/perf scores; expected good — verify).
- [ ] Print stylesheet for handing in a hard copy.

## Done

- [x] Research the centre from PIB / CU sources (Jan 2022 commissioning facts)
- [x] Design system: dark mission-control identity, saffron/cyan accents, URW Gothic +
      C059 embedded fonts (see DESIGN.md)
- [x] All sections: hero, stats, about, tribute, CUSAT, ground station, facilities,
      research, mission log, visit, footer with sources + disclaimer
- [x] Animated starfield, orbital diagram, ground-track panel — all reduced-motion safe
- [x] Responsive (desktop / tablet / 390px mobile) — render-tested in headless Chrome
- [x] Published claude.ai artifact preview + GitHub Pages deployment
