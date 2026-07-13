from PIL import Image

def remove_black_background(input_path, output_path, threshold=40):
    img = Image.open(input_path).convert("RGBA")
    data = img.getdata()
    
    new_data = []
    for item in data:
        # Check if the pixel is dark (r, g, b all below threshold)
        if item[0] < threshold and item[1] < threshold and item[2] < threshold:
            # Change to transparent
            new_data.append((255, 255, 255, 0))
        else:
            new_data.append(item)
            
    img.putdata(new_data)
    img.save(output_path, "PNG")
    print(f"Saved transparent image to {output_path}")

remove_black_background(r"C:\Users\jittu\kcc-website\assets\satellite.jpg", r"C:\Users\jittu\kcc-website\assets\satellite.png", threshold=50)

# Now update index.html
html_path = r"C:\Users\jittu\kcc-website\index.html"
with open(html_path, "r", encoding="utf-8") as f:
    html = f.read()

# Increase size and change to png
html = html.replace('<image href="assets/satellite.jpg" x="-20" y="-20" width="40" height="40" />', 
                    '<image href="assets/satellite.png" x="-30" y="-30" width="60" height="60" />')

# Remove mix-blend-mode just in case
html = html.replace('<g class="sat-small" style="mix-blend-mode: screen;">', '<g class="sat-small">')

with open(html_path, "w", encoding="utf-8") as f:
    f.write(html)

# Update css for speed
css_path = r"C:\Users\jittu\kcc-website\assets\css\style.css"
with open(css_path, "r", encoding="utf-8") as f:
    css = f.read()

css = css.replace('animation:orbit 52s linear', 'animation:orbit 75s linear')

with open(css_path, "w", encoding="utf-8") as f:
    f.write(css)
