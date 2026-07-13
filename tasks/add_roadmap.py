import os

html_content = """<!-- ================= ROADMAP ================= -->
<section id="roadmap">
  <div class="wrap">
    <div class="section-head center rv">
      <div class="eyebrow center">Roadmap</div>
      <h2>Mission Roadmap</h2>
      <p class="lead measure">A student-driven journey to design, build &amp; launch a satellite. This roadmap outlines our progressive milestones toward the ultimate goal of launching into orbit by 2030.</p>
    </div>
    
    <div class="roadmap-grid">
      <div class="roadmap-item rv">
        <div class="step-num">1</div>
        <div class="step-content">
          <h3>Boot Camp (Completed)</h3>
          <p>Completed intensive foundational training for the core team.</p>
        </div>
      </div>
      <div class="roadmap-item rv" style="--d:.1s">
        <div class="step-num">2</div>
        <div class="step-content">
          <h3>Fixing Vision &amp; Payload</h3>
          <p>Defining the mission objectives, satellite capabilities and payload specifications.</p>
        </div>
      </div>
      <div class="roadmap-item rv" style="--d:.2s">
        <div class="step-num">3</div>
        <div class="step-content">
          <h3>Round Table Meeting</h3>
          <p>Expert guidance and review to refine our mission and development path with ISRO Scientists.</p>
        </div>
      </div>
      <div class="roadmap-item rv" style="--d:.3s">
        <div class="step-num">4</div>
        <div class="step-content">
          <h3>Balloon Sat Mission</h3>
          <p>Technology demonstration and data collection using high-altitude balloon platform.</p>
        </div>
      </div>
      <div class="roadmap-item rv" style="--d:.4s">
        <div class="step-num">5</div>
        <div class="step-content">
          <h3>LEO Orbit Ground Station</h3>
          <p>Setting up and operating our own ground station for communication &amp; data handling.</p>
        </div>
      </div>
      <div class="roadmap-item rv" style="--d:.5s">
        <div class="step-num">6</div>
        <div class="step-content">
          <h3>SSLV Launch (2030)</h3>
          <p>Launch onboard SSLV from SHAR to Low Earth Orbit by 2030.</p>
        </div>
      </div>
    </div>
    
    <div class="values-grid rv" style="--d:.6s">
      <div class="value-item">
        <strong>LEARN</strong>
        <p>Building knowledge and skills</p>
      </div>
      <div class="value-item">
        <strong>INNOVATE</strong>
        <p>Solving real-world challenges</p>
      </div>
      <div class="value-item">
        <strong>COLLABORATE</strong>
        <p>Working together for greater impact</p>
      </div>
      <div class="value-item">
        <strong>BUILD</strong>
        <p>Turning ideas into tangible solutions</p>
      </div>
      <div class="value-item">
        <strong>LAUNCH</strong>
        <p>Reaching new heights</p>
      </div>
      <div class="value-item">
        <strong>INSPIRE</strong>
        <p>Empowering future space leaders</p>
      </div>
    </div>
  </div>
</section>

"""

filepath = r"C:\Users\jittu\kcc-website\index.html"
with open(filepath, "r", encoding="utf-8") as f:
    html = f.read()

html = html.replace('<!-- ================= MISSION LOG ================= -->', html_content + '<!-- ================= MISSION LOG ================= -->')
html = html.replace('<li><a href="#missionlog">Mission Log</a></li>', '<li><a href="#roadmap">Roadmap</a></li>\n        <li><a href="#missionlog">Mission Log</a></li>')

with open(filepath, "w", encoding="utf-8") as f:
    f.write(html)

css_content = """
/* Roadmap Styles */
.roadmap-grid {
  display: grid;
  gap: 1.5rem;
  margin-top: 3rem;
}
.roadmap-item {
  display: flex;
  align-items: flex-start;
  gap: 1.5rem;
  background: var(--surface);
  padding: 1.5rem;
  border-radius: 8px;
  border: 1px solid var(--line);
}
.roadmap-item .step-num {
  width: 40px;
  height: 40px;
  background: var(--saffron);
  color: var(--void);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--display);
  font-weight: 700;
  font-size: 1.2rem;
  flex-shrink: 0;
}
.roadmap-item h3 {
  margin: 0 0 0.5rem;
  font-size: 1.25rem;
}
.roadmap-item p {
  margin: 0;
  color: var(--muted);
  font-size: 0.95rem;
}

.values-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1.5rem;
  margin-top: 4rem;
  text-align: center;
}
.value-item {
  padding: 1.5rem;
  background: rgba(245, 166, 43, 0.05);
  border: 1px solid rgba(245, 166, 43, 0.2);
  border-radius: 8px;
}
.value-item strong {
  display: block;
  color: var(--saffron);
  font-family: var(--display);
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
}
.value-item p {
  margin: 0;
  font-size: 0.85rem;
  color: var(--muted);
}

@media(min-width: 768px) {
  .roadmap-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .values-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
"""

css_path = r"C:\Users\jittu\kcc-website\assets\css\style.css"
with open(css_path, "a", encoding="utf-8") as f:
    f.write(css_content)

print("Added Roadmap section.")
