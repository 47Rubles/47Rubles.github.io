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

    const starredUser = localStorage.getItem('47r_starred_user');

    if (this.isStarred) {
      this.starBody.innerHTML = `
        <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px;">
          <div style="font-size: 38px; color: #ffcc00; text-shadow: 0 0 6px #ffaa00;">★</div>
          <div style="font-size: 11px; line-height: 1.5;">
            <strong>Звезда уже сияет в системе!</strong><br>
            ${starredUser ? `Подтверждено от пользователя: <strong>@${starredUser}</strong>.<br>` : ''}
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
        <div style="font-size: 11px; line-height: 1.5; margin-bottom: 10px;">
          <div style="font-weight: bold; margin-bottom: 6px;">Как активировать Звезду в 47OS 98:</div>
          <div style="margin-bottom: 6px;">
            1. Перейди в репозиторий и нажми <strong>★ Star</strong> в правом верхнем углу:
          </div>
          <div style="margin-bottom: 10px;">
            <a href="https://github.com/47Rubles/47Rubles.github.io" target="_blank" rel="noopener noreferrer" class="win-btn" style="text-decoration: none; color: #000; font-weight: bold; font-size: 11px; display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px;">
              <span>↗</span> Открыть GitHub репозиторий
            </a>
          </div>
          <div style="margin-bottom: 6px;">
            2. Введи свой логин на GitHub для автоматической проверки:
          </div>
          <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 8px;">
            <input type="text" id="star-username-input" class="win-input" placeholder="твой GitHub ник" style="flex: 1; font-size: 11px; padding: 2px 4px;">
            <button class="win-btn" id="star-verify-btn" onclick="window.starManager.verifyStar()" style="font-weight: bold; font-size: 11px;">Проверить отметку</button>
          </div>
          <div id="star-status-msg" style="font-size: 11px; min-height: 18px; line-height: 1.3;"></div>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 6px; border-top: 1px solid #dfdfdf; padding-top: 8px;">
          <button class="win-btn" onclick="window.winManager.closeWindow('win-star')">Закрыть</button>
        </div>
      `;
    }

    if (window.winManager) {
      window.winManager.openWindow('win-star');
    }
  }

  async verifyStar() {
    const input = document.getElementById('star-username-input');
    const statusMsg = document.getElementById('star-status-msg');
    const verifyBtn = document.getElementById('star-verify-btn');
    if (!input || !statusMsg) return;

    const username = input.value.trim().replace(/^@/, '');
    if (!username) {
      statusMsg.innerHTML = '<span style="color: #b71c1c;">⚠ Введи свой логин на GitHub!</span>';
      return;
    }

    verifyBtn.disabled = true;
    statusMsg.innerHTML = '<span style="color: #000080;">⏳ Проверяем звёзды пользователя @' + username + ' через GitHub API...</span>';

    try {
      const res = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/starred?per_page=100`);
      if (res.status === 404) {
        statusMsg.innerHTML = `<span style="color: #b71c1c;">⚠ Пользователь @${username} не найден на GitHub.</span>`;
        verifyBtn.disabled = false;
        return;
      }
      if (!res.ok) {
        throw new Error('API status ' + res.status);
      }

      const starredRepos = await res.json();
      const targetRepo = '47rubles/47rubles.github.io';
      const hasStarred = Array.isArray(starredRepos) && starredRepos.some(r => (r.full_name || '').toLowerCase() === targetRepo);

      if (hasStarred) {
        statusMsg.innerHTML = `<span style="color: #1b5e20; font-weight: bold;">✔ Звезда от @${username} подтверждена! Активируем...</span>`;
        localStorage.setItem('47r_starred_user', username);
        setTimeout(() => {
          this.confirmStar();
        }, 800);
      } else {
        statusMsg.innerHTML = `<span style="color: #b71c1c;">⚠ Звезда от @${username} пока не найдена. Убедись, что нажал ★ Star на GitHub, и нажми проверить ещё раз.</span>`;
        verifyBtn.disabled = false;
      }
    } catch (e) {
      console.warn('Ошибка проверки звезды:', e);
      statusMsg.innerHTML = `<span style="color: #b71c1c;">⚠ Ошибка запроса к GitHub API. Попробуй позже или проверь соединение.</span>`;
      verifyBtn.disabled = false;
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
