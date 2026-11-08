/**
 * 47OS Live Interactive Desktop Wallpaper
 * Animates the giant Neco Arc dark silhouette (Sprite 368):
 * - Ominous glowing cat eyes with mouse cursor tracking (pupil parallax)
 * - Natural blinking and menacing narrowing on clicks
 * - Analog CRT scanlines & breathing animation
 * - Periodic chromatic aberration glitch split
 * - Desktop click shockwave ripples
 * - Reacts to audio player playback
 */

class WallpaperManager {
  constructor() {
    this.wallpaperEl = document.getElementById('desktop-wallpaper');
    this.wrapEl = document.getElementById('wallpaper-neco-wrap');
    this.eyesEl = document.getElementById('wallpaper-eyes');
    this.eyeLeft = document.getElementById('eye-left');
    this.eyeRight = document.getElementById('eye-right');
    this.pupilLeft = document.getElementById('pupil-left');
    this.pupilRight = document.getElementById('pupil-right');
    this.glitchBar = document.getElementById('wallpaper-glitch-bar');
    this.desktop = document.getElementById('desktop');

    this.eyeLeftCenter = { x: 0, y: 0 };
    this.eyeRightCenter = { x: 0, y: 0 };

    this.init();
  }

  init() {
    this.updateEyeCenters();
    window.addEventListener('resize', () => this.updateEyeCenters());

    // Mouse tracking for pupils
    document.addEventListener('mousemove', (e) => this.onMouseMove(e));

    // Desktop background click ripple & eye reaction
    if (this.desktop) {
      this.desktop.addEventListener('click', (e) => {
        // Only trigger if clicking on background, not on icons or windows
        const isBg = e.target === this.desktop || 
                     e.target.id === 'desktop-wallpaper' || 
                     e.target.classList.contains('wallpaper-vignette') || 
                     e.target.classList.contains('wallpaper-crt-lines');
        if (isBg) {
          this.triggerClickRipple(e.clientX, e.clientY);
          this.triggerMenacingEyes();
        }
      });
    }

    // Natural Blinking Loop
    this.startBlinkLoop();

    // Occasional Chromatic Glitch Loop
    this.startGlitchLoop();

    // Glitch Bar Sweep Loop
    this.startGlitchBarSweep();

    // Watch Audio Player State
    this.watchPlayerState();
  }

  updateEyeCenters() {
    if (this.eyeLeft && this.eyeRight) {
      const rectL = this.eyeLeft.getBoundingClientRect();
      const rectR = this.eyeRight.getBoundingClientRect();
      this.eyeLeftCenter = {
        x: rectL.left + rectL.width / 2,
        y: rectL.top + rectL.height / 2
      };
      this.eyeRightCenter = {
        x: rectR.left + rectR.width / 2,
        y: rectR.top + rectR.height / 2
      };
    }
  }

  onMouseMove(e) {
    if (!this.pupilLeft || !this.pupilRight) return;

    if (this.eyeLeftCenter.x === 0) {
      this.updateEyeCenters();
    }

    // Calculate offset for left eye
    const dxL = e.clientX - this.eyeLeftCenter.x;
    const dyL = e.clientY - this.eyeLeftCenter.y;
    const distL = Math.hypot(dxL, dyL);
    const maxOffset = 9; // max pupil offset in pixels for large oval eyes
    const moveL = Math.min(distL / 180, 1) * maxOffset;
    const angleL = Math.atan2(dyL, dxL);
    const oxL = Math.cos(angleL) * moveL;
    const oyL = Math.sin(angleL) * moveL;

    // Calculate offset for right eye
    const dxR = e.clientX - this.eyeRightCenter.x;
    const dyR = e.clientY - this.eyeRightCenter.y;
    const distR = Math.hypot(dxR, dyR);
    const moveR = Math.min(distR / 180, 1) * maxOffset;
    const angleR = Math.atan2(dyR, dxR);
    const oxR = Math.cos(angleR) * moveR;
    const oyR = Math.sin(angleR) * moveR;

    const pxL = Math.round(oxL);
    const pyL = Math.round(oyL);
    const pxR = Math.round(oxR);
    const pyR = Math.round(oyR);

    this.pupilLeft.style.transform = `translate(${pxL}px, ${pyL}px)`;
    this.pupilRight.style.transform = `translate(${pxR}px, ${pyR}px)`;
  }

  startBlinkLoop() {
    const scheduleNextBlink = () => {
      const delay = 4000 + Math.random() * 6000; // blink every 4-10 seconds
      setTimeout(() => {
        if (this.eyesEl) {
          this.eyesEl.classList.add('blinking');
          setTimeout(() => {
            this.eyesEl.classList.remove('blinking');
            // 25% chance of quick double blink
            if (Math.random() < 0.25) {
              setTimeout(() => {
                this.eyesEl.classList.add('blinking');
                setTimeout(() => this.eyesEl.classList.remove('blinking'), 120);
              }, 160);
            }
            scheduleNextBlink();
          }, 140);
        } else {
          scheduleNextBlink();
        }
      }, delay);
    };
    scheduleNextBlink();
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

    setTimeout(() => {
      if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
    }, 600);
  }

  triggerMenacingEyes() {
    if (!this.eyesEl) return;
    this.eyesEl.classList.add('menacing');
    setTimeout(() => {
      this.eyesEl.classList.remove('menacing');
    }, 650);
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
