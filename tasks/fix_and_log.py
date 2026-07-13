import os
import re

filepath = r"C:\Users\jittu\kcc-website\index.html"
with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
    html = f.read()

# Fix the mojibake
replacements = {
    'â€”': '&mdash;',
    'â€“': '&ndash;',
    'â€™': '&rsquo;',
    'â€œ': '&ldquo;',
    'â€ ': '&rdquo;',
    'Â·': '&middot;',
    'A·': '&middot;',
    '\ufffd': '',
    '—': '&mdash;',
    '–': '&ndash;',
    '’': '&rsquo;',
    '“': '&ldquo;',
    '”': '&rdquo;',
    '·': '&middot;',
    '→': '&rarr;',
    'A ': '&middot; ',
    'A&nbsp;': '&middot;&nbsp;'
}

for bad, good in replacements.items():
    html = html.replace(bad, good)

# Fix some specifics that might have been mangled
html = html.replace("Gharuan, Punjab &mdash; 30.77&middot;N", "Gharuan, Punjab &mdash; 30.77&deg;N")
html = html.replace("76.57&middot;E", "76.57&deg;E")
html = html.replace("30.77&middot;N 76.57&middot;E", "30.77&deg;N 76.57&deg;E")
html = html.replace("Gharuan, Punjab &mdash; 30.77A&deg;N&nbsp;76.57A&deg;E", "Gharuan, Punjab &mdash; 30.77&deg;N&nbsp;76.57&deg;E")


# Rebuild Mission Log
new_mission_log = """<!-- ================= MISSION LOG ================= -->
<section id="missionlog">
  <div class="wrap">
    <div class="section-head rv">
      <p class="eyebrow">Mission Log</p>
      <h2>Progress &amp; milestones</h2>
    </div>
    <div class="log-grid">
      <div class="log-item rv">
        <time>03 Jan 2022</time>
        <h3>KCC Inauguration</h3>
        <p>The Kalpana Chawla Centre for Research in Space Science &amp; Technology is officially inaugurated by Hon'ble Raksha Mantri Shri Rajnath Singh.</p>
      </div>
      <div class="log-item rv" style="--d:.08s">
        <time>Mid 2022</time>
        <h3>First Signals Received</h3>
        <p>The ground station antenna successfully tracks and receives telemetry from low Earth orbit, proving our systems operational.</p>
      </div>
      <div class="log-item rv" style="--d:.16s">
        <time>Late 2023</time>
        <h3>Student Boot Camp</h3>
        <p>A core team of students completes intensive foundational training in orbital mechanics, avionics, and payload design.</p>
      </div>
      <div class="log-item now rv" style="--d:.24s">
        <time>Today</time>
        <h3>Station on watch</h3>
        <p>Student crews keep the ground station listening &mdash; tracking LEO passes, decoding telemetry, and training the next cohort of engineers.</p>
      </div>
    </div>
  </div>
</section>
"""

# Replace existing mission log
html = re.sub(r'(?s)<!-- ================= MISSION LOG ================= -->\s*<section id="missionlog">.*?</section>\s*', new_mission_log, html)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(html)
print("Fixed encoding and updated mission log.")
