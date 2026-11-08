/**
 * 47OS Boot Sequence & System Orchestrator
 * Handles BIOS memory test, click-to-unlock audio, CRT glitch, and Neco emergence.
 */

class BootManager {
  constructor() {
    this.bootScreen = document.getElementById('boot-screen');
    this.bootLog = document.getElementById('boot-log');
    this.desktop = document.getElementById('desktop');
    this.isBooted = false;
    this.init();
  }

  init() {
    this.runBiosSequence();

    // User interaction unlocks audio and starts boot
    const startBoot = () => {
      if (this.isBooted) return;
      this.isBooted = true;
      this.finishBoot();
    };

    if (this.bootScreen) {
      this.bootScreen.addEventListener('click', startBoot);
    }
    document.addEventListener('keydown', startBoot, { once: true });
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
      "Loading VESA VBE 2.0 Video Driver [1024x768x256] ... OK",
      "Mounting AST Parser & MCP Agent Engine ... OK",
      "Initializing Sound Blaster 16 ... OK"
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
    }, 110);
  }

  finishBoot() {
    if (this.bootLog) {
      this.bootLog.textContent += "\n>> SYSTEM KERNEL LOADED. STARTING GRAPHICAL SUBSYSTEM...";
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
    }, 350);
  }
}

window.bootMgr = new BootManager();
