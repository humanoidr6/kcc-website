import os
import re

filepath = r"C:\Users\jittu\kcc-website\index.html"
css_path = r"C:\Users\jittu\kcc-website\assets\css\style.css"

with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
    html = f.read()

with open(css_path, "r", encoding="utf-8", errors="ignore") as f:
    css = f.read()

# 1. Clean up encoding artifacts
html = html.replace('\ufffd', '')
html = html.replace('â€”', '—')
html = html.replace('â€“', '–')
html = html.replace('â€™', '’')
html = html.replace('â€œ', '“')
html = html.replace('â€ ', '”')
html = html.replace('Â·', '·')
html = html.replace('A·', '·')

css = css.replace('\ufffd', '')
css = css.replace('â€”', '—')
css = css.replace('â€“', '–')

# specific replacements for known broken sequences left behind
html = html.replace('Ground station +\'', 'Ground station →')
html = html.replace('Ground station \'', 'Ground station →')
html = html.replace('Ground station ', 'Ground station ')
html = html.replace('cuchd.in +\'', 'cuchd.in →')
html = html.replace('Aerospace at CU +\'', 'Aerospace at CU →')

# 2. Fix the Ground station button from ghost to alt
html = html.replace('href="assets/css/style.css"', 'href="assets/css/style.css?v=3"')
html = html.replace('<a class="btn btn-ghost" href="#groundstation">Ground station →</a>', '<a class="btn btn-alt" href="#groundstation">Ground station →</a>')

btn_alt_css = """
.btn-alt { background: rgba(255, 255, 255, 0.15); color: #fff !important; border: 1px solid rgba(255, 255, 255, 0.8); backdrop-filter: blur(4px); }
.btn-alt:hover { background: rgba(255, 255, 255, 0.3); border-color: #fff; transform: translateY(-1px); }
"""
if ".btn-alt" not in css:
    css += btn_alt_css

# 3. Remove CUSAT references
html = html.replace('build the CUSAT nanosatellite, operate', 'operate')
html = re.sub(r'(?m)^\s*<li><a href="#cusat">CUSAT</a></li>\s*\r?\n?', '', html)
html = re.sub(r'(?s)<g class="sat-cusat".*?</g>', '', html)
html = re.sub(r'(?s)<p class="orbit-tag">.*?CUSAT.*?</p>', '', html)
html = re.sub(r'(?m)^\s*<li>Ground control for CUSAT</li>\s*\r?\n?', '', html)
html = re.sub(r'(?s)<p>The centre serves as the <strong>Ground Control Station</strong> for CUSAT,.*?</p>', '', html)
html = re.sub(r'(?s)<!-- ================= CUSAT ================= -->\s*<section id="cusat">.*?</section>\s*\r?\n?', '', html)
html = re.sub(r'(?i)TT&amp;C FOR <em>CUSAT</em>.*?LEO SATELLITE TRACKING', 'LEO SATELLITE TRACKING', html)
html = re.sub(r'including CUSAT once on orbit.*?pass after pass\.', 'pass after pass.', html)
html = html.replace('CUSAT (Sim)', 'METEOR-M 2')
html = html.replace('passion of the CUSAT student team.', 'passion of our student team.')
html = html.replace('<h3>CUSAT Student Team</h3>', '<h3>Student Team</h3>')
html = html.replace('building the CUSAT nanosatellite and operating', 'operating')
html = re.sub(r'(?s)<div class="log-entry rv">.*?CUSAT programme announced.*?</div>', '', html)
html = html.replace('Join the CUSAT team,', 'Join the team,')

# 4. Remove specific research items
html = re.sub(r'(?s)<div class="section-head rv">\s*<p class="eyebrow">Research</p>.*?<div class="globe-band', '<div class="globe-band', html)


with open(filepath, "w", encoding="utf-8") as f:
    f.write(html)

with open(css_path, "w", encoding="utf-8") as f:
    f.write(css)

print("Cleanup complete.")
