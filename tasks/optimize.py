import os
from PIL import Image

assets_dir = r"C:\Users\jittu\kcc-website\assets"

def optimize_image(filepath):
    print(f"Optimizing {filepath}...")
    try:
        with Image.open(filepath) as img:
            # Convert RGBA to RGB for JPEG
            if img.mode == 'RGBA':
                img = img.convert('RGB')
                
            # Resize if too large
            max_width = 1200
            if img.width > max_width:
                ratio = max_width / img.width
                new_height = int(img.height * ratio)
                img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
                
            # Save as optimized JPEG
            base, _ = os.path.splitext(filepath)
            out_path = base + ".jpg"
            img.save(out_path, "JPEG", optimize=True, quality=80)
            print(f"Saved optimized image to {out_path}")
            
            # If original was png and we saved as jpg, we could remove the original.
            if filepath != out_path:
                print(f"Original was {filepath}. Removing original.")
                os.remove(filepath)
    except Exception as e:
        print(f"Failed to optimize {filepath}: {e}")

if __name__ == "__main__":
    for filename in os.listdir(assets_dir):
        if filename.lower().endswith(('.png', '.jpg', '.jpeg')):
            filepath = os.path.join(assets_dir, filename)
            # Only optimize if larger than 500KB
            if os.path.getsize(filepath) > 500 * 1024:
                optimize_image(filepath)
    print("Optimization complete.")
