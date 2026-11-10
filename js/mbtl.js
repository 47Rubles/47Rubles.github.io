/**
 * 47OS 98 — Melty Blood: Type Lumina (MBTL Remote Play)
 * Клиентский модуль WebRTC-стриминга и захвата управления Игрока 2.
 * - Подключение по умолчанию как Зритель (просмотр без участия)
 * - Кнопка "Встать в очередь на бой" для перехода в бойцы
 * - Двойная раскладка управления: Стрелки/NumPad + WSDA/JUIO
 * - Сенсорный геймпад (D-Pad + кнопки A, B, C, D) для мобильных телефонов
 * - Оптимизированный сбор ICE для мобильного интернета и точек доступа
 * - Переключение качества стрима: 540p (Быстро / Мобильно) и 720p (HD)
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
    this.currentQuality = '540p';
    
    this.role = 'spectator'; // 'player2' | 'spectator'
    this.inQueue = false;
    this.queuePosition = 0;
    this.isBlockedByHost = false;
    this.isOnline = false;
    this.isConnected = false;

    // Дублирование клавиш (WSDA + JUIO дублируют Стрелки + NumPad)
    this.keyAliases = {
      'KeyW': 'ArrowUp',
      'KeyS': 'ArrowDown',
      'KeyA': 'ArrowLeft',
      'KeyD': 'ArrowRight',
      'KeyU': 'Numpad7', // A (Light)
      'KeyI': 'Numpad8', // B (Medium)
      'KeyO': 'Numpad9', // C (Heavy)
      'KeyJ': 'Numpad4', // D (Shield)
      'Digit7': 'Numpad7',
      'Digit8': 'Numpad8',
      'Digit9': 'Numpad9',
      'Digit4': 'Numpad4'
    };

    // Канонические разрешенные клавиши файтинга
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

    // Инициализация сенсорного геймпада
    this.setupTouchGamepad();
  }

  setupTouchGamepad() {
    const gp = document.getElementById('mbtl-gamepad');
    if (!gp) return;

    // Автоматически показать сенсорный геймпад на мобильных устройствах
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth < 768) {
      gp.style.display = 'flex';
    }

    const buttons = gp.querySelectorAll('button[data-key]');
    buttons.forEach(btn => {
      const key = btn.getAttribute('data-key');

      const press = (e) => {
        e.preventDefault();
        btn.classList.add('mbtl-btn-active');
        if ('vibrate' in navigator) {
          try { navigator.vibrate(15); } catch(err) {}
        }
        if (this.role === 'player2' && !this.isBlockedByHost) {
          if (!this.pressedKeys.has(key)) {
            this.pressedKeys.add(key);
            this.sendKey(key, 'down');
            this.highlightKeyBadge(key, true);
          }
        }
      };

      const release = (e) => {
        e.preventDefault();
        btn.classList.remove('mbtl-btn-active');
        if (this.pressedKeys.has(key)) {
          this.pressedKeys.delete(key);
          this.sendKey(key, 'up');
          this.highlightKeyBadge(key, false);
        }
      };

      btn.addEventListener('touchstart', press, { passive: false });
      btn.addEventListener('touchend', release, { passive: false });
      btn.addEventListener('touchcancel', release, { passive: false });
      btn.addEventListener('mousedown', press);
      btn.addEventListener('mouseup', release);
      btn.addEventListener('mouseleave', release);
    });
  }

  toggleGamepad() {
    const gp = document.getElementById('mbtl-gamepad');
    if (gp) {
      gp.style.display = gp.style.display === 'none' ? 'flex' : 'none';
    }
  }

  toggleQuality() {
    const next = this.currentQuality === '540p' ? '720p' : '540p';
    this.currentQuality = next;
    const qBtn = document.getElementById('mbtl-quality-btn');
    if (qBtn) {
      qBtn.textContent = next === '720p' ? '720p (HD)' : '540p (Быстро)';
    }
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify({
          type: 'set_quality',
          quality: next
        }));
      } catch (e) {}
    }
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
          ledEl.title = `Статус: В бою (Очередь: ${data.queue_count || 0})`;
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
            <button class="win-btn" onclick="window.mbtlClient.connect()" style="font-size: 12px; padding: 6px 18px; cursor: pointer;">
              ⚔ Войти на трансляцию
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
        <div style="font-size: 14px; color: #ffff77; margin-bottom: 6px;">[1/3] ПОИСК МАРШРУТОВ STUN...</div>
        <div style="color: #aaa; font-size: 11px;">Определение внешнего IP для прямого P2P...</div>
      `;
    }

    try {
      this.disconnect(); // Сброс старой сессии

      // Только проверенные стабильные Google STUN серверы
      this.pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' }
        ]
      });

      // Приём входящего видео
      this.pc.ontrack = (event) => {
        console.log('Incoming track received:', event.track.kind);
        const videoEl = document.getElementById('mbtl-video');
        if (videoEl && event.streams && event.streams[0]) {
          videoEl.srcObject = event.streams[0];
          // Обязательные атрибуты для мобильных браузеров (iOS Safari / Android)
          videoEl.muted = true;
          videoEl.setAttribute('playsinline', '');
          videoEl.setAttribute('webkit-playsinline', '');
          videoEl.play().catch(e => console.warn('Video play error:', e));
          if (overlayEl) overlayEl.style.display = 'none';
          this.isConnected = true;
          this.updateControlIndicator();
        }
      };

      // DataChannel для кнопок и сигналов
      this.dataChannel = this.pc.createDataChannel('mbtl-input', {
        ordered: true
      });

      this.dataChannel.onopen = () => {
        console.log('MBTL DataChannel connected');
        // Периодический замер пинга каждые 1.2 сек
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
        this.updateControlIndicator();
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

      // Ожидаем завершения сбора кандидатов (до 7.5 сек для мобильных сетей)
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
          setTimeout(resolve, 7500); // 7.5 сек для надежного сбора публичного IP на мобильной сети
        }
      });

      if (overlayEl) {
        overlayEl.innerHTML = `
          <div style="font-size: 14px; color: #ffff77; margin-bottom: 6px;">[2/3] РЕГИСТРАЦИЯ В ЛОББИ...</div>
          <div style="color: #aaa; font-size: 11px;">Передача сетевых координат на хост...</div>
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
          <div style="color: #aaa; font-size: 11px;">Хост на ПК формирует поток и открывает P2P...</div>
        `;
      }

      // Опрашиваем SDP Answer
      let attempts = 0;
      this.pollTimer = setInterval(async () => {
        attempts++;
        if (overlayEl && attempts > 1) {
          const subText = overlayEl.querySelector('div:last-child');
          if (subText) subText.textContent = `Ожидание ответа хоста (${attempts}/35)...`;
        }

        if (attempts > 35) {
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
              this.role = 'spectator';
              this.inQueue = false;
              this.isBlockedByHost = Boolean(data.is_blocked);
              this.updateControlIndicator();
              console.log('WebRTC Answer accepted! Role: Spectator');
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

  toggleQueue() {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      alert('Сначала подключитесь к трансляции!');
      return;
    }

    if (this.role === 'player2' || this.inQueue) {
      try {
        this.dataChannel.send(JSON.stringify({ type: 'leave_queue' }));
      } catch (e) {}
      this.role = 'spectator';
      this.inQueue = false;
      this.queuePosition = 0;
      this.releaseAllKeys();
      this.updateControlIndicator();
    } else {
      try {
        this.dataChannel.send(JSON.stringify({ type: 'join_queue' }));
      } catch (e) {}
      this.inQueue = true;
      this.updateControlIndicator();
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
      if (msg.blocked !== undefined) {
        this.isBlockedByHost = Boolean(msg.blocked);
      }
      if (this.role === 'player2') {
        this.inQueue = false;
      }
      this.updateControlIndicator();
      if (msg.queue_count !== undefined) {
        const winQueueEl = document.getElementById('mbtl-win-queue');
        if (winQueueEl) winQueueEl.textContent = `Очередь: ${msg.queue_count}`;
      }
    } else if (msg.type === 'queue_info') {
      this.inQueue = Boolean(msg.in_queue);
      this.queuePosition = msg.position || 0;
      this.updateControlIndicator();
      if (msg.queue_count !== undefined) {
        const winQueueEl = document.getElementById('mbtl-win-queue');
        if (winQueueEl) winQueueEl.textContent = `Очередь: ${msg.queue_count}`;
      }
    } else if (msg.type === 'kicked') {
      this.role = 'spectator';
      this.inQueue = false;
      this.queuePosition = 0;
      this.releaseAllKeys();
      this.updateControlIndicator();
      alert('Хост завершил текущий раунд (F10). Вы переведены в режим зрителя.');
    }
  }

  updateControlIndicator() {
    const roleEl = document.getElementById('mbtl-win-role');
    const lockEl = document.getElementById('mbtl-win-lock');
    const queueBtn = document.getElementById('mbtl-queue-btn');

    if (roleEl) {
      if (this.role === 'player2') {
        roleEl.innerHTML = `<span style="color: #00ffcc; font-weight: bold;">[ ИГРОК 2: #${this.clientId} ]</span>`;
      } else if (this.inQueue) {
        roleEl.innerHTML = `<span style="color: #ffff77; font-weight: bold;">[ В ОЧЕРЕДИ: #${this.queuePosition || 1} ]</span>`;
      } else {
        roleEl.innerHTML = `<span style="color: #ffffaa;">[ ЗРИТЕЛЬ: #${this.clientId} ]</span>`;
      }
    }

    if (lockEl) {
      if (this.role === 'player2') {
        if (this.isBlockedByHost) {
          lockEl.innerHTML = '<span style="color: #ff5555; font-weight: bold;">🔒 ЗАБЛОКИРОВАНО ХОСТОМ (Ожидание F9)</span>';
        } else {
          lockEl.innerHTML = '<span style="color: #00ff66; font-weight: bold;">🎮 УПРАВЛЕНИЕ АКТИВНО</span>';
        }
      } else if (this.inQueue) {
        lockEl.innerHTML = '<span style="color: #ffffaa;">Ожидание освобождения слота...</span>';
      } else {
        lockEl.innerHTML = '<span style="color: #aaa;">👁 Только просмотр</span>';
      }
    }

    if (queueBtn) {
      if (!this.isConnected) {
        queueBtn.style.display = 'none';
      } else {
        queueBtn.style.display = 'inline-block';
        if (this.role === 'player2') {
          queueBtn.textContent = '🛑 Покинуть бой (в зрители)';
          queueBtn.style.background = '#ffdada';
          queueBtn.style.color = '#aa0000';
        } else if (this.inQueue) {
          queueBtn.textContent = `❌ Выйти из очереди (Вы #${this.queuePosition || 1})`;
          queueBtn.style.background = '#ffffd0';
          queueBtn.style.color = '#886600';
        } else {
          queueBtn.textContent = '⚔ Встать в очередь на бой';
          queueBtn.style.background = '#d8ffd8';
          queueBtn.style.color = '#006600';
        }
      }
    }
  }

  handleKeyDown(e) {
    const win = document.getElementById('win-mbtl');
    if (!win || win.style.display === 'none') {
      return;
    }

    const canonical = this.keyAliases[e.code] || e.code;
    if (!this.allowedKeys.has(canonical)) {
      return;
    }

    e.preventDefault();

    if (this.role !== 'player2' || this.isBlockedByHost) {
      return;
    }

    if (!this.pressedKeys.has(canonical)) {
      this.pressedKeys.add(canonical);
      this.sendKey(canonical, 'down');
      this.highlightKeyBadge(canonical, true);
    }
  }

  handleKeyUp(e) {
    const canonical = this.keyAliases[e.code] || e.code;
    if (!this.allowedKeys.has(canonical)) return;

    if (this.pressedKeys.has(canonical)) {
      this.pressedKeys.delete(canonical);
      this.sendKey(canonical, 'up');
      this.highlightKeyBadge(canonical, false);
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

  highlightKeyBadge(canonicalCode, isPressed) {
    const el = document.getElementById(`key-${canonicalCode}`);
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
    this.inQueue = false;
    this.queuePosition = 0;
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
    this.role = 'spectator';
    this.checkHostStatus();
    this.updateControlIndicator();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.mbtlClient = new MBTLClient();
});
