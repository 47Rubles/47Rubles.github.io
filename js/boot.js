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

    this.bootScreen.addEventListener('click', startBoot);
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
      if (current < lines.length) {
        this.bootLog.textContent += lines[current] + "\n";
        current++;
      } else {
        clearInterval(interval);
      }
    }, 120);
  }

  finishBoot() {
    this.bootLog.textContent += "\n>> SYSTEM KERNEL LOADED. STARTING GRAPHICAL SUBSYSTEM...";
    
    // Play startup click / alert sound
    if (window.necoPet) {
      window.necoPet.playSound('nya');
    }

    setTimeout(() => {
      // Trigger CRT Screen Glitch
      document.body.classList.add('screen-glitch');

      setTimeout(() => {
        // Fade out boot screen
        this.bootScreen.style.display = 'none';
        document.body.classList.remove('screen-glitch');

        // Materialize Neco Arc
        if (window.necoPet) {
          window.necoPet.setState('shock');
          window.necoPet.playSound('burunyuu');
          window.necoPet.speak("Buru-nyuu~! Система 47OS захвачена!", 3500);
          setTimeout(() => {
            window.necoPet.setState('idle');
          }, 1500);
        }

        // Open default windows
        if (window.winManager) {
          window.winManager.openWindow('win-player');
          setTimeout(() => {
            window.winManager.openWindow('win-dialogue');
          }, 300);
        }

        // Start chill music
        if (window.audioPlayer) {
          setTimeout(() => {
            window.audioPlayer.play();
          }, 800);
        }

      }, 400);
    }, 400);
  }
}

window.bootMgr = new BootManager();
