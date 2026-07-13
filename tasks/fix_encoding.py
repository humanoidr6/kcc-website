import os

files_to_fix = [
    r"C:\Users\jittu\kcc-website\index.html",
    r"C:\Users\jittu\kcc-website\assets\css\style.css",
    r"C:\Users\jittu\kcc-website\assets\js\main.js",
    r"C:\Users\jittu\kcc-website\assets\js\starfield.js"
]

for filepath in files_to_fix:
    if not os.path.exists(filepath):
        continue
    try:
        with open(filepath, "rb") as f:
            content = f.read()
        
        # Decode as utf-8 (this is the double-encoded string)
        text = content.decode("utf-8")
        
        # Check if we have typical mojibake like â€”
        if "â€" in text or "Â" in text or "â€™" in text or "â€”" in text or "â€“" in text or "â" in text:
            try:
                # Reverse the double encoding
                # It was read as cp1252 and saved as utf-8.
                fixed_text = text.encode("cp1252").decode("utf-8")
                
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(fixed_text)
                print(f"Fixed double encoding in {filepath}")
            except Exception as e:
                # If cp1252 reverse fails, we can do a manual string replace as fallback
                print(f"Could not cleanly reverse double encoding for {filepath}: {e}")
                manual_text = text.replace("â€”", "—").replace("â€“", "–").replace("â€™", "’").replace("â€œ", "“").replace("â€", "”").replace("Â·", "·").replace("Â", "")
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(manual_text)
                print(f"Applied manual encoding fix to {filepath}")
        else:
            print(f"No obvious mojibake in {filepath}")
            
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
