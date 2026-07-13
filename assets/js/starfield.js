  // Scroll-driven Earth Zoom
  document.addEventListener('DOMContentLoaded', () => {
    const earthSvg = document.querySelector('.orbit-box svg');
    if (!earthSvg) return;
    
    window.addEventListener('scroll', () => {
      const scrollY = window.scrollY;
      const maxScroll = window.innerHeight * 0.8; 
      let progress = Math.min(scrollY / maxScroll, 1);
      const easeOutQuad = t => t * (2 - t);
      const scale = 1 + (1.4 * easeOutQuad(progress));
      earthSvg.style.transform = `scale(${scale})`;
    });
  });
