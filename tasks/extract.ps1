$lines = Get-Content C:\Users\jittu\kcc-website\index.html
$lines[9..380] | Set-Content C:\Users\jittu\kcc-website\assets\css\style.css -Encoding UTF8
$lines[885..1081] | Set-Content C:\Users\jittu\kcc-website\assets\js\main.js -Encoding UTF8
$lines[1084..1097] | Set-Content C:\Users\jittu\kcc-website\assets\js\starfield.js -Encoding UTF8

$newHtml = @()
$newHtml += $lines[0..7]
$newHtml += '<link rel="stylesheet" href="assets/css/style.css">'
$newHtml += $lines[382..883]
$newHtml += '<script src="assets/js/main.js"></script>'
$newHtml += '<script src="assets/js/starfield.js"></script>'
$newHtml += $lines[1099..($lines.Length - 1)]

$newHtml | Set-Content C:\Users\jittu\kcc-website\index.html -Encoding UTF8
