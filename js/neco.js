/**
 * 47OS Neco Arc Autonomous Daemon
 * Wanders screen, backdash-teleports with CRT glitch, oversees user, enforces music playback.
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
    this.facing = -1; // -1 = left, 1 = right
    this.currentState = 'idle';
    this.currentFrame = 0;
    this.frameTimer = null;
    this.moveInterval = null;
    this.isMoving = false;
    this.isEnforcingMusic = false;
    this.idleCountdown = 15; // seconds to sleep
    
    // Quotes (shown only when poked or triggered)
    this.phrases = [
      "Buru-nyuu~!",
      "Че смотришь? Код пиши!",
      "47R тут главный, а я надзиратель.",
      "Руки от курсора убрал!",
      "Где мой пилк (Pilk)?!",
      "Слушай джаз и не выпендривайся."
    ];
    
    // Sound FX with soft volume (0.15)
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
      console.warn("Could not load neco manifest:", e);
    }

    this.updatePosition();
    this.setState('idle');

    // Mouse tracking to wake up from sleep
    window.addEventListener('mousemove', () => this.onMouseMove());

    // Interaction click only on Neco herself
    this.el.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onPoke();
    });

    // Window resize
    window.addEventListener('resize', () => {
      const floorY = window.innerHeight - 128;
      if (this.y >= floorY - 30) this.y = floorY;
      this.x = Math.min(this.x, window.innerWidth - 100);
      this.updatePosition();
    });

    // Wandering loop
    setInterval(() => this.behaviorLoop(), 4000);
    // Idle watcher
    setInterval(() => this.idleWatcher(), 1000);
  }

  playSound(name) {
    try {
      const snd = this.sounds[name];
      if (snd) {
        snd.currentTime = 0;
        snd.volume = 0.15; // Soft volume
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
      this.imgEl.src = `assets/neco/${stateName}_0.png`;
      return;
    }

    const anim = this.manifest[stateName];
    clearInterval(this.frameTimer);

    // Initial frame
    if (anim.frames && anim.frames.length > 0) {
      this.imgEl.src = anim.frames[0];
    }

    this.frameTimer = setInterval(() => {
      if (!anim.frames || anim.frames.length === 0) return;
      this.currentFrame = (this.currentFrame + 1) % anim.frames.length;
      this.imgEl.src = anim.frames[this.currentFrame];
    }, anim.speed || 85);
  }

  updatePosition() {
    this.el.style.left = `${this.x}px`;
    this.el.style.top = `${this.y}px`;
    // Transform ONLY the img so the speech bubble is NEVER mirrored!
    if (this.imgEl) {
      this.imgEl.style.transform = `scaleX(${this.facing})`;
    }
  }

  onMouseMove() {
    this.idleCountdown = 15;
    if (this.currentState === 'sleep') {
      this.wakeUp();
    }
  }

  onPoke() {
    this.idleCountdown = 15;
    this.playSound('burunyuu');
    this.setState('shock');
    
    const quote = this.phrases[Math.floor(Math.random() * this.phrases.length)];
    this.speak(quote);

    setTimeout(() => {
      if (this.currentState === 'shock') {
        this.setState('idle');
      }
    }, 1200);
  }

  wakeUp() {
    this.playSound('nya');
    this.setState('turn');
    setTimeout(() => this.setState('idle'), 600);
  }

  teleportTo(targetX, targetY, onComplete = null) {
    if (this.isMoving) return;
    this.isMoving = true;
    
    // Invert facing because backdash leap is backwards
    this.facing = targetX < this.x ? 1 : -1;
    this.updatePosition();
    this.setState('backdash');

    // Trigger CRT Screen Glitch
    document.body.classList.add('teleport-glitch');

    setTimeout(() => {
      // Teleport coordinates in the middle of glitch
      this.x = targetX;
      this.y = targetY;
      this.updatePosition();
    }, 110);

    setTimeout(() => {
      document.body.classList.remove('teleport-glitch');
      this.setState('idle');
      this.isMoving = false;
      if (onComplete) onComplete();
    }, 280);
  }

  behaviorLoop() {
    // If currently moving, reacting or sleeping - do NOT interrupt
    if (this.isMoving || this.isEnforcingMusic || this.currentState === 'shock' || this.currentState === 'sleep') {
      return;
    }

    const action = Math.random();
    const floorY = window.innerHeight - 128;
    const activeBounds = window.winManager ? window.winManager.getActiveWindowBounds() : null;

    if (action < 0.22 && activeBounds && activeBounds.top > 50 && activeBounds.width > 200) {
      // Backdash-teleport onto active window titlebar!
      const targetX = Math.max(30, Math.min(window.innerWidth - 120, activeBounds.left + 50));
      const targetY = Math.max(20, activeBounds.top - 70);
      this.teleportTo(targetX, targetY);
    } else if (action < 0.45) {
      // Walk on current surface
      const minX = 40;
      const maxX = window.innerWidth - 120;
      const targetX = Math.floor(Math.random() * (maxX - minX)) + minX;
      this.walkTo(targetX, this.y, 2.5);
    } else if (action < 0.65) {
      // Teleport across screen or drop back down to taskbar
      const targetY = (this.y < floorY - 30) ? floorY : this.y;
      const targetX = Math.floor(Math.random() * (window.innerWidth - 160)) + 40;
      this.teleportTo(targetX, targetY);
    } else if (action < 0.82) {
      // Turn around
      this.facing = this.facing * -1;
      this.updatePosition();
      this.setState('turn');
      setTimeout(() => {
        if (!this.isMoving && this.currentState === 'turn') this.setState('idle');
      }, 700);
    } else {
      this.setState('idle');
    }
  }

  idleWatcher() {
    this.idleCountdown--;
    if (this.idleCountdown <= 0 && this.currentState === 'idle' && !this.isMoving && !this.isEnforcingMusic) {
      this.setState('sleep');
    }
  }

  walkTo(targetX, targetY, speed = 2.5, onArrival = null) {
    this.isMoving = true;
    this.targetX = targetX;
    this.targetY = targetY;
    this.facing = targetX > this.x ? 1 : -1;
    this.updatePosition();
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
        this.isMoving = false;
        this.setState('idle');
        if (onArrival) onArrival();
        return;
      }

      this.x += (dx / dist) * speed;
      this.y += (dy / dist) * speed;
      this.updatePosition();
    }, 35);
  }

  hitPlay(onPlayResume) {
    this.setState('shock');
    this.playSound('burunyuu');
    setTimeout(() => {
      onPlayResume();
      this.speak("Так-то лучше. Слушай джаз.", 2500);
      this.isEnforcingMusic = false;
      setTimeout(() => {
        this.walkTo(this.x, window.innerHeight - 128, 3);
      }, 1500);
    }, 500);
  }

  enforceMusic(playerWindowEl, onPlayResume) {
    if (this.isEnforcingMusic) return;
    this.isEnforcingMusic = true;
    clearInterval(this.moveInterval);
    this.isMoving = false;

    this.playSound('angry');
    this.speak("ЭЙ! КТО МУЗЫКУ ВЫКЛЮЧИЛ?!", 2800);
    this.setState('shock');

    setTimeout(() => {
      const rect = playerWindowEl.getBoundingClientRect();
      const targetX = Math.max(10, rect.left + 30);
      const targetY = Math.max(10, rect.top + 20);

      this.speak("СЕЙЧАС ВКЛЮЧУ ОБРАТНО!", 2500);

      // If far away, backdash-teleport closer with glitch!
      if (Math.hypot(targetX - this.x, targetY - this.y) > 350) {
        this.teleportTo(targetX + 50, targetY, () => {
          this.walkTo(targetX, targetY, 6, () => this.hitPlay(onPlayResume));
        });
      } else {
        this.walkTo(targetX, targetY, 6, () => this.hitPlay(onPlayResume));
      }
    }, 700);
  }

  reactToEmptyTrash() {
    this.playSound('alert');
    this.setState('shock');
    this.speak("ТЫ КУДА МОИ ЗАПАСЫ ПИЛКА ВЫКИНУЛ?! ВЕРНИ ОБРАТНО!", 3500);
    setTimeout(() => {
      this.setState('idle');
    }, 2000);
  }
}

window.necoPet = new NecoPet();
