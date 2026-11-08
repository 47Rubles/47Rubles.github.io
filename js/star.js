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
      // Golden glowing star
      this.starIconSvg.innerHTML = `
        <polygon points="16,2 20.5,11.5 31,13 23.5,20.5 25.5,31 16,26 6.5,31 8.5,20.5 1,13 11.5,11.5" 
                 fill="#ffcc00" stroke="#cc9900" stroke-width="1.5" filter="drop-shadow(0 0 4px #ffcc00)"/>
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
          <div style="font-size: 38px; color: #ffcc00; text-shadow: 0 0 6px #ffaa00;">★</div>
          <div style="font-size: 11px; line-height: 1.5;">
            <strong>Звезда уже сияет в системе!</strong><br>
            47R и Neco Arc искренне благодарят тебя за поддержку репозитория.
          </div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
          <button class="win-btn" onclick="window.starManager.resetStar()" style="color: #666; font-size: 10px;">Сбросить отметку</button>
          <div style="display: flex; gap: 6px;">
            <button class="win-btn" onclick="window.open('https://github.com/47Rubles/47Rubles.github.io', '_blank')">Репозиторий ↗</button>
            <button class="win-btn" onclick="window.winManager.closeWindow('win-star')">Закрыть</button>
          </div>
        </div>
      `;
    } else {
      this.starBody.innerHTML = `
        <div style="display: flex; gap: 12px; align-items: flex-start; margin-bottom: 12px;">
          <div style="font-size: 38px; color: #ffffff;">☆</div>
          <div style="font-size: 11px; line-height: 1.5;">
            <strong>Поддержи проект 47OS 98:</strong><br>
            1. Нажми <strong>«Перейти на GitHub»</strong> (откроется в новой вкладке).<br>
            2. Нажми <strong>★ Star</strong> в правом верхнем углу репозитория.<br>
            3. Вернись сюда и нажми <strong>«Я поставил звезду!»</strong>.
          </div>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 6px; margin-top: 10px;">
          <button class="win-btn" onclick="window.open('https://github.com/47Rubles/47Rubles.github.io', '_blank')">↗ Перейти на GitHub</button>
          <button class="win-btn" onclick="window.starManager.confirmStar()" style="font-weight: bold;">★ Я поставил звезду!</button>
          <button class="win-btn" onclick="window.winManager.closeWindow('win-star')">Позже</button>
        </div>
      `;
    }

    if (window.winManager) {
      window.winManager.openWindow('win-star');
    }
  }

  confirmStar() {
    this.isStarred = true;
    localStorage.setItem('47r_starred', 'true');
    this.updateIconState();

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

  resetStar() {
    this.isStarred = false;
    localStorage.removeItem('47r_starred');
    this.updateIconState();
    this.openModal();
  }
}

window.starManager = new StarManager();
