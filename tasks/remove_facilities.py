import os
import re

filepath = r"C:\Users\jittu\kcc-website\index.html"
with open(filepath, "r", encoding="utf-8") as f:
    html = f.read()

# 1. Remove Research Section (which now just has the 57 flags)
html = re.sub(r'(?s)<!-- ================= RESEARCH ================= -->\s*<section id="research">.*?</section>\s*', '', html)

# 2. Remove Facilities Section
html = re.sub(r'(?s)<!-- ================= FACILITIES ================= -->\s*<section id="facilities">.*?</section>\s*', '', html)

# 3. Remove Navigation Links
html = re.sub(r'(?m)^\s*<li><a href="#facilities">.*?</a></li>\s*\r?\n?', '', html)
html = re.sub(r'(?m)^\s*<li><a href="#research">.*?</a></li>\s*\r?\n?', '', html)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(html)
print("Removed Facilities and Research sections successfully.")
