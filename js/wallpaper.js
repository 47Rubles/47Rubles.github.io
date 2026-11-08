/**
 * 47OS Live Interactive Desktop Wallpaper
 * Animates the giant Neco Arc dark silhouette (Sprite 368):
 * - Clean, menacing translucent dark silhouette with breathing animation
 * - Analog CRT scanlines & periodic chromatic glitch split
 * - Desktop click shockwave ripple pulses
 * - Syncs with audio player playback
 */

class WallpaperManager {
  constructor() {
    this.wallpaperEl = document.getElementById('desktop-wallpaper');
    this.wrapEl = document.getElementById('wallpaper-neco-wrap');
    this.glitchBar = document.getElementById('wallpaper-glitch-bar');
    this.desktop = document.getElementById('desktop');

    this.init();
  }

  init() {
    // Desktop background click ripple
    if (this.desktop) {
      this.desktop.addEventListener('click', (e) => {
        const isBg = e.target === this.desktop || 
                     e.target.id === 'desktop-wallpaper' || 
                     e.target.classList.contains('wallpaper-vignette') || 
                     e.target.classList.contains('wallpaper-crt-lines');
        if (isBg) {
          this.triggerClickRipple(e.clientX, e.clientY);
        }
      });
    }

    // Occasional Chromatic Glitch Loop
    this.startGlitchLoop();

    // Glitch Bar Sweep Loop
    this.startGlitchBarSweep();

    // Watch Audio Player State
    this.watchPlayerState();
  }

  startGlitchLoop() {
    const scheduleNextGlitch = () => {
      const delay = 8000 + Math.random() * 12000; // glitch every 8-20 seconds
      setTimeout(() => {
        if (this.wrapEl) {
          this.wrapEl.classList.add('glitching');
          setTimeout(() => {
            this.wrapEl.classList.remove('glitching');
            scheduleNextGlitch();
          }, 240);
        } else {
          scheduleNextGlitch();
        }
      }, delay);
    };
    scheduleNextGlitch();
  }

  startGlitchBarSweep() {
    if (!this.glitchBar) return;
    const sweep = () => {
      const topStart = Math.random() * 70 + 10;
      this.glitchBar.style.top = `${topStart}%`;
      this.glitchBar.style.opacity = '0.85';

      let pos = topStart;
      const interval = setInterval(() => {
        pos += 2;
        this.glitchBar.style.top = `${pos}%`;
        if (pos > 90) {
          clearInterval(interval);
          this.glitchBar.style.opacity = '0';
          setTimeout(sweep, 4000 + Math.random() * 6000);
        }
      }, 30);
    };
    setTimeout(sweep, 2000);
  }

  triggerClickRipple(x, y) {
    const ripple = document.createElement('div');
    ripple.className = 'desktop-click-ripple';
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    document.body.appendChild(ripple);

    // Quick subtle pulse on silhouette
    if (this.wrapEl) {
      this.wrapEl.style.filter = 'drop-shadow(0 0 35px rgba(0, 255, 200, 0.6))';
      setTimeout(() => {
        if (this.wrapEl) {
          this.wrapEl.style.filter = '';
        }
      }, 400);
    }

    setTimeout(() => {
      if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
    }, 600);
  }

  watchPlayerState() {
    setInterval(() => {
      if (!this.wallpaperEl) return;
      const isPlaying = window.audioPlayer && window.audioPlayer.isPlaying;
      if (isPlaying) {
        if (!this.wallpaperEl.classList.contains('is-playing')) {
          this.wallpaperEl.classList.add('is-playing');
        }
      } else {
        if (this.wallpaperEl.classList.contains('is-playing')) {
          this.wallpaperEl.classList.remove('is-playing');
        }
      }
    }, 500);
  }
}

window.wallpaperMgr = new WallpaperManager();
