$html = Get-Content C:\Users\jittu\kcc-website\index.html -Raw

$galleryHtml = @"
<section id="gallery">
  <div class="wrap">
    <div class="section-head center">
      <div class="eyebrow center">Photo Gallery</div>
      <h2>Inside the Centre</h2>
    </div>
    <div class="gallery-grid">
      <img src="assets/earth.jpg" alt="Earth view" class="gallery-item">
      <img src="assets/facility.jpg" alt="Facility" class="gallery-item">
      <img src="assets/ground_station.jpg" alt="Ground Station" class="gallery-item">
      <img src="assets/satellite.jpg" alt="Satellite" class="gallery-item">
      <img src="assets/visitors_wall.jpg" alt="Visitors Wall" class="gallery-item">
    </div>
  </div>
</section>

<!-- Lightbox Modal -->
<div id="lightbox" class="lightbox">
  <span class="lightbox-close">&times;</span>
  <img class="lightbox-content" id="lightbox-img">
  <div id="lightbox-caption"></div>
</div>
"@

# Insert gallery above visitors wall section
$html = $html -replace '(?s)(<section id="visitors-wall">)', "$galleryHtml`n`n`$1"

$html | Set-Content C:\Users\jittu\kcc-website\index.html -Encoding UTF8

# Append CSS
$css = @"

/* ============ GALLERY & LIGHTBOX ============ */
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}
.gallery-item {
  width: 100%;
  height: 200px;
  object-fit: cover;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}
.gallery-item:hover {
  transform: scale(1.03);
  box-shadow: 0 8px 16px rgba(0,0,0,0.3);
}

.lightbox {
  display: none;
  position: fixed;
  z-index: 999;
  padding-top: 60px;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  overflow: auto;
  background-color: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(5px);
}
.lightbox-content {
  margin: auto;
  display: block;
  max-width: 90%;
  max-height: 80vh;
  object-fit: contain;
  border-radius: 4px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
}
.lightbox-close {
  position: absolute;
  top: 20px;
  right: 35px;
  color: #fff;
  font-size: 40px;
  font-weight: bold;
  cursor: pointer;
  transition: 0.3s;
}
.lightbox-close:hover,
.lightbox-close:focus {
  color: var(--saffron);
  text-decoration: none;
  cursor: pointer;
}
#lightbox-caption {
  margin: auto;
  display: block;
  width: 80%;
  max-width: 700px;
  text-align: center;
  color: #ccc;
  padding: 15px 0;
  font-family: var(--mono);
}
"@

Add-Content C:\Users\jittu\kcc-website\assets\css\style.css $css -Encoding UTF8

# Append JS
$js = @"

// Lightbox Logic
document.addEventListener('DOMContentLoaded', () => {
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxCaption = document.getElementById('lightbox-caption');
  const closeBtn = document.querySelector('.lightbox-close');
  
  if(lightbox && lightboxImg) {
    document.querySelectorAll('.gallery-item').forEach(img => {
      img.addEventListener('click', (e) => {
        lightbox.style.display = 'block';
        lightboxImg.src = e.target.src;
        lightboxCaption.innerHTML = e.target.alt;
      });
    });

    closeBtn.addEventListener('click', () => {
      lightbox.style.display = 'none';
    });

    lightbox.addEventListener('click', (e) => {
      if(e.target === lightbox) {
        lightbox.style.display = 'none';
      }
    });

    document.addEventListener('keydown', (e) => {
      if(e.key === 'Escape' && lightbox.style.display === 'block') {
        lightbox.style.display = 'none';
      }
    });
  }
});
"@

Add-Content C:\Users\jittu\kcc-website\assets\js\main.js $js -Encoding UTF8
