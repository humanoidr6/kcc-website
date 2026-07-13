import os
import re

filepath = r"C:\Users\jittu\kcc-website\index.html"
css_path = r"C:\Users\jittu\kcc-website\assets\css\style.css"

with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
    html = f.read()

# Fix the specific button issue
html = re.sub(r'<a class="btn btn-ghost" href="#groundstation">Ground station.*?</a>', 
              '<a class="btn btn-alt" href="#groundstation">Ground station &rarr;</a>', html)

# Fix the other btn-ghost
html = re.sub(r'<a class="btn btn-ghost" href="(.*?)".*?>(.*?)</a>', 
              r'<a class="btn btn-ghost" href="\1" target="_blank" rel="noopener">\2 &rarr;</a>', html)

# Clean up all unicode replacement chars
html = html.replace('\ufffd', '')
html = html.replace("+'", "&rarr;")

# Fix some bullet points that got corrupted
html = re.sub(r'ground station\s*\s*Advanced', 'ground station &middot; Advanced', html)
html = re.sub(r'labs\s*\s*Global', 'labs &middot; Global', html)
html = re.sub(r'collaborations\s*\s*Expansion', 'collaborations &middot; Expansion', html)

# Save HTML
with open(filepath, "w", encoding="utf-8") as f:
    f.write(html)
