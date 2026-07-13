$html = Get-Content C:\Users\jittu\kcc-website\index.html -Raw

$passesHtml = @"
    <div class="passes-panel rv" style="--d:.2s">
      <div class="console-bar"><i></i><i></i><i></i><span>UPCOMING PASSES — KCC STATION</span></div>
      <table class="passes-table">
        <thead>
          <tr>
            <th>Satellite</th>
            <th>AOS (Local)</th>
            <th>Max Elev</th>
            <th>Freq</th>
          </tr>
        </thead>
        <tbody id="passes-body">
          <tr>
            <td>NOAA-15</td>
            <td>10:45 AM</td>
            <td>45&deg;</td>
            <td>137.620 MHz</td>
          </tr>
          <tr>
            <td>ISS (ZARYA)</td>
            <td>2:30 PM</td>
            <td>70&deg;</td>
            <td>145.800 MHz</td>
          </tr>
          <tr>
            <td>CUSAT (Sim)</td>
            <td>5:15 PM</td>
            <td>25&deg;</td>
            <td>437.400 MHz</td>
          </tr>
        </tbody>
      </table>
      <div class="passes-footer">
        <a href="https://network.satnogs.org" target="_blank" rel="noopener">Live on SatNOGS Network &rarr;</a>
      </div>
    </div>
"@

$html = $html -replace '(?s)(<div class="gs-notes">.*?</div>)', "`$1`n$passesHtml"

$html | Set-Content C:\Users\jittu\kcc-website\index.html -Encoding UTF8

$css = @"

/* ============ UPCOMING PASSES ============ */
.passes-panel {
  background: var(--ink);
  color: var(--saffron);
  font-family: var(--mono);
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
  margin-top: 3rem;
  border: 1px solid var(--muted);
}
.passes-panel .console-bar {
  background: var(--muted);
  color: var(--void);
  padding: .4rem .8rem;
  font-size: .75rem;
  display: flex;
  align-items: center;
  gap: .5rem;
}
.passes-table {
  width: 100%;
  border-collapse: collapse;
  font-size: .85rem;
  text-align: left;
}
.passes-table th, .passes-table td {
  padding: .8rem 1.2rem;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}
.passes-table th {
  color: var(--faint);
  font-weight: 600;
  letter-spacing: .05em;
  text-transform: uppercase;
}
.passes-table td {
  color: #a0aec0;
}
.passes-table td:first-child {
  color: var(--saffron);
  font-weight: bold;
}
.passes-footer {
  padding: 1rem;
  text-align: center;
  background: rgba(255,255,255,0.02);
}
.passes-footer a {
  color: var(--saffron);
  text-decoration: none;
  font-size: .8rem;
  text-transform: uppercase;
  letter-spacing: .1em;
  transition: color 0.2s;
}
.passes-footer a:hover {
  color: var(--void);
}
"@

Add-Content C:\Users\jittu\kcc-website\assets\css\style.css $css -Encoding UTF8
