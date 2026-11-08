/**
 * 47OS Neco Arc Autonomous Daemon - Melty Blood Type Lumina Edition
 * Implements 47R's exact sprite map, parry block on clicks, real walk & lookback,
 * underground digging spawn, dances, phone animations, and hit sound effects.
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
    this.isBlocking = false;
    this.idleCountdown = 15;
    
    // Quotes
    this.phrases = [
      "Buru-nyuu~!",
      "Парировано!",
      "Блок!",
      "Не попал!",
      "47R тут главный, а я надзиратель.",
      "Руки от курсора убрал!",
      "Где мой пилк (Pilk)?!",
      "Слушай джаз и не выпендривайся."
    ];
    
    // Hit sounds list from 2100 to 2107 (a and b)
    this.hitSoundNames = [];
    for (let i = 2100; i <= 2107; i++) {
      this.hitSoundNames.push(`hit_${i}_a.wav`);
      this.hitSoundNames.push(`hit_${i}_b.wav`);
    }

    // Audio pool
    this.sounds = {
      bonjour: new Audio('assets/audio/bonjour.wav'),
      arigato: new Audio('assets/audio/arigato.wav'),
      goodbye: new Audio('assets/audio/goodbye.wav'),
      block_sfx: new Audio('assets/audio/sfx_block.wav'),
      burunyuu: new Audio('assets/audio/burunyuu.wav')
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
    this.spawnFromGround();

    // Mouse tracking
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));

    // Parry / Block when mouse clicks or holds on Neco
    this.el.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this.onParryHit();
    });

    // Touch support for mobile
    this.el.addEventListener('touchstart', (e) => {
      e.stopPropagation();
      this.onParryHit();
    }, { passive: true });

    // Window resize
    window.addEventListener('resize', () => {
      const floorY = window.innerHeight - 128;
      if (this.y >= floorY - 30) this.y = floorY;
      this.x = Math.min(this.x, window.innerWidth - 100);
      this.updatePosition();
    });

    // Wandering loop
    setInterval(() => this.behaviorLoop(), 4200);
    // Idle watcher
    setInterval(() => this.idleWatcher(), 1000);
  }

  playRandomHitSound() {
    try {
      const idx = Math.floor(Math.random() * this.hitSoundNames.length);
      const audio = new Audio(`assets/audio/${this.hitSoundNames[idx]}`);
      audio.volume = 0.22;
      audio.play().catch(() => {});

      // Impact SFX
      if (this.sounds.block_sfx) {
        this.sounds.block_sfx.currentTime = 0;
        this.sounds.block_sfx.volume = 0.20;
        this.sounds.block_sfx.play().catch(() => {});
      }
    } catch (e) {}
  }

  playVoice(name, vol = 0.25) {
    try {
      const snd = this.sounds[name];
      if (snd) {
        snd.currentTime = 0;
        snd.volume = vol;
        snd.play().catch(() => {});
      }
    } catch (e) {}
  }

  speak(text, duration = 2800) {
    if (!this.speechEl) return;
    this.speechEl.textContent = text;
    this.speechEl.style.display = 'block';
    clearTimeout(this.speechTimer);
    this.speechTimer = setTimeout(() => {
      this.speechEl.style.display = 'none';
    }, duration);
  }

  setState(stateName, onComplete = null) {
    if (this.currentState === stateName && this.frameTimer) return;
    this.currentState = stateName;
    this.currentFrame = 0;

    if (!this.manifest || !this.manifest[stateName]) {
      this.imgEl.src = `assets/neco/${stateName}_0.png`;
      return;
    }

    const anim = this.manifest[stateName];
    clearInterval(this.frameTimer);

    if (anim.frames && anim.frames.length > 0) {
      this.imgEl.src = anim.frames[0];
    }

    this.frameTimer = setInterval(() => {
      if (!anim.frames || anim.frames.length === 0) return;
      this.currentFrame++;
      
      if (this.currentFrame >= anim.frames.length) {
        if (onComplete) {
          clearInterval(this.frameTimer);
          onComplete();
          return;
        }
        this.currentFrame = 0;
      }
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

  spawnFromGround() {
    this.isMoving = true;
    this.setState('spawn_ground', () => {
      this.playVoice('bonjour', 0.3);
      this.speak("Бонжур!", 2500);
      this.setState('idle');
      this.isMoving = false;
    });
  }

  onParryHit() {
    this.idleCountdown = 15;
    this.isMoving = false;
    clearInterval(this.moveInterval);

    // Parry block animation
    this.setState('parry');
    this.playRandomHitSound();

    const parryQuotes = ["Парировано!", "Блок!", "Мимо!", "Ха! Слабо!", "Buru-nyuu~"];
    this.speak(parryQuotes[Math.floor(Math.random() * parryQuotes.length)], 1200);

    setTimeout(() => {
      if (this.currentState === 'parry') {
        this.setState('idle');
      }
    }, 700);
  }

  onMouseMove(e) {
    this.idleCountdown = 15;
    if (this.currentState === 'lie_idle' || this.currentState === 'phone') {
      this.wakeUp();
    }
  }

  wakeUp() {
    this.playVoice('arigato', 0.25);
    this.setState('happy_wave', () => {
      this.setState('idle');
    });
  }

  /**
   * Smooth movement with True Walk (690-701) or Lookback Walk (702-713) or Dash (725-730)
   */
  walkTo(targetX, targetY, speed = 2.5, onArrival = null) {
    this.isMoving = true;
    this.targetX = targetX;
    this.targetY = targetY;
    this.facing = targetX > this.x ? 1 : -1;
    this.updatePosition();

    // Pick animation: dash if fast, lookback walk or normal walk
    if (speed > 4) {
      this.setState('dash');
    } else {
      const useLookback = Math.random() < 0.35;
      this.setState(useLookback ? 'walk_lookback' : 'walk');
    }

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

  /**
   * Digs into ground -> Teleport glitch -> Digs out at destination
   */
  digTeleport(targetX, targetY, onComplete = null) {
    if (this.isMoving) return;
    this.isMoving = true;
    clearInterval(this.moveInterval);

    this.setState('dig_in', () => {
      // Trigger CRT Screen Glitch
      document.body.classList.add('teleport-glitch');
      this.x = targetX;
      this.y = targetY;
      this.updatePosition();

      setTimeout(() => {
        document.body.classList.remove('teleport-glitch');
        this.setState('dig_out', () => {
          this.setState('idle');
          this.isMoving = false;
          if (onComplete) onComplete();
        });
      }, 150);
    });
  }

  behaviorLoop() {
    if (this.isMoving || this.isEnforcingMusic || this.isBlocking || 
        ['parry', 'stomp', 'spawn_ground', 'dig_in', 'dig_out'].includes(this.currentState)) {
      return;
    }

    const action = Math.random();
    const floorY = window.innerHeight - 128;
    const activeBounds = window.winManager ? window.winManager.getActiveWindowBounds() : null;

    if (action < 0.20 && activeBounds && activeBounds.top > 50 && activeBounds.width > 200) {
      // Dig-teleport onto active window titlebar!
      const targetX = Math.max(30, Math.min(window.innerWidth - 120, activeBounds.left + 50));
      const targetY = Math.max(20, activeBounds.top - 70);
      this.digTeleport(targetX, targetY);
    } else if (action < 0.50) {
      // Walk on surface
      const minX = 40;
      const maxX = window.innerWidth - 120;
      const targetX = Math.floor(Math.random() * (maxX - minX)) + minX;
      this.walkTo(targetX, this.y, 2.5);
    } else if (action < 0.65) {
      // Teleport across screen or drop back down to taskbar
      const targetY = (this.y < floorY - 30) ? floorY : this.y;
      const targetX = Math.floor(Math.random() * (window.innerWidth - 160)) + 40;
      this.digTeleport(targetX, targetY);
    } else if (action < 0.78) {
      // Turn around
      this.facing = this.facing * -1;
      this.updatePosition();
      this.setState('turn', () => {
        if (!this.isMoving) this.setState('idle');
      });
    } else if (action < 0.88) {
      // Fun mini-action: Dance or Epic pose!
      const randAct = Math.random();
      if (randAct < 0.35) {
        this.setState('dance1', () => this.setState('idle'));
      } else if (randAct < 0.70) {
        this.setState('epic', () => this.setState('idle'));
      } else {
        this.setState('laugh', () => this.setState('idle'));
      }
    } else {
      this.setState('idle');
    }
  }

  idleWatcher() {
    this.idleCountdown--;
    if (this.idleCountdown <= 0 && this.currentState === 'idle' && !this.isMoving && !this.isEnforcingMusic) {
      // Relax: either look at phone or lie down and kick legs!
      if (Math.random() < 0.5) {
        this.setState('phone');
      } else {
        this.setState('lie_idle');
      }
    }
  }

  enforceMusic(playerWindowEl, onPlayResume) {
    if (this.isEnforcingMusic) return;
    this.isEnforcingMusic = true;
    clearInterval(this.moveInterval);
    this.isMoving = false;

    // Stomp feet angrily! (971-972)
    this.speak("ЭЙ! КТО МУЗЫКУ ВЫКЛЮЧИЛ?!", 2600);
    this.setState('stomp', () => {
      const rect = playerWindowEl.getBoundingClientRect();
      const targetX = Math.max(10, rect.left + 30);
      const targetY = Math.max(10, rect.top + 20);

      this.speak("СЕЙЧАС ВКЛЮЧУ ОБРАТНО!", 2200);

      // Dash or dig-teleport to player!
      if (Math.hypot(targetX - this.x, targetY - this.y) > 350) {
        this.digTeleport(targetX + 50, targetY, () => {
          this.walkTo(targetX, targetY, 6, () => this.hitPlay(onPlayResume));
        });
      } else {
        this.walkTo(targetX, targetY, 6, () => this.hitPlay(onPlayResume));
      }
    });
  }

  hitPlay(onPlayResume) {
    this.setState('epic');
    this.playVoice('burunyuu', 0.25);
    setTimeout(() => {
      onPlayResume();
      this.speak("Так-то лучше. Слушай джаз.", 2500);
      this.isEnforcingMusic = false;
      setTimeout(() => {
        this.walkTo(this.x, window.innerHeight - 128, 3);
      }, 1500);
    }, 600);
  }

  reactToEmptyTrash() {
    this.setState('stomp', () => {
      this.setState('idle');
    });
    this.speak("ТЫ КУДА МОИ ЗАПАСЫ ПИЛКА ВЫКИНУЛ?! ВЕРНИ ОБРАТНО!", 3500);
  }
}

window.necoPet = new NecoPet();
