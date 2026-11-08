/**
 * 47OS Neco Arc Autonomous Daemon
 * Wanders screen, tracks cursor, oversees the user, enforces music playback.
 */

class NecoPet {
  constructor() {
    this.el = document.getElementById('neco-pet');
    this.imgEl = this.el.querySelector('img');
    this.speechEl = this.el.querySelector('.neco-speech');
    
    // Physics & State
    this.x = Math.max(50, window.innerWidth - 180);
    this.y = window.innerHeight - 128; // On taskbar
    this.targetX = this.x;
    this.targetY = this.y;
    this.vx = 0;
    this.facing = -1; // -1 = left, 1 = right
    this.currentState = 'idle';
    this.currentFrame = 0;
    this.frameTimer = null;
    this.stateTimer = null;
    this.idleCountdown = 12; // seconds to sleep
    
    // Quotes
    this.phrases = [
      "Buru-nyuu~!",
      "Че смотришь? Код пиши!",
      "47R тут главный, а я надзиратель.",
      "Руки от курсора убрал!",
      "Где мой пилк (Pilk)?!",
      "Обнаружен нарушитель периметра!",
      "Слушай джаз и не выпендривайся."
    ];
    
    // Sound FX
    this.sounds = {
      burunyuu: new Audio('assets/audio/burunyuu.wav'),
      nya: new Audio('assets/audio/nya.wav'),
      alert: new Audio('assets/audio/alert.wav'),
      angry: new Audio('assets/audio/angry.wav'),
      laugh: new Audio('assets/audio/laugh.wav')
    };

    // Load animations manifest
    this.manifest = null;
    this.init();
  }

  async init() {
    try {
      const res = await fetch('assets/neco/manifest.json');
      this.manifest = await res.json();
    } catch (e) {
      console.warn("Could not load neco manifest, using fallback frames:", e);
    }

    this.updatePosition();
    this.setState('idle');

    // Mouse tracking
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));

    // Interaction click
    this.el.addEventListener('click', () => this.onPoke());

    // Window resize
    window.addEventListener('resize', () => {
      this.y = Math.min(this.y, window.innerHeight - 128);
      this.x = Math.min(this.x, window.innerWidth - 100);
      this.updatePosition();
    });

    // Start behavior loop
    setInterval(() => this.behaviorLoop(), 3000);
    setInterval(() => this.idleWatcher(), 1000);
  }

  playSound(name) {
    try {
      const snd = this.sounds[name];
      if (snd) {
        snd.currentTime = 0;
        snd.volume = 0.6;
        snd.play().catch(() => {});
      }
    } catch (e) {}
  }

  speak(text, duration = 3000) {
    if (!this.speechEl) return;
    this.speechEl.textContent = text;
    this.speechEl.style.display = 'block';
    clearTimeout(this.speechTimer);
    this.speechTimer = setTimeout(() => {
      this.speechEl.style.display = 'none';
    }, duration);
  }

  setState(stateName) {
    if (this.currentState === stateName && this.frameTimer) return;
    this.currentState = stateName;
    this.currentFrame = 0;

    if (!this.manifest || !this.manifest[stateName]) {
      // Fallback
      this.imgEl.src = `assets/neco/${stateName}_0.png`;
      return;
    }

    const anim = this.manifest[stateName];
    clearInterval(this.frameTimer);

    this.frameTimer = setInterval(() => {
      if (!anim.frames || anim.frames.length === 0) return;
      this.currentFrame = (this.currentFrame + 1) % anim.frames.length;
      this.imgEl.src = anim.frames[this.currentFrame];
    }, anim.speed || 100);

    // Initial frame
    if (anim.frames && anim.frames.length > 0) {
      this.imgEl.src = anim.frames[0];
    }
  }

  updatePosition() {
    this.el.style.left = `${this.x}px`;
    this.el.style.top = `${this.y}px`;
    this.el.style.transform = `scaleX(${this.facing})`;
  }

  onMouseMove(e) {
    this.idleCountdown = 15;
    if (this.currentState === 'sleep') {
      this.wakeUp();
    }
  }

  onPoke() {
    this.idleCountdown = 15;
    this.playSound('burunyuu');
    this.setState('shock');
    
    // Pick phrase
    const quote = this.phrases[Math.floor(Math.random() * this.phrases.length)];
    this.speak(quote);

    setTimeout(() => {
      if (this.currentState === 'shock') {
        this.setState('idle');
      }
    }, 1500);
  }

  wakeUp() {
    this.playSound('nya');
    this.setState('turn');
    setTimeout(() => this.setState('idle'), 600);
  }

  behaviorLoop() {
    if (this.isEnforcingMusic || this.currentState === 'shock' || this.currentState === 'sleep') {
      return;
    }

    // Chance to walk somewhere on taskbar or active window
    const action = Math.random();

    if (action < 0.45) {
      // Walk to random X on current floor
      const minX = 40;
      const maxX = window.innerWidth - 120;
      const targetX = Math.floor(Math.random() * (maxX - minX)) + minX;
      this.walkTo(targetX, this.y);
    } else if (action < 0.7) {
      // Look around
      this.facing = this.facing * -1;
      this.setState('turn');
      setTimeout(() => {
        if (this.currentState === 'turn') this.setState('idle');
      }, 800);
    } else {
      this.setState('idle');
    }
  }

  idleWatcher() {
    this.idleCountdown--;
    if (this.idleCountdown <= 0 && this.currentState === 'idle' && !this.isEnforcingMusic) {
      this.setState('sleep');
    }
  }

  walkTo(targetX, targetY, speed = 3, onArrival = null) {
    this.targetX = targetX;
    this.targetY = targetY;
    this.facing = targetX > this.x ? 1 : -1;
    this.setState(speed > 4 ? 'run' : 'walk');

    clearInterval(this.moveInterval);
    this.moveInterval = setInterval(() => {
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const dist = Math.hypot(dx, dy);

      if (dist < speed + 2) {
        this.x = this.targetX;
        this.y = this.targetY;
        this.updatePosition();
        clearInterval(this.moveInterval);
        this.setState('idle');
        if (onArrival) onArrival();
        return;
      }

      this.x += (dx / dist) * speed;
      this.y += (dy / dist) * speed;
      this.updatePosition();
    }, 30);
  }

  /**
   * Enforce music playback when user dares to pause
   */
  enforceMusic(playerWindowEl, onPlayResume) {
    if (this.isEnforcingMusic) return;
    this.isEnforcingMusic = true;
    clearInterval(this.moveInterval);

    this.playSound('angry');
    this.speak("ЭЙ! КТО МУЗЫКУ ВЫКЛЮЧИЛ?!", 3500);
    this.setState('shock');

    setTimeout(() => {
      // Find player window coordinates
      const rect = playerWindowEl.getBoundingClientRect();
      const targetX = Math.max(10, rect.left + 40);
      const targetY = Math.max(10, rect.top + 20);

      this.speak("СЕЙЧАС ВКЛЮЧУ ОБРАТНО!", 2500);
      this.walkTo(targetX, targetY, 7, () => {
        // Arrived at player
        this.setState('shock');
        this.playSound('burunyuu');
        setTimeout(() => {
          onPlayResume();
          this.speak("Так-то лучше. Слушай джаз.", 2500);
          this.isEnforcingMusic = false;
          // Walk back down to taskbar after a moment
          setTimeout(() => {
            this.walkTo(this.x, window.innerHeight - 128, 4);
          }, 1500);
        }, 500);
      });
    }, 1000);
  }

  /**
   * React to empty recycle bin
   */
  reactToEmptyTrash() {
    this.playSound('alert');
    this.setState('shock');
    this.speak("ТЫ КУДА МОИ ЗАПАСЫ ПИЛКА ВЫКИНУЛ?! ВЕРНИ ОБРАТНО!", 4000);
    setTimeout(() => {
      this.setState('idle');
    }, 2000);
  }
}

window.necoPet = new NecoPet();
