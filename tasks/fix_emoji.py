import re

filepath = r"C:\Users\jittu\kcc-website\index.html"
with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
    text = f.read()

text = re.sub(r'<text x="50" y="90">.*?</text>', '<text x="50" y="90">&#128186;</text>', text)
text = re.sub(r"<text x='50' y='90'>.*?</text>", "<text x='50' y='90'>&#128186;</text>", text)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(text)
print("Fixed final emoji.")
