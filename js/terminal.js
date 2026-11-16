/**
 * 47OS Terminal UI Controller (v1.0)
 * Handles input buffer, history, prompt display, AFK timers, and terminal rendering.
 */

(function() {
  'use strict';

  class TerminalController {
    constructor() {
      this.history = [];
      this.historyIdx = -1;
      this.outputEl = null;
      this.inputEl = null;
      this.promptEl = null;
      this.windowEl = null;

      this.afkTimer = null;
      this.isAfkDone = false;

      this.init();
    }

    init() {
      this.windowEl = document.getElementById('win-terminal');
      this.outputEl = document.getElementById('terminal-output');
      this.inputEl = document.getElementById('terminal-input');
      this.promptEl = document.getElementById('terminal-prompt');

      if (!this.inputEl || !this.outputEl) return;

      // Click anywhere inside terminal body focuses input
      const termBody = this.windowEl.querySelector('.terminal-body');
      if (termBody) {
        termBody.addEventListener('click', () => {
          this.inputEl.focus();
        });
      }

      // Input event listener
      this.inputEl.addEventListener('keydown', (e) => {
        this.resetAfkTimer();

        if (e.key === 'Enter') {
          e.preventDefault();
          const val = this.inputEl.value;
          this.inputEl.value = '';
          this.handleCommand(val);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (this.history.length > 0) {
            if (this.historyIdx < this.history.length - 1) {
              this.historyIdx++;
            }
            this.inputEl.value = this.history[this.history.length - 1 - this.historyIdx];
          }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (this.historyIdx > 0) {
            this.historyIdx--;
            this.inputEl.value = this.history[this.history.length - 1 - this.historyIdx];
          } else {
            this.historyIdx = -1;
            this.inputEl.value = '';
          }
        }
      });

      // Window lifecycle events
      this.windowEl.addEventListener('win:opened', () => {
        this.inputEl.focus();
        this.resetAfkTimer();
        if (window.QuestEngine) {
          window.QuestEngine.onTerminalOpen();
        }
      });

      this.windowEl.addEventListener('win:closed', () => {
        this.clearAfkTimer();
        if (window.QuestEngine) {
          window.QuestEngine.onTerminalClose();
        }
      });

      // Update prompt on start
      this.updatePrompt();
    }

    updatePrompt() {
      if (this.promptEl && window.QuestEngine) {
        this.promptEl.textContent = window.QuestEngine.getCurrentPrompt() + ' ';
      }
    }

    resetAfkTimer() {
      this.clearAfkTimer();
      if (this.isAfkDone) return;

      this.afkTimer = setTimeout(() => {
        this.isAfkDone = true;
        if (window.Silhouette && window.QuestEngine) {
          if (window.QuestEngine.questStage === 'COMPLETED') {
            window.Silhouette.say('Тихо тут... Раньше я один сидел, а теперь вроде как с тобой. И это даже не раздражает.');
          } else {
            window.Silhouette.say('Ты там уснул перед монитором? Минуту уже молчишь.');
          }
        }
      }, 60000);
    }

    clearAfkTimer() {
      if (this.afkTimer) {
        clearTimeout(this.afkTimer);
        this.afkTimer = null;
      }
    }

    handleCommand(cmd) {
      if (!window.QuestEngine) return;

      const trimmed = cmd.trim();
      if (trimmed && this.history[this.history.length - 1] !== trimmed) {
        this.history.push(trimmed);
      }
      this.historyIdx = -1;

      const currentPrompt = window.QuestEngine.getCurrentPrompt();
      
      // Render user command row
      const cmdRow = document.createElement('div');
      cmdRow.className = 'term-line term-cmd';
      cmdRow.textContent = `${currentPrompt} ${cmd}`;
      this.outputEl.appendChild(cmdRow);

      // Execute in engine
      const res = window.QuestEngine.execute(cmd);

      if (res.text === '__CLEAR__') {
        this.outputEl.innerHTML = '';
      } else if (res.text) {
        const outRow = document.createElement('div');
        outRow.className = res.isError ? 'term-line term-error' : 'term-line term-out';
        outRow.textContent = res.text;
        this.outputEl.appendChild(outRow);
      }

      this.updatePrompt();

      // Scroll to bottom
      const termBody = this.windowEl.querySelector('.terminal-body');
      if (termBody) {
        termBody.scrollTop = termBody.scrollHeight;
      }
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    window.TerminalCtrl = new TerminalController();
  });
})();
