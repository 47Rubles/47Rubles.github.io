/**
 * 47OS Interactive Dialogue with 47R
 * Advance line by line on click, input field, and GitHub Issues guestbook sync.
 */

class DialogueManager {
  constructor() {
    this.container = document.getElementById('dialogue-text-el');
    this.hintEl = document.getElementById('dialogue-hint');
    this.inputArea = document.getElementById('dialogue-input-area');
    this.inputEl = document.getElementById('guestbook-input');
    this.submitBtn = document.getElementById('guestbook-submit');
    this.speakerEl = document.getElementById('dialogue-speaker-name');
    this.dialogueWindowEl = document.getElementById('win-dialogue');
    this.guestbookListEl = document.getElementById('guestbook-entries');

    this.step = 0;
    this.hasSubmitted = false;
    this.isFinished = false;

    // Narrative scripts
    this.scriptBefore = [
      "Ты что тут делаешь?",
      "Ты как это нашёл?!",
      "Не смотри! Не читай тут ничего!",
      "Всё кышь-кышь отсюда!",
      "Ты ещё тут? Я смотрю ты настойчивый.",
      "Ты всё ещё читаешь это?! Да ты псих...",
      "Не надоело? Я завидую твоему упорству.",
      "А что только я тут пишу? Давай ты тоже что-то напишешь."
    ];

    this.scriptAfter = [
      "Не знаю что ты там написал, но я это возможно прочитаю.",
      "А теперь всё, уходи! Давай-давай, иди!",
      "Ну и сиди тут, я ухожу.",
      "Всё, я ушёл. Пока, давай-давай!",
      "Ты думаешь я не уйду? Тут просто далеко идти.",
      "А, всё, нашёл дверь. Чао, счастливо оставаться! ..."
    ];

    this.init();
  }

  init() {
    this.renderCurrentLine();

    // Click on entire dialogue box or hint advances dialogue
    const dialogueBox = this.container ? (this.container.closest('.dialogue-content') || this.container.parentElement) : null;
    if (dialogueBox) {
      dialogueBox.addEventListener('click', (e) => {
        if (this.isFinished) return;
        if (e.target.closest('#dialogue-input-area')) return;
        this.next();
      });
    }

    if (this.hintEl) {
      this.hintEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.isFinished) return;
        this.next();
      });
    }

    if (this.submitBtn) {
      this.submitBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.submitMessage();
      });
    }

    if (this.inputEl) {
      this.inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.stopPropagation();
          this.submitMessage();
        }
      });
    }

    // Handle reopening after finish
    if (this.dialogueWindowEl) {
      this.dialogueWindowEl.addEventListener('win:opened', () => {
        if (this.isFinished) {
          this.showFinishedNote();
        }
      });
    }

    // Load guestbook messages
    this.loadGuestbookEntries();
  }

  showFinishedNote() {
    this.speakerEl.textContent = "Записка на столе:";
    this.container.innerHTML = `
      <em>«Я же сказал, что ушёл! Хватит открывать этот блокнот.<br>
      Если хочешь что-то передать — пиши в ярлык «Лог нарушителей».<br>
      — 47R»</em>
    `;
    this.inputArea.style.display = 'none';
    this.hintEl.textContent = "[47R отсутствует. Окно можно закрыть.]";
  }

  renderCurrentLine() {
    if (this.isFinished) {
      this.showFinishedNote();
      return;
    }

    if (!this.hasSubmitted) {
      if (this.step < this.scriptBefore.length) {
        this.typewrite(this.scriptBefore[this.step]);
        if (this.step === this.scriptBefore.length - 1) {
          this.inputArea.style.display = 'flex';
          this.hintEl.textContent = "Напиши что-нибудь и нажми «Отправить»";
        } else {
          this.inputArea.style.display = 'none';
          this.hintEl.textContent = "▼ Кликни, чтобы продолжить...";
        }
      }
    } else {
      const afterIdx = this.step - this.scriptBefore.length;
      if (afterIdx < this.scriptAfter.length) {
        this.typewrite(this.scriptAfter[afterIdx]);
        if (afterIdx === this.scriptAfter.length - 1) {
          this.hintEl.textContent = "[Собеседник покинул чат. Хлопнула дверь.]";
        } else {
          this.hintEl.textContent = "▼ Кликни, чтобы продолжить...";
        }
      } else {
        // Exit sequence: close window once
        this.isFinished = true;
        if (window.winManager) {
          window.winManager.closeWindow('win-dialogue');
        }
        if (window.necoPet) {
          window.necoPet.playVoice('goodbye', 0.25);
          window.necoPet.speak("Ну вот, ушёл. Гудбай!", 2500);
        }
        this.showFinishedNote();
      }
    }
  }

  typewrite(text) {
    this.container.textContent = text;
  }

  next() {
    if (this.isFinished) return;
    if (this.step === this.scriptBefore.length - 1 && !this.hasSubmitted) {
      return;
    }

    this.step++;
    this.renderCurrentLine();
  }

  submitMessage() {
    const val = this.inputEl.value.trim();
    if (!val) return;

    this.hasSubmitted = true;
    this.inputArea.style.display = 'none';

    // 1. Save locally
    const saved = JSON.parse(localStorage.getItem('47r_messages') || '[]');
    const newEntry = {
      text: val,
      date: new Date().toLocaleString('ru-RU')
    };
    saved.unshift(newEntry);
    localStorage.setItem('47r_messages', JSON.stringify(saved));
    this.renderGuestbookList(saved);

    // 2. Open GitHub Issue submission
    const ghIssueUrl = `https://github.com/47Rubles/47Rubles.github.io/issues/new?title=${encodeURIComponent('Запись в лог от ' + newEntry.date)}&body=${encodeURIComponent(val)}`;
    
    setTimeout(() => {
      if (confirm("Отправить эту запись прямо в GitHub Issues репозитория 47Rubles, чтобы её видели все?")) {
        window.open(ghIssueUrl, '_blank');
      }
    }, 1200);

    this.step = this.scriptBefore.length;
    this.renderCurrentLine();
  }

  async loadGuestbookEntries() {
    const localEntries = JSON.parse(localStorage.getItem('47r_messages') || '[]');
    
    try {
      const res = await fetch('https://api.github.com/repos/47Rubles/47Rubles.github.io/issues?state=all');
      if (res.ok) {
        const issues = await res.json();
        const ghEntries = issues.map(iss => ({
          text: iss.body || iss.title,
          author: iss.user?.login || 'Гость',
          date: new Date(iss.created_at).toLocaleString('ru-RU')
        }));
        this.renderGuestbookList([...ghEntries, ...localEntries]);
        return;
      }
    } catch (e) {}

    const fallback = [
      { author: "Neco Arc", text: "Buru-nyuu! Я первая тут написала!", date: "08.11.2026 12:00" },
      { author: "47R", text: "Если вы это читаете, значит 47OS успешно скомпилирована.", date: "08.11.2026 12:05" }
    ];
    this.renderGuestbookList([...localEntries, ...fallback]);
  }

  renderGuestbookList(entries) {
    if (!this.guestbookListEl) return;
    this.guestbookListEl.innerHTML = '';
    entries.forEach(item => {
      const div = document.createElement('div');
      div.className = 'guestbook-entry';
      div.innerHTML = `
        <div class="guestbook-entry-header">▸ ${item.author || 'Посетитель'} [${item.date}]:</div>
        <div class="guestbook-entry-text">${this.escapeHtml(item.text)}</div>
      `;
      this.guestbookListEl.appendChild(div);
    });
  }

  escapeHtml(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }
}

window.dialogueMgr = new DialogueManager();
