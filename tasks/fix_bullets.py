import re

filepath = r"C:\Users\jittu\kcc-website\index.html"
with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
    text = f.read()

# Replace any character that is not ASCII with a standard bullet or dash where appropriate
# Let's target the known lines.

# Line 366
text = re.sub(r'operational ground station.*?Advanced research labs.*?Global collaborations.*?Expansion', 
              r'operational ground station &middot; Advanced research labs &middot; Global collaborations &middot; Expansion', text)

# North India's ...
text = re.sub(r'centre.*?where students', r'centre &mdash; where students', text)

# ground stations - so a student console
text = re.sub(r'ground stations.*?so a student console', r'ground stations &mdash; so a student console', text)

# Tracking LEO passes...
text = re.sub(r'listening.*?tracking LEO', r'listening &mdash; tracking LEO', text)

text = re.sub(r'57 countries.*?including Brazil', r'57 countries &mdash; including Brazil', text)

# Finally, let's just strip any remaining literal replacement characters: \ufffd
text = text.replace('\ufffd', '')
# And strip any other weird lingering mojibake like â€”
text = text.replace('â€"', '—')
text = text.replace('â€', '')

with open(filepath, "w", encoding="utf-8") as f:
    f.write(text)

