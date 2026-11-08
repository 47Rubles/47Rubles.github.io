/**
 * 47OS Star Manager
 * Handles the Star Desktop Shortcut, Gold Star state, and Thank You reaction.
 */

class StarManager {
  constructor() {
    this.starIconSvg = document.getElementById('desktop-star-svg');
    this.starWin = document.getElementById('win-star');
    this.starBody = document.getElementById('star-window-body');
    this.isStarred = localStorage.getItem('47r_starred') === 'true';
    this.init();
  }

  init() {
    this.updateIconState();
  }

  updateIconState() {
    if (this.isStarred && this.starIconSvg) {
      // Golden star
      this.starIconSvg.innerHTML = `
        <polygon points="16,2 20.5,11.5 31,13 23.5,20.5 25.5,31 16,26 6.5,31 8.5,20.5 1,13 11.5,11.5" 
                 fill="#ffcc00" stroke="#cc9900" stroke-width="1.5" filter="drop-shadow(0 0 3px #ffcc00)"/>
      `;
    } else if (this.starIconSvg) {
      // Transparent outline star
      this.starIconSvg.innerHTML = `
        <polygon points="16,2 20.5,11.5 31,13 23.5,20.5 25.5,31 16,26 6.5,31 8.5,20.5 1,13 11.5,11.5" 
                 fill="none" stroke="#ffffff" stroke-width="2" stroke-dasharray="3,2"/>
      `;
    }
  }

  openModal() {
    if (!this.starWin || !this.starBody) return;

    if (this.isStarred) {
      this.starBody.innerHTML = `
        <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px;">
          <div style="font-size: 36px; color: #ffcc00;">★</div>
          <div style="font-size: 11px; line-height: 1.5;">
            <strong>Звезда уже сияет!</strong><br>
            47R и Neco Arc выражают тебе искреннюю благодарность за поддержку системы 47OS.
          </div>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 6px;">
          <button class="win-btn" onclick="window.open('https://github.com/47Rubles/47Rubles.github.io', '_blank')">Репозиторий ↗</button>
          <button class="win-btn" onclick="window.winManager.closeWindow('win-star')">Закрыть</button>
        </div>
      `;
    } else {
      this.starBody.innerHTML = `
        <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px;">
          <div style="font-size: 36px; color: #ffffff;">☆</div>
          <div style="font-size: 11px; line-height: 1.5;">
            <strong>Нравится 47OS 98?</strong><br>
            Поставь звёздочку репозиторию на GitHub — это согреет душу автору и порадует Неко!
          </div>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 6px;">
          <button class="win-btn" onclick="window.starManager.giveStar()">★ Поставить звезду</button>
          <button class="win-btn" onclick="window.winManager.closeWindow('win-star')">Позже</button>
        </div>
      `;
    }

    if (window.winManager) {
      window.winManager.openWindow('win-star');
    }
  }

  giveStar() {
    this.isStarred = true;
    localStorage.setItem('47r_starred', 'true');
    this.updateIconState();

    window.open('https://github.com/47Rubles/47Rubles.github.io', '_blank');

    if (window.winManager) {
      window.winManager.closeWindow('win-star');
    }

    if (window.necoPet) {
      window.necoPet.playVoice('arigato', 0.3);
      window.necoPet.setState('happy_wave', () => {
        window.necoPet.setState('idle');
      });
      window.necoPet.speak("Аригато ня-я! Твоя звезда зажглась в 47OS!", 3500);
    }
  }
}

window.starManager = new StarManager();
