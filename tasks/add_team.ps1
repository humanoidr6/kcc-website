$html = Get-Content C:\Users\jittu\kcc-website\index.html -Raw

$teamHtml = @"
<!-- ================= TEAM / LEADERSHIP ================= -->
<section id="team">
  <div class="wrap">
    <div class="section-head center rv">
      <div class="eyebrow center">Our People</div>
      <h2>Leadership &amp; Core Team</h2>
      <p class="lead measure">The centre is guided by experienced faculty and driven by the passion of the CUSAT student team.</p>
    </div>
    <div class="team-grid">
      <div class="team-member rv">
        <div class="team-avatar">
          <div class="avatar-placeholder">CH</div>
        </div>
        <div class="team-info">
          <h3>Dr. Centre Head</h3>
          <p class="team-role">Director, KCC</p>
          <p class="team-bio">Leading the strategic vision and research initiatives at the Kalpana Chawla Centre.</p>
        </div>
      </div>
      <div class="team-member rv" style="--d:.1s">
        <div class="team-avatar">
          <div class="avatar-placeholder">FM</div>
        </div>
        <div class="team-info">
          <h3>Faculty Mentors</h3>
          <p class="team-role">Aerospace &amp; Electronics</p>
          <p class="team-bio">Guiding students in satellite design, telemetry, and payload development.</p>
        </div>
      </div>
      <div class="team-member rv" style="--d:.2s">
        <div class="team-avatar">
          <div class="avatar-placeholder">CS</div>
        </div>
        <div class="team-info">
          <h3>CUSAT Student Team</h3>
          <p class="team-role">Engineers &amp; Operators</p>
          <p class="team-bio">The dedicated student body building the CUSAT nanosatellite and operating the ground station.</p>
        </div>
      </div>
    </div>
  </div>
</section>

"@

# Insert Team section right before Mission log
$html = $html -replace '(?s)(<section aria-label="Mission log">)', "$teamHtml`$1"

$html | Set-Content C:\Users\jittu\kcc-website\index.html -Encoding UTF8

$css = @"

/* ============ TEAM ============ */
.team-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
  margin-top: 2rem;
}
.team-member {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}
.team-member:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 30px rgba(0,0,0,0.05);
}
.team-avatar {
  width: 100px;
  height: 100px;
  margin: 0 auto 1.5rem;
  border-radius: 50%;
  background: var(--line);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 3px solid var(--saffron);
}
.avatar-placeholder {
  font-family: var(--display);
  font-size: 2rem;
  font-weight: bold;
  color: var(--muted);
}
.team-info h3 {
  font-size: 1.25rem;
  margin-bottom: 0.25rem;
}
.team-role {
  color: var(--saffron);
  font-family: var(--mono);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 1rem;
}
.team-bio {
  font-size: 0.95rem;
  color: var(--muted);
}
"@

Add-Content C:\Users\jittu\kcc-website\assets\css\style.css $css -Encoding UTF8
