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
    this.pingTimer = null;
    this.currentPing = null;
    
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
    this.checkHostStatus();
    this.statusCheckTimer = setInterval(() => this.checkHostStatus(), 4000);

    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => this.handleKeyUp(e));
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
          ledEl.title = 'Статус: Оффлайн (хост на ПК не запущен)';
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

      // Если окно открыто и не подключены, показываем соответствующую плашку
      const overlayEl = document.getElementById('mbtl-screen-overlay');
      if (overlayEl && !this.isConnected && !this.pollTimer) {
        if (!data.online) {
          overlayEl.style.display = 'flex';
          overlayEl.innerHTML = `
            <div style="font-size: 16px; margin-bottom: 8px;">⚫ ХОСТ ОФФЛАЙН</div>
            <div style="color: #aaa; font-size: 11px; max-width: 320px;">
              Запустите <b>start_host.bat</b> на ПК.<br>
              Как только хост подключится, кнопка станет активной!
            </div>
          `;
        } else {
          overlayEl.style.display = 'flex';
          overlayEl.innerHTML = `
            <div style="font-size: 16px; color: #00ff66; margin-bottom: 8px;">🟢 ХОСТ В СЕТИ</div>
            <button class="win-btn" onclick="window.mbtlClient.connect()" style="font-size: 12px; padding: 5px 16px; cursor: pointer;">
              ⚔ Войти в бой
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
        <div style="font-size: 14px; color: #ffff77; margin-bottom: 6px;">[1/3] ИНИЦИАЛИЗАЦИЯ WEBRTC...</div>
        <div style="color: #aaa; font-size: 11px;">Сбор сетевых кандидатов STUN...</div>
      `;
    }

    try {
      this.disconnect(); // Сброс старой сессии

      this.pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun.services.mozilla.com' }
        ]
      });

      // Приём входящего видео
      this.pc.ontrack = (event) => {
        console.log('Incoming track received:', event.track.kind);
        const videoEl = document.getElementById('mbtl-video');
        if (videoEl && event.streams && event.streams[0]) {
          videoEl.srcObject = event.streams[0];
          videoEl.play().catch(e => console.warn('Video play error:', e));
          if (overlayEl) overlayEl.style.display = 'none';
          this.isConnected = true;
          this.updateControlIndicator();
        }
      };

      // DataChannel для кнопок
      this.dataChannel = this.pc.createDataChannel('mbtl-input', {
        ordered: true
      });

      this.dataChannel.onopen = () => {
        console.log('MBTL DataChannel connected');
        // Запуск периодического замера пинга каждые 1.2 сек
        if (this.pingTimer) clearInterval(this.pingTimer);
        this.pingTimer = setInterval(() => {
          if (this.dataChannel && this.dataChannel.readyState === 'open') {
            try {
              this.dataChannel.send(JSON.stringify({
                type: 'ping',
                t: performance.now()
              }));
            } catch (e) {}
          }
        }, 1200);
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

      // Ожидаем завершения сбора кандидатов (Vanilla ICE)
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
          setTimeout(resolve, 3500); // 3.5 сек на сбор STUN
        }
      });

      if (overlayEl) {
        overlayEl.innerHTML = `
          <div style="font-size: 14px; color: #ffff77; margin-bottom: 6px;">[2/3] ОТПРАВКА ЗАПРОСА...</div>
          <div style="color: #aaa; font-size: 11px;">Регистрация в лобби...</div>
        `;
      }

      // Отправляем оффер на сервер
      const joinRes = await fetch(`${this.apiBase}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: this.clientId,
          offer: {
            sdp: this.pc.localDescription.sdp,
            type: this.pc.localDescription.type
          }
        })
      });

      if (!joinRes.ok) {
        throw new Error('Ошибка регистрации оффера на сервере');
      }

      if (overlayEl) {
        overlayEl.innerHTML = `
          <div style="font-size: 14px; color: #00ffcc; margin-bottom: 6px;">[3/3] ОЖИДАНИЕ ХОСТА...</div>
          <div style="color: #aaa; font-size: 11px;">Хост-скрипт на ПК формирует видеопоток...</div>
        `;
      }

      // Опрашиваем SDP Answer
      let attempts = 0;
      this.pollTimer = setInterval(async () => {
        attempts++;
        if (overlayEl && attempts > 1) {
          const subText = overlayEl.querySelector('div:last-child');
          if (subText) subText.textContent = `Ожидание ответа хоста (${attempts}/30)...`;
        }

        if (attempts > 30) {
          clearInterval(this.pollTimer);
          this.pollTimer = null;
          if (overlayEl) {
            overlayEl.innerHTML = `
              <div style="font-size: 14px; color: #ff5555; margin-bottom: 6px;">⚠ ХОСТ НЕ ОТВЕТИЛ</div>
              <div style="color: #aaa; font-size: 11px; margin-bottom: 8px;">Убедитесь, что <b>start_host.bat</b> запущен на ПК.</div>
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
              this.pollTimer = null;
              await this.pc.setRemoteDescription(new RTCSessionDescription(data.answer));
              this.role = data.role || 'spectator';
              this.isBlockedByHost = Boolean(data.is_blocked);
              this.updateControlIndicator();
              console.log('WebRTC Answer accepted! Role:', this.role);
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
    if (msg.type === 'pong') {
      const rtt = Math.round(performance.now() - msg.t);
      this.currentPing = rtt;
      const pingEl = document.getElementById('mbtl-win-ping');
      if (pingEl) {
        let color = '#00ff66';
        if (rtt > 150) color = '#ff5555';
        else if (rtt > 70) color = '#ffff55';
        pingEl.innerHTML = `⚡ Пинг: <span style="color: ${color}; font-weight: bold;">${rtt} ms</span>`;
      }
      // Отправляем текущий замер пинга хосту
      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        try {
          this.dataChannel.send(JSON.stringify({
            type: 'ping_stat',
            ping: rtt
          }));
        } catch (e) {}
      }
    } else if (msg.type === 'status') {
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
        roleEl.innerHTML = `<span style="color: #00ffcc; font-weight: bold;">[ ИГРОК 2: #${this.clientId} ]</span>`;
      } else {
        roleEl.innerHTML = `<span style="color: #ffffaa;">[ ЗРИТЕЛЬ: #${this.clientId} ]</span>`;
      }
    }

    if (lockEl) {
      if (this.role !== 'player2') {
        lockEl.innerHTML = '<span style="color: #aaa;">Режим просмотра</span>';
      } else if (this.isBlockedByHost) {
        lockEl.innerHTML = '<span style="color: #ff5555; font-weight: bold;">🔒 ЗАБЛОКИРОВАНО ХОСТОМ (Ожидание F9)</span>';
      } else {
        lockEl.innerHTML = '<span style="color: #00ff66; font-weight: bold;">🎮 УПРАВЛЕНИЕ АКТИВНО</span>';
      }
    }
  }

  handleKeyDown(e) {
    const win = document.getElementById('win-mbtl');
    if (!win || win.style.display === 'none') {
      return;
    }

    if (!this.allowedKeys.has(e.code)) {
      return;
    }

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
          action: action,
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
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    const pingEl = document.getElementById('mbtl-win-ping');
    if (pingEl) {
      pingEl.textContent = '⚡ Пинг: -- ms';
    }
    this.currentPing = null;
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

document.addEventListener('DOMContentLoaded', () => {
  window.mbtlClient = new MBTLClient();
});
