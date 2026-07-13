import os
import re

filepath = r"C:\Users\jittu\kcc-website\index.html"
with open(filepath, "r", encoding="utf-8") as f:
    html = f.read()

# 1. Remove the section
html = re.sub(r'(?s)<!-- ================= GROUND STATION ================= -->\s*<section id="groundstation">.*?</section>\s*', '', html)

# 2. Remove the navigation links
html = re.sub(r'(?m)^\s*<li><a href="#groundstation">.*?</a></li>\s*\r?\n?', '', html)

# 3. Remove the button
html = re.sub(r'\s*<a class="btn btn-alt" href="#groundstation">.*?</a>', '', html)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(html)
print("Removed Ground Station section successfully.")
