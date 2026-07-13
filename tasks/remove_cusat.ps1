$html = Get-Content C:\Users\jittu\kcc-website\index.html -Raw

# 1. Meta descriptions
$html = $html -replace 'build the CUSAT nanosatellite, operate', 'operate'

# 2. Nav links
$html = $html -replace '(?m)^\s*<li><a href="#cusat">CUSAT</a></li>\s*\r?\n?', ''

# 3. Hero subtext
$html = $html -replace 'build the CUSAT nanosatellite, operate', 'operate'

# 4. SVG <g class="sat-cusat"> ... </g>
$html = $html -replace '(?s)<g class="sat-cusat".*?</g>', ''

# 5. <p class="orbit-tag">...CUSAT...</p>
$html = $html -replace '(?s)<p class="orbit-tag">.*?CUSAT.*?</p>', ''

# 6. About section list item
$html = $html -replace '(?m)^\s*<li>Ground control for CUSAT</li>\s*\r?\n?', ''

# 7. About section paragraph
$html = $html -replace '(?s)<p>The centre serves as the <strong>Ground Control Station</strong> for CUSAT,.*?</p>', ''

# 8. CUSAT Section
$html = $html -replace '(?s)<!-- ================= CUSAT ================= -->\s*<section id="cusat">.*?</section>\s*\r?\n?', ''

# 9. Ground station role
$html = $html -replace 'TT&amp;C FOR <em>CUSAT</em> A LEO', 'LEO'

# 10. Ground station track paragraph
$html = $html -replace 'including CUSAT once on orbit — pass after pass\.', 'pass after pass.'
$html = $html -replace 'including CUSAT once on orbit — pass after pass', 'pass after pass'
$html = $html -replace 'including CUSAT once on orbit \?\" pass after pass', 'pass after pass'
$html = $html -replace 'including CUSAT once on orbit — ', ''
$html = $html -replace 'including CUSAT once on orbit \?\" ', ''

# 11. Upcoming Passes table
$html = $html -replace 'CUSAT \(Sim\)', 'METEOR-M 2'

# 12. Team Section
$html = $html -replace 'passion of the CUSAT student team\.', 'passion of our student team.'
$html = $html -replace '<h3>CUSAT Student Team</h3>', '<h3>Student Team</h3>'
$html = $html -replace 'building the CUSAT nanosatellite and operating', 'operating'

# 13. Mission log
$html = $html -replace '(?s)<div class="log-entry rv">.*?CUSAT programme announced.*?</div>', ''

# 14. Visit section
$html = $html -replace 'Join the CUSAT team,', 'Join the team,'

$html | Set-Content C:\Users\jittu\kcc-website\index.html -Encoding UTF8
