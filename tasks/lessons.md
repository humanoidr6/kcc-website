# Project Lessons & Context

## KCC Website Project State
- **Architecture**: We have migrated from a single-file `index.html` structure to a multi-file architecture. CSS is located in `assets/css/style.css` and JS is in `assets/js/main.js`.
- **Design System**: The website relies on dark, mission-control styling with saffron accents, and embedded custom fonts (URW Gothic, C059). 
- **Image Optimization**: Avoid massive PNG files. Keep assets optimized (e.g., converted a 99MB image to JPG). Use `tasks/optimize.py` if new heavy images are added.
- **Dependencies**: The project adheres to a "vanilla" constraint whenever possible (e.g., the new lightbox and tabs are written in dependency-free vanilla Javascript).
- **Recent Additions**:
  - Photo Gallery with Lightbox (`#gallery`)
  - Ground Station "Upcoming Passes" Panel (`.passes-panel`)
  - Team / Leadership Section (`#team`)

## Workflow Rules
- Always plan in `tasks/todo.md` before coding.
- Test responsive layouts implicitly when designing UI components.
- Check Lighthouse metrics periodically.
