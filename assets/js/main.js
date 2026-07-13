(function(){
  "use strict";
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- nav ---- */
  var hdr = document.getElementById("hdr");
  addEventListener("scroll", function(){ hdr.classList.toggle("scrolled", scrollY > 12); }, {passive:true});
  var burger = document.getElementById("burger");
  burger.addEventListener("click", function(){
    var open = document.body.classList.toggle("nav-open");
    burger.setAttribute("aria-expanded", open);
  });
  document.getElementById("navlinks").addEventListener("click", function(e){
    if (e.target.tagName === "A"){ document.body.classList.remove("nav-open"); burger.setAttribute("aria-expanded","false"); }
  });

  document.getElementById("yr").textContent = new Date().getFullYear();

  /* ---- reveal on scroll ---- */
  var rv = [].slice.call(document.querySelectorAll(".rv"));
  if (reduce || !("IntersectionObserver" in window)){
    rv.forEach(function(el){ el.classList.add("in"); });
  } else {
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if (en.isIntersecting){ en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, {threshold:.12, rootMargin:"0px 0px -6% 0px"});
    rv.forEach(function(el){ io.observe(el); });
  }

  /* ---- stat count-up ---- */
  var counters = [].slice.call(document.querySelectorAll("[data-count]"));
  function runCounter(el){
    var end = +el.getAttribute("data-count"), t0 = null, dur = 1150;
    function step(t){
      if (!t0) t0 = t;
      var p = Math.min((t - t0)/dur, 1), e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(end * e);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if (reduce || !("IntersectionObserver" in window)){
    counters.forEach(function(el){ el.textContent = el.getAttribute("data-count"); });
  } else {
    var cio = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if (en.isIntersecting){ runCounter(en.target); cio.unobserve(en.target); }
      });
    }, {threshold:.6});
    counters.forEach(function(el){ cio.observe(el); });
  }

  /* ---- starfield ---- */
  var cv = document.getElementById("stars"), cx = cv.getContext("2d");
  var hero = document.getElementById("hero");
  var stars = [], meteor = null, nextMeteor = 0, running = false, raf = 0;
  function sizeStars(){
    var dpr = Math.min(devicePixelRatio || 1, 2);
    var w = hero.clientWidth, h = hero.clientHeight;
    cv.width = w * dpr; cv.height = h * dpr;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = [];
    var n = Math.round((w * h) / 7800);
    for (var i = 0; i < n; i++){
      stars.push({
        x: Math.random() * w, y: Math.random() * h,
        r: .35 + Math.random() * 1.05,
        base: .25 + Math.random() * .55,
        amp: Math.random() * .4,
        ph: Math.random() * Math.PI * 2,
        sp: .4 + Math.random() * 1.1,
        tint: Math.random() < .12
      });
    }
  }
  function drawStars(t){
    var w = hero.clientWidth, h = hero.clientHeight;
    cx.clearRect(0, 0, w, h);
    for (var i = 0; i < stars.length; i++){
      var s = stars[i];
      var a = s.base + (reduce ? 0 : Math.sin(t/1000 * s.sp + s.ph) * s.amp);
      a = Math.max(.06, Math.min(1, a));
      cx.beginPath();
      cx.arc(s.x, s.y, s.r, 0, 6.2832);
      cx.fillStyle = s.tint ? "rgba(111,216,232," + a * .9 + ")" : "rgba(234,238,247," + a + ")";
      cx.fill();
    }
    if (!reduce){
      if (!meteor && t > nextMeteor){
        var mx = w * (.15 + Math.random() * .7);
        meteor = {x: mx, y: h * .08 + Math.random() * h * .2, vx: -(3 + Math.random()*2), vy: 1.4 + Math.random(), life: 1};
      }
      if (meteor){
        meteor.x += meteor.vx * 3; meteor.y += meteor.vy * 3; meteor.life -= .022;
        if (meteor.life <= 0){ meteor = null; nextMeteor = t + 8000 + Math.random() * 9000; }
        else {
          var g = cx.createLinearGradient(meteor.x, meteor.y, meteor.x - meteor.vx * 16, meteor.y - meteor.vy * 16);
          g.addColorStop(0, "rgba(234,238,247," + (.75 * meteor.life) + ")");
          g.addColorStop(1, "rgba(234,238,247,0)");
          cx.strokeStyle = g; cx.lineWidth = 1.1;
          cx.beginPath();
          cx.moveTo(meteor.x, meteor.y);
          cx.lineTo(meteor.x - meteor.vx * 16, meteor.y - meteor.vy * 16);
          cx.stroke();
        }
      }
    }
  }
  function loopStars(t){ if (!running) return; drawStars(t); if (reduce){ running = false; return; } raf = requestAnimationFrame(loopStars); }
  function startStars(){ if (!running){ running = true; raf = requestAnimationFrame(loopStars); } }
  function stopStars(){ running = false; cancelAnimationFrame(raf); }
  sizeStars(); startStars();
  addEventListener("resize", function(){ sizeStars(); if (reduce){ running = true; requestAnimationFrame(loopStars); } });
  if ("IntersectionObserver" in window){
    new IntersectionObserver(function(en){
      var vis = en[0].isIntersecting;
      hero.classList.toggle("offstage", !vis);
      if (!reduce){ vis ? startStars() : stopStars(); }
    }, {threshold:.02}).observe(hero);
  }
  document.addEventListener("visibilitychange", function(){
    if (!reduce){ document.hidden ? stopStars() : startStars(); }
  });

  /* ---- ground-track panel ---- */
  var tp = document.getElementById("track"), tctx = tp.getContext("2d");
  var panel = tp.parentElement, tRunning = false, tRaf = 0;
  var STN = {lon: 76.57, lat: 30.77};
  function tSize(){
    var dpr = Math.min(devicePixelRatio || 1, 2);
    tp.width = panel.clientWidth * dpr; tp.height = panel.clientHeight * dpr;
    tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function trackY(x, w, h, amp, phase){
    return h/2 + Math.sin((x / w) * Math.PI * 2 + phase) * (h * amp);
  }
  function drawTrack(t){
    var w = panel.clientWidth, h = panel.clientHeight;
    tctx.clearRect(0, 0, w, h);
    // dot grid "map"
    tctx.fillStyle = "rgba(148,166,201,.18)";
    for (var gx = 12; gx < w - 6; gx += 17){
      for (var gy = 16; gy < h - 8; gy += 17){
        tctx.fillRect(gx, gy, 1.4, 1.4);
      }
    }
    // dim tracks
    var dims = [{a:.24, p: 1.1}, {a:.3, p: 3.9}];
    dims.forEach(function(d){
      tctx.strokeStyle = "rgba(111,216,232,.22)"; tctx.lineWidth = 1;
      tctx.beginPath();
      for (var x = 0; x <= w; x += 4){
        var y = trackY(x, w, h, d.a, d.p);
        x === 0 ? tctx.moveTo(x, y) : tctx.lineTo(x, y);
      }
      tctx.stroke();
    });
    // active track
    tctx.strokeStyle = "rgba(111,216,232,.85)"; tctx.lineWidth = 1.4;
    tctx.beginPath();
    for (var x2 = 0; x2 <= w; x2 += 3){
      var y2 = trackY(x2, w, h, .27, 5.4);
      x2 === 0 ? tctx.moveTo(x2, y2) : tctx.lineTo(x2, y2);
    }
    tctx.stroke();
    // satellite on active track
    var prog = reduce ? .62 : ((t / 14000) % 1);
    var sx = prog * w, sy = trackY(sx, w, h, .27, 5.4);
    tctx.fillStyle = "#6FD8E8";
    tctx.beginPath(); tctx.arc(sx, sy, 3.2, 0, 6.2832); tctx.fill();
    tctx.strokeStyle = "rgba(111,216,232,.35)";
    tctx.beginPath(); tctx.arc(sx, sy, 7.5, 0, 6.2832); tctx.stroke();
    // station marker at true coordinates (equirectangular)
    var px = ((STN.lon + 180) / 360) * w, py = ((90 - STN.lat) / 180) * h;
    var pulse = reduce ? .5 : (t / 1400) % 1;
    tctx.fillStyle = "#F5A62B";
    tctx.save(); tctx.translate(px, py); tctx.rotate(Math.PI/4); tctx.fillRect(-3, -3, 6, 6); tctx.restore();
    tctx.strokeStyle = "rgba(245,166,43," + (.55 * (1 - pulse)) + ")";
    tctx.beginPath(); tctx.arc(px, py, 5 + pulse * 14, 0, 6.2832); tctx.stroke();
    tctx.fillStyle = "rgba(245,166,43,.9)";
    tctx.font = "600 9px ui-monospace, Consolas, monospace";
    tctx.fillText("GHARUAN GCS", px + 12, py + 3);
  }
  function tLoop(t){ if (!tRunning) return; drawTrack(t); if (reduce){ tRunning = false; return; } tRaf = requestAnimationFrame(tLoop); }
  function tStart(){ if (!tRunning){ tRunning = true; tRaf = requestAnimationFrame(tLoop); } }
  function tStop(){ tRunning = false; cancelAnimationFrame(tRaf); }
  tSize();
  addEventListener("resize", function(){ tSize(); if (reduce){ tRunning = true; requestAnimationFrame(tLoop); } });
  if ("IntersectionObserver" in window){
    new IntersectionObserver(function(en){
      if (!reduce){ en[0].isIntersecting ? tStart() : tStop(); }
      else if (en[0].isIntersecting){ drawTrack(0); }
    }, {threshold:.05}).observe(panel);
  } else { tStart(); }
})();

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
