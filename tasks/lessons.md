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
- **PDF Image Extraction**: Raw JPEGs embedded in PDFs are often heavily compressed. To get crisp images, either render the PDF page at 300+ DPI and crop it, or request the original high-res photos from the user.
- **Content Integrity**: When migrating content from a PDF to HTML, always extract the raw text using a script and review it to ensure no tables, bullet points, or summary sections are missed.
- **Image Layouts**: Don't squeeze high-resolution images into narrow grid columns next to text, as it makes them look artificially compressed. Allow them to span large widths.
