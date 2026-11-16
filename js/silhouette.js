/**
 * 47OS Silhouette Assistant (v1.0)
 * Renders the semi-transparent helper, manages speech bubbles,
 * spam click cooldowns, timeout auto-dismiss, and AFK triggers.
 */

(function() {
  'use strict';

  class SilhouetteManager {
    constructor() {
      this.containerEl = null;
      this.avatarEl = null;
      this.bubbleEl = null;
      this.textEl = null;
      this.closeBtnEl = null;

      this.dismissTimeout = null;
      this.spamClicks = 0;
      this.lastClickTime = 0;
      this.cooldownTimer = null;
      this.isCooldown = false;

      this.init();
    }

    init() {
      // Create DOM elements for Silhouette
      this.containerEl = document.createElement('div');
      this.containerEl.id = 'silhouette-container';
      this.containerEl.className = 'silhouette-container';

      // Dialogue Speech Bubble
      this.bubbleEl = document.createElement('div');
      this.bubbleEl.className = 'silhouette-bubble';
      this.bubbleEl.style.display = 'none';

      this.closeBtnEl = document.createElement('button');
      this.closeBtnEl.className = 'silhouette-bubble-close';
      this.closeBtnEl.innerHTML = '✕';
      this.closeBtnEl.title = 'Закрыть сообщение';
      this.closeBtnEl.onclick = (e) => {
        e.stopPropagation();
        this.dismiss();
      };

      this.textEl = document.createElement('div');
      this.textEl.className = 'silhouette-bubble-text';

      this.bubbleEl.appendChild(this.closeBtnEl);
      this.bubbleEl.appendChild(this.textEl);

      // Silhouette Avatar (clean, retro minimal human figure)
      this.avatarEl = document.createElement('div');
      this.avatarEl.className = 'silhouette-avatar';
      this.avatarEl.title = '47OS Присутствие';
      this.avatarEl.innerHTML = `
        <svg viewBox="0 0 48 56" class="silhouette-svg">
          <circle cx="24" cy="14" r="10" fill="currentColor"/>
          <path d="M6,46 C6,32 14,28 24,28 C34,28 42,32 42,46 C42,50 38,54 24,54 C10,54 6,50 6,46 Z" fill="currentColor"/>
        </svg>
      `;

      // Tap / Click handling on avatar
      this.avatarEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onAvatarClick();
      });

      this.containerEl.appendChild(this.bubbleEl);
      this.containerEl.appendChild(this.avatarEl);
      document.body.appendChild(this.containerEl);
    }

    say(text, duration = 10000) {
      if (this.isCooldown) return;
      if (!text) return;

      if (this.dismissTimeout) {
        clearTimeout(this.dismissTimeout);
        this.dismissTimeout = null;
      }

      this.textEl.textContent = text;
      this.bubbleEl.style.display = 'block';
      this.containerEl.classList.add('visible');

      // Auto-dismiss after timeout (~10s)
      this.dismissTimeout = setTimeout(() => {
        this.dismiss();
      }, duration);
    }

    dismiss() {
      if (this.dismissTimeout) {
        clearTimeout(this.dismissTimeout);
        this.dismissTimeout = null;
      }
      this.bubbleEl.style.display = 'none';
      this.containerEl.classList.remove('visible');
    }

    onAvatarClick() {
      if (this.isCooldown) return;

      const now = Date.now();
      if (now - this.lastClickTime < 2500) {
        this.spamClicks++;
      } else {
        this.spamClicks = 1;
      }
      this.lastClickTime = now;

      // Handle spam triggers
      if (this.spamClicks >= 5) {
        // Trigger cooldown (45 seconds)
        const leavePhrases = [
          'Всё, мне надоело. Развлекайся сам.',
          'Надоел.',
          'Какой неугомонный!',
          'Во прилип!',
          'О личном пространстве слышал?',
          'Надоело...',
          'Я те дам!'
        ];
        const phrase = leavePhrases[Math.floor(Math.random() * leavePhrases.length)];
        this.say(phrase, 3500);

        this.isCooldown = true;
        this.containerEl.classList.add('cooldown');
        setTimeout(() => {
          this.dismiss();
        }, 3500);

        if (this.cooldownTimer) clearTimeout(this.cooldownTimer);
        this.cooldownTimer = setTimeout(() => {
          this.isCooldown = false;
          this.spamClicks = 0;
          this.containerEl.classList.remove('cooldown');
        }, 45000);
        return;
      }

      if (this.spamClicks >= 3) {
        const annoyedPhrases = [
          'Хватит!',
          '…',
          'Мне не приятно, знаешь ли...',
          'Скучно?!',
          'Прекращай!',
          'Хватит в меня тыкать!',
          'Я смотрю у тебя руки чешутся.'
        ];
        this.say(annoyedPhrases[Math.floor(Math.random() * annoyedPhrases.length)]);
      } else {
        const singlePhrases = [
          'А?',
          'Чего тебе?',
          'Чего тыкаешь? Я слушаю.',
          'Эй!',
          'М?',
          'Чё такое?'
        ];
        this.say(singlePhrases[Math.floor(Math.random() * singlePhrases.length)]);
      }
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    window.Silhouette = new SilhouetteManager();
  });
})();
