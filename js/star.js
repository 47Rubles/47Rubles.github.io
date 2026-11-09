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
            <a href="https://github.com/47Rubles/47Rubles.github.io" target="_blank" rel="noopener noreferrer" class="win-btn" style="text-decoration: none; color: inherit; display: inline-flex; align-items: center; gap: 4px;">Репозиторий ↗</a>
            <button class="win-btn" onclick="window.winManager.closeWindow('win-star')">Закрыть</button>
          </div>
        </div>
      `;
    } else {
      this.starBody.innerHTML = `
        <div style="display: flex; gap: 12px; align-items: flex-start; margin-bottom: 12px;">
          <div style="font-size: 38px; color: #ffcc00; text-shadow: 0 0 6px #ffaa00;">★</div>
          <div style="font-size: 11px; line-height: 1.5; flex: 1;">
            <strong>Поддержи проект 47OS 98:</strong><br>
            Нажми <strong>Star</strong> прямо в этом окне:
            <div style="margin: 8px 0 8px 0; background: #ffffff; padding: 4px 8px; border: 1px inset #808080; width: fit-content;">
              <iframe src="https://ghbtns.com/github-btn.html?user=47Rubles&repo=47Rubles.github.io&type=star&count=true&size=large" frameborder="0" scrolling="0" width="160" height="30" title="GitHub Star"></iframe>
            </div>
            После отметки нажми <strong>«Зажечь звезду!»</strong>, чтобы включить золотое свечение на рабочем столе.
          </div>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 6px; margin-top: 10px;">
          <button class="win-btn" onclick="window.starManager.confirmStar()" style="font-weight: bold; background: #d0f0d0;">★ Зажечь звезду в системе!</button>
          <a href="https://github.com/47Rubles/47Rubles.github.io" target="_blank" rel="noopener noreferrer" class="win-btn" style="text-decoration: none; color: inherit; display: inline-flex; align-items: center; gap: 4px;">Репозиторий ↗</a>
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
