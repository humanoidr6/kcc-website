import os
import re

filepath = r"C:\Users\jittu\kcc-website\index.html"
with open(filepath, "r", encoding="utf-8") as f:
    html = f.read()

# Replace KCCRSST with KCC case-insensitively
html = re.sub(r'(?i)kccrsst', 'KCC', html)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(html)
print("Replaced all instances of KCCRSST with KCC.")
