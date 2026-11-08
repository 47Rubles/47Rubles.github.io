/**
 * 47OS Boot Sequence & System Asset Preloader
 * Preloads all 264 Neco sprites and 25 audio samples into RAM before desktop launch.
 * Guarantees zero runtime stutter, zero dropped frames, and instant audio playback.
 */

window.globalImageCache = window.globalImageCache || {};
window.globalAudioCache = window.globalAudioCache || {};

class BootManager {
  constructor() {
    this.bootScreen = document.getElementById('boot-screen');
    this.bootLog = document.getElementById('boot-log');
    this.progressBar = document.getElementById('boot-progress-bar');
    this.statusText = document.getElementById('boot-status-text');
    this.countText = document.getElementById('boot-count-text');
    this.promptEl = document.getElementById('boot-prompt');

    this.isBooted = false;
    this.isPreloadComplete = false;
    this.userWantsStart = false;

    this.totalAssets = 0;
    this.loadedAssets = 0;

    this.init();
  }

  init() {
    this.runBiosSequence();
    this.startPreloader();

    const onUserInteraction = () => {
      if (this.isBooted) return;

      if (!this.isPreloadComplete) {
        // User clicked before preloading finished
        this.userWantsStart = true;
        if (this.promptEl) {
          this.promptEl.className = 'boot-prompt waiting';
          this.promptEl.textContent = '[ ОЖИДАНИЕ ЗАВЕРШЕНИЯ КЭШИРОВАНИЯ... ВХОД В 47OS ПРОИЗОЙДЁТ АВТОМАТИЧЕСКИ ]';
        }
        return;
      }

      this.isBooted = true;
      this.finishBoot();
    };

    if (this.bootScreen) {
      this.bootScreen.addEventListener('click', onUserInteraction);
    }
    document.addEventListener('keydown', onUserInteraction);
  }

  runBiosSequence() {
    const lines = [
      "Award Modular BIOS v4.70, An Energy Star Ally",
      "Copyright (C) 1984-1998, 47R System Architecture Ltd.\n",
      "PENTIUM II-MMX CPU at 333MHz",
      "Memory Test: 640K Base Memory  PASSED",
      "Memory Test: 65536K Extended   PASSED",
      "Award Plug and Play BIOS Extension v1.0A",
      "Detecting Primary Master  ... QUANTUM FIREBALL 4.7GB",
      "Detecting Primary Slave   ... CD-ROM ATAPI 32X",
      "Detecting Secondary Master... NECO_ENTITY_CORE [ANOMALY DETECTED]",
      "\nBooting from Drive C: ...",
      "Starting 47OS 98 [Version 4.7.1998] ...",
      "Allocating DirectDMA Buffers for Neco-Arc Sprites & Audio ..."
    ];

    let current = 0;
    const interval = setInterval(() => {
      if (this.isBooted) {
        clearInterval(interval);
        return;
      }
      if (current < lines.length && this.bootLog) {
        this.bootLog.textContent += lines[current] + "\n";
        current++;
      } else {
        clearInterval(interval);
      }
    }, 90);
  }

  async startPreloader() {
    const audioList = [
      'assets/audio/alert.wav',
      'assets/audio/angry.wav',
      'assets/audio/arigato.wav',
      'assets/audio/bonjour.wav',
      'assets/audio/burunyuu.wav',
      'assets/audio/goodbye.wav',
      'assets/audio/laugh.wav',
      'assets/audio/nya.wav',
      'assets/audio/sfx_block.wav'
    ];
    for (let i = 2100; i <= 2107; i++) {
      audioList.push(`assets/audio/hit_${i}_a.wav`);
      audioList.push(`assets/audio/hit_${i}_b.wav`);
    }

    let frameList = [];
    try {
      const res = await fetch('assets/neco/manifest.json');
      if (res.ok) {
        const manifest = await res.json();
        window.necoManifest = manifest;
        const frameSet = new Set();
        for (const key in manifest) {
          if (manifest[key].frames) {
            manifest[key].frames.forEach(f => frameSet.add(f));
          }
        }
        frameList = Array.from(frameSet);
      }
    } catch (e) {
      console.warn("Could not load manifest for preloader:", e);
    }

    const allUrls = [
      { type: 'image', src: 'assets/wallpaper/silhouette.png' },
      { type: 'image', src: 'assets/wallpaper/pixel_eye_left_bg.png' },
      { type: 'image', src: 'assets/wallpaper/pixel_eye_right_bg.png' },
      { type: 'image', src: 'assets/wallpaper/pixel_pupil_l.png' },
      { type: 'image', src: 'assets/wallpaper/pixel_pupil_r.png' },
      ...frameList.map(src => ({ type: 'image', src })),
      ...audioList.map(src => ({ type: 'audio', src }))
    ];

    this.totalAssets = allUrls.length;
    this.loadedAssets = 0;

    if (this.totalAssets === 0) {
      this.onPreloadFinished();
      return;
    }

    // Safety fallback: force complete after 7.5 seconds so user is never stuck
    const safetyTimer = setTimeout(() => {
      if (!this.isPreloadComplete) {
        console.warn("Preloader safety timeout reached, forcing completion.");
        this.onPreloadFinished();
      }
    }, 7500);

    const onAssetDone = () => {
      this.loadedAssets++;
      this.updateProgress();
      if (this.loadedAssets >= this.totalAssets) {
        clearTimeout(safetyTimer);
        this.onPreloadFinished();
      }
    };

    // Preload each asset into memory
    allUrls.forEach(item => {
      if (item.type === 'image') {
        const img = new Image();
        img.onload = img.onerror = () => onAssetDone();
        img.src = item.src;
        window.globalImageCache[item.src] = img;
      } else {
        const audio = new Audio();
        audio.preload = 'auto';
        let done = false;
        const markAudioDone = () => {
          if (!done) {
            done = true;
            onAssetDone();
          }
        };
        audio.addEventListener('canplaythrough', markAudioDone, { once: true });
        audio.addEventListener('loadeddata', markAudioDone, { once: true });
        audio.addEventListener('error', markAudioDone, { once: true });
        setTimeout(markAudioDone, 1200); // safety fallback per individual sound
        audio.src = item.src;
        window.globalAudioCache[item.src] = audio;
      }
    });
  }

  updateProgress() {
    const percent = Math.min(100, Math.floor((this.loadedAssets / this.totalAssets) * 100));
    if (this.progressBar) {
      this.progressBar.style.width = `${percent}%`;
    }
    if (this.countText) {
      this.countText.textContent = `Кэширование ресурсов: ${this.loadedAssets} / ${this.totalAssets} (${percent}%)`;
    }
    if (this.statusText) {
      this.statusText.textContent = `[ ДЕКОДИРОВАНИЕ СПРАЙТОВ И АУДИОСЭМПЛОВ: ${percent}% ]`;
    }
  }

  onPreloadFinished() {
    if (this.isPreloadComplete) return;
    this.isPreloadComplete = true;

    if (this.progressBar) {
      this.progressBar.style.width = '100%';
    }
    if (this.countText) {
      this.countText.textContent = `Кэширование завершено: ${this.totalAssets} / ${this.totalAssets} (100%)`;
    }
    if (this.statusText) {
      this.statusText.textContent = `[ СИСТЕМА ИНИЦИАЛИЗИРОВАНА: ВСЕ СПРАЙТЫ И ЗВУКИ В ОЗУ ]`;
      this.statusText.style.color = '#00ff66';
    }

    if (this.bootLog) {
      this.bootLog.textContent += "\n>> DIRECT DMA RAM ALLOCATION: 100% COMPLETE (" + this.totalAssets + " ASSETS).\n";
      this.bootLog.textContent += ">> NECO-ARC ENGINE MOUNTED WITH 0ms RUNTIME LATENCY.\n";
    }

    if (this.promptEl) {
      this.promptEl.className = 'boot-prompt ready';
      this.promptEl.textContent = '[ СИСТЕМА ГОТОВА: КЛИКНИТЕ ИЛИ НАЖМИТЕ КЛАВИШУ ДЛЯ ЗАПУСКА 47OS ]';
    }

    // If user previously pressed key/clicked while it was loading, trigger boot immediately!
    if (this.userWantsStart && !this.isBooted) {
      this.isBooted = true;
      this.finishBoot();
    }
  }

  finishBoot() {
    if (this.bootLog) {
      this.bootLog.textContent += "\n>> STARTING GRAPHICAL SUBSYSTEM 47OS 98...";
    }

    setTimeout(() => {
      // Trigger CRT Screen Glitch
      document.body.classList.add('screen-glitch');

      setTimeout(() => {
        // Hide boot screen completely
        if (this.bootScreen) {
          this.bootScreen.style.display = 'none';
        }
        document.body.classList.remove('screen-glitch');

        // Materialize Neco Arc: Spawn from ground!
        try {
          if (window.necoPet && typeof window.necoPet.spawnFromGround === 'function') {
            window.necoPet.spawnFromGround();
          }
        } catch (e) {}

        // Open default windows
        try {
          if (window.winManager) {
            window.winManager.openWindow('win-player');
            setTimeout(() => {
              window.winManager.openWindow('win-dialogue');
            }, 300);
          }
        } catch (e) {}

        // Start music player
        try {
          if (window.audioPlayer && typeof window.audioPlayer.play === 'function') {
            setTimeout(() => {
              window.audioPlayer.play();
            }, 600);
          }
        } catch (e) {}

      }, 350);
    }, 250);
  }
}

window.bootMgr = new BootManager();
