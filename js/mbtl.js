/**
 * 47OS 98 — Melty Blood: Type Lumina (MBTL Remote Play)
 * Клиентский модуль WebRTC-стриминга и захвата управления Игрока 2.
 */

class MBTLClient {
  constructor() {
    this.apiBase = 'https://47rubles-github-io.tchulkoff-ev.workers.dev/api/mbtl';
    this.clientId = 'client_' + Math.random().toString(36).substring(2, 9);
    
    this.pc = null;
    this.dataChannel = null;
    this.pollTimer = null;
    this.statusCheckTimer = null;
    
    this.role = 'guest'; // 'player2' | 'spectator' | 'guest'
    this.isBlockedByHost = false;
    this.isOnline = false;
    this.isConnected = false;

    // Разрешенные клавиши (только файтинг-раскладка)
    this.allowedKeys = new Set([
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'Numpad7', 'Numpad8', 'Numpad9', 'Numpad4'
    ]);
    
    this.pressedKeys = new Set();
    this.init();
  }

  init() {
    // Регулярный опрос статуса для иконки на рабочем столе
    this.checkHostStatus();
    this.statusCheckTimer = setInterval(() => this.checkHostStatus(), 5000);

    // Привязываем глобальный перехватчик клавиш
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => this.handleKeyUp(e));

    // Сброс зажатых кнопок при потере фокуса окна
    window.addEventListener('blur', () => this.releaseAllKeys());
  }

  async checkHostStatus() {
    try {
      const res = await fetch(`${this.apiBase}/status`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      this.isOnline = Boolean(data.online);

      const ledEl = document.getElementById('mbtl-status-led');
      const winStatusEl = document.getElementById('mbtl-win-status');
      const winQueueEl = document.getElementById('mbtl-win-queue');

      if (ledEl) {
        ledEl.className = 'desktop-icon-badge';
        if (!data.online) {
          ledEl.classList.add('badge-offline');
          ledEl.title = 'Статус: Оффлайн (игра не запущена)';
        } else if (data.active_player) {
          ledEl.classList.add('badge-busy');
          ledEl.title = `Статус: В бою (Зрителей: ${data.queue_count || 0})`;
        } else {
          ledEl.classList.add('badge-online');
          ledEl.title = 'Статус: Онлайн (Свободно для боя!)';
        }
      }

      if (winStatusEl) {
        if (!data.online) {
          winStatusEl.innerHTML = '<span style="color: #bbb;">⚫ ОФФЛАЙН</span>';
        } else if (data.active_player) {
          winStatusEl.innerHTML = '<span style="color: #ff5555;">🔴 В БОЮ</span>';
        } else {
          winStatusEl.innerHTML = '<span style="color: #00ff66;">🟢 СВОБОДНО</span>';
        }
      }

      if (winQueueEl) {
        winQueueEl.textContent = `Очередь: ${data.queue_count || 0}`;
      }

      // Если окно открыто и хост оффлайн, обновляем оверлей
      const overlayEl = document.getElementById('mbtl-screen-overlay');
      if (overlayEl && !this.isConnected) {
        if (!data.online) {
          overlayEl.style.display = 'flex';
          overlayEl.innerHTML = `
            <div style="font-size: 16px; margin-bottom: 8px;">⚫ ХОСТ ОФФЛАЙН</div>
            <div style="color: #aaa; font-size: 11px; max-width: 320px;">
              47Rubles сейчас не в игре или хост-скрипт не запущен на ПК.<br>
              Как только игра запустится, индикатор станет зелёным!
            </div>
          `;
        } else {
          overlayEl.style.display = 'flex';
          overlayEl.innerHTML = `
            <div style="font-size: 16px; color: #00ff66; margin-bottom: 8px;">🟢 ХОСТ В СЕТИ</div>
            <button class="win-btn" onclick="window.mbtlClient.connect()" style="font-size: 12px; padding: 4px 12px; cursor: pointer;">
              ⚔ Войти в лобби
            </button>
          `;
        }
      }

    } catch (err) {
      console.warn('MBTL status check error:', err);
    }
  }

  openWindow() {
    if (window.winManager) {
      window.winManager.openWindow('win-mbtl');
    }
    this.checkHostStatus();
  }

  async connect() {
    const overlayEl = document.getElementById('mbtl-screen-overlay');
    if (overlayEl) {
      overlayEl.style.display = 'flex';
      overlayEl.innerHTML = `
        <div style="font-size: 14px; color: #ffff77; margin-bottom: 6px;">⏳ УСТАНОВКА СОЕДИНЕНИЯ...</div>
        <div style="color: #aaa; font-size: 11px;">Рукопожатие WebRTC P2P (без звука)...</div>
      `;
    }

    try {
      this.disconnect(); // Сброс предыдущего подключения при наличии

      this.pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      // Принимаем входящий видеопоток игры
      this.pc.ontrack = (event) => {
        const videoEl = document.getElementById('mbtl-video');
        if (videoEl && event.streams && event.streams[0]) {
          videoEl.srcObject = event.streams[0];
          videoEl.play().catch(e => console.warn('Video play error:', e));
          if (overlayEl) overlayEl.style.display = 'none';
          this.isConnected = true;
          this.updateControlIndicator();
        }
      };

      // Создаем DataChannel для передачи кнопок
      this.dataChannel = this.pc.createDataChannel('mbtl-input', {
        ordered: true
      });

      this.dataChannel.onopen = () => {
        console.log('MBTL DataChannel open');
      };

      this.dataChannel.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleServerMessage(msg);
        } catch (e) {
          console.error('Invalid DataChannel message:', e);
        }
      };

      this.dataChannel.onclose = () => {
        console.log('MBTL DataChannel closed');
        this.updateControlIndicator();
      };

      // Создаем SDP Offer
      const offer = await this.pc.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: false
      });
      await this.pc.setLocalDescription(offer);

      // Ожидаем завершения сборки ICE-кандидатов (Vanilla ICE)
      await new Promise(resolve => {
        if (this.pc.iceGatheringState === 'complete') {
          resolve();
        } else {
          const checkGathering = () => {
            if (this.pc.iceGatheringState === 'complete') {
              this.pc.removeEventListener('icegatheringstatechange', checkGathering);
              resolve();
            }
          };
          this.pc.addEventListener('icegatheringstatechange', checkGathering);
          setTimeout(resolve, 2500); // Таймаут
        }
      });

      // Отправляем собранный оффер на сигнальный сервер
      const joinRes = await fetch(`${this.apiBase}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: this.clientId,
          offer: this.pc.localDescription
        })
      });

      if (!joinRes.ok) {
        throw new Error('Ошибка регистрации на сигнальном сервере');
      }

      // Начинаем опрос ответа хоста (Answer)
      let attempts = 0;
      this.pollTimer = setInterval(async () => {
        attempts++;
        if (attempts > 30) { // 30 секунд таймаут
          clearInterval(this.pollTimer);
          if (overlayEl) {
            overlayEl.innerHTML = `
              <div style="font-size: 14px; color: #ff5555; margin-bottom: 6px;">⚠ ВРЕМЯ ОЖИДАНИЯ ИСТЕКЛО</div>
              <div style="color: #aaa; font-size: 11px; margin-bottom: 8px;">Хост не ответил на запрос подключения.</div>
              <button class="win-btn" onclick="window.mbtlClient.connect()">Повторить</button>
            `;
          }
          return;
        }

        try {
          const checkRes = await fetch(`${this.apiBase}/client_pull?clientId=${encodeURIComponent(this.clientId)}`, {
            cache: 'no-store'
          });
          if (checkRes.ok) {
            const data = await checkRes.json();
            if (data.ready && data.answer) {
              clearInterval(this.pollTimer);
              await this.pc.setRemoteDescription(new RTCSessionDescription(data.answer));
              this.role = data.role || 'spectator';
              this.isBlockedByHost = Boolean(data.is_blocked);
              this.updateControlIndicator();
            }
          }
        } catch (e) {
          console.warn('Poll answer check error:', e);
        }
      }, 1000);

    } catch (err) {
      console.error('Connection error:', err);
      if (overlayEl) {
        overlayEl.innerHTML = `
          <div style="font-size: 14px; color: #ff5555; margin-bottom: 6px;">❌ ОШИБКА ПОДКЛЮЧЕНИЯ</div>
          <div style="color: #aaa; font-size: 11px; margin-bottom: 8px;">${err.message}</div>
          <button class="win-btn" onclick="window.mbtlClient.connect()">Попробовать снова</button>
        `;
      }
    }
  }

  handleServerMessage(msg) {
    if (msg.type === 'status') {
      this.isBlockedByHost = Boolean(msg.blocked);
      this.updateControlIndicator();
    } else if (msg.type === 'role') {
      this.role = msg.role;
      this.updateControlIndicator();
    } else if (msg.type === 'kicked') {
      this.role = 'spectator';
      this.releaseAllKeys();
      this.updateControlIndicator();
      alert('Хост завершил текущий раунд (F10). Управление передано следующему игроку в очереди.');
    }
  }

  updateControlIndicator() {
    const roleEl = document.getElementById('mbtl-win-role');
    const lockEl = document.getElementById('mbtl-win-lock');

    if (roleEl) {
      if (this.role === 'player2') {
        roleEl.innerHTML = '<span style="color: #00ffcc; font-weight: bold;">[ ИГРОК 2 ]</span>';
      } else {
        roleEl.innerHTML = '<span style="color: #ffffaa;">[ ЗРИТЕЛЬ ]</span>';
      }
    }

    if (lockEl) {
      if (this.role !== 'player2') {
        lockEl.innerHTML = '<span style="color: #aaa;">Режим просмотра</span>';
      } else if (this.isBlockedByHost) {
        lockEl.innerHTML = '<span style="color: #ff5555; font-weight: bold;">🔒 УПРАВЛЕНИЕ ЗАБЛОКИРОВАНО ХОСТОМ</span>';
      } else {
        lockEl.innerHTML = '<span style="color: #00ff66; font-weight: bold;">🎮 УПРАВЛЕНИЕ АКТИВНО</span>';
      }
    }
  }

  handleKeyDown(e) {
    // Проверяем, активно ли окно MBTL
    const win = document.getElementById('win-mbtl');
    if (!win || win.style.display === 'none' || !win.classList.contains('active')) {
      return;
    }

    if (!this.allowedKeys.has(e.code)) {
      return; // Игнорируем любые системные кнопки
    }

    // Блокируем дефолтный скролл страницы браузера стрелками
    e.preventDefault();

    if (this.role !== 'player2' || this.isBlockedByHost) {
      return;
    }

    if (!this.pressedKeys.has(e.code)) {
      this.pressedKeys.add(e.code);
      this.sendKey(e.code, 'down');
      this.highlightKeyBadge(e.code, true);
    }
  }

  handleKeyUp(e) {
    if (!this.allowedKeys.has(e.code)) return;

    if (this.pressedKeys.has(e.code)) {
      this.pressedKeys.delete(e.code);
      this.sendKey(e.code, 'up');
      this.highlightKeyBadge(e.code, false);
    }
  }

  releaseAllKeys() {
    for (const code of this.pressedKeys) {
      this.sendKey(code, 'up');
      this.highlightKeyBadge(code, false);
    }
    this.pressedKeys.clear();
  }

  sendKey(code, action) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify({
          type: 'key',
          action: action, // 'down' | 'up'
          code: code
        }));
      } catch (err) {
        console.warn('Failed to send key:', err);
      }
    }
  }

  highlightKeyBadge(code, isPressed) {
    const el = document.getElementById(`key-${code}`);
    if (el) {
      if (isPressed) {
        el.style.backgroundColor = '#ffff77';
        el.style.borderColor = '#ff0000';
      } else {
        el.style.backgroundColor = '';
        el.style.borderColor = '';
      }
    }
  }

  disconnect() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.releaseAllKeys();
    if (this.dataChannel) {
      try { this.dataChannel.close(); } catch(e) {}
      this.dataChannel = null;
    }
    if (this.pc) {
      try { this.pc.close(); } catch(e) {}
      this.pc = null;
    }
    const videoEl = document.getElementById('mbtl-video');
    if (videoEl) videoEl.srcObject = null;
    this.isConnected = false;
    this.role = 'guest';
    this.checkHostStatus();
    this.updateControlIndicator();
  }
}

// Инициализация при загрузке документа
document.addEventListener('DOMContentLoaded', () => {
  window.mbtlClient = new MBTLClient();
});
