/**
 * 47OS 98 — Melty Blood: Type Lumina (MBTL Remote Play)
 * Клиентский модуль WebRTC-стриминга и захвата управления Игрока 2.
 * - Высокоскоростной MQTT-сигналинг через WSS (HiveMQ / EMQX) без квот и блокировок DPI
 * - Подключение по умолчанию как Зритель (просмотр без участия)
 * - Кнопка "Встать в очередь на бой" для перехода в бойцы
 * - Двойная раскладка управления: Стрелки/NumPad + WSDA/JUIO
 * - Сенсорный геймпад (D-Pad + кнопки A, B, C, D) для мобильных телефонов
 * - Оптимизированный сбор ICE для мобильного интернета и точек доступа
 * - Переключение качества стрима: 540p (Быстро / Мобильно) и 720p (HD)
 */

class MiniMQTTClient {
  constructor() {
    this.brokers = [
      'wss://broker.hivemq.com:8884/mqtt',
      'wss://broker.emqx.io:8084/mqtt'
    ];
    this.brokerIdx = 0;
    this.ws = null;
    this.clientId = 'c_' + Math.random().toString(36).substring(2, 9);
    this.subscriptions = new Map(); // topic -> Set(callbacks)
    this.connected = false;
    this.pingTimer = null;
    this.reconnectTimer = null;
    this.connect();
  }

  get currentBroker() {
    return this.brokers[this.brokerIdx];
  }

  connect() {
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
    }
    const url = this.currentBroker;
    try {
      this.ws = new WebSocket(url, ['mqtt']);
      this.ws.binaryType = 'arraybuffer';
    } catch (err) {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.sendConnect();
    };

    this.ws.onmessage = (e) => {
      this.handlePacket(new Uint8Array(e.data));
    };

    this.ws.onerror = () => {
      this.brokerIdx = (this.brokerIdx + 1) % this.brokers.length;
    };

    this.ws.onclose = () => {
      this.connected = false;
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.scheduleReconnect();
    };
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 2000);
  }

  sendConnect() {
    const enc = new TextEncoder();
    const cBytes = enc.encode(this.clientId);
    const p = [0, 4, 0x4D, 0x51, 0x54, 0x54, 4, 2, 0, 30, 0, cBytes.length, ...cBytes];
    this.ws.send(new Uint8Array([0x10, ...this.encodeLen(p.length), ...p]));
  }

  encodeLen(len) {
    const bytes = [];
    do {
      let digit = len % 128;
      len = Math.floor(len / 128);
      if (len > 0) digit |= 0x80;
      bytes.push(digit);
    } while (len > 0);
    return bytes;
  }

  handlePacket(data) {
    const type = data[0] >> 4;
    if (type === 2) { // CONNACK
      this.connected = true;
      for (const topic of this.subscriptions.keys()) {
        this.sendSubscribe(topic);
      }
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => {
        if (this.ws && this.connected) {
          try { this.ws.send(new Uint8Array([0xC0, 0x00])); } catch (e) {}
        }
      }, 20000);
    } else if (type === 3) { // PUBLISH
      let pos = 1;
      let multiplier = 1, len = 0, digit;
      do {
        digit = data[pos++];
        len += (digit & 0x7f) * multiplier;
        multiplier *= 128;
      } while ((digit & 0x80) !== 0);
      const topicLen = (data[pos] << 8) | data[pos + 1];
      pos += 2;
      const topic = new TextDecoder().decode(data.subarray(pos, pos + topicLen));
      pos += topicLen;
      const payloadStr = new TextDecoder().decode(data.subarray(pos));
      let payload = payloadStr;
      try { payload = JSON.parse(payloadStr); } catch (e) {}

      const cbs = this.subscriptions.get(topic);
      if (cbs) {
        cbs.forEach(cb => {
          try { cb(payload, topic); } catch (err) { console.warn('MQTT callback error:', err); }
        });
      }
    }
  }

  sendSubscribe(topic) {
    if (!this.ws || !this.connected) return;
    const tBytes = new TextEncoder().encode(topic);
    const id = 1;
    const p = [(id >> 8) & 0xff, id & 0xff, (tBytes.length >> 8) & 0xff, tBytes.length & 0xff, ...tBytes, 0];
    try {
      this.ws.send(new Uint8Array([0x82, ...this.encodeLen(p.length), ...p]));
    } catch (e) {}
  }

  subscribe(topic, cb) {
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());
      this.sendSubscribe(topic);
    }
    this.subscriptions.get(topic).add(cb);
  }

  unsubscribe(topic, cb) {
    if (this.subscriptions.has(topic)) {
      if (cb) {
        this.subscriptions.get(topic).delete(cb);
        if (this.subscriptions.get(topic).size === 0) {
          this.subscriptions.delete(topic);
        }
      } else {
        this.subscriptions.delete(topic);
      }
    }
  }

  publish(topic, msg) {
    if (!this.ws || !this.connected) return false;
    const tBytes = new TextEncoder().encode(topic);
    const mStr = (typeof msg === 'string') ? msg : JSON.stringify(msg);
    const mBytes = new TextEncoder().encode(mStr);
    const p = [(tBytes.length >> 8) & 0xff, tBytes.length & 0xff, ...tBytes, ...mBytes];
    try {
      this.ws.send(new Uint8Array([0x30, ...this.encodeLen(p.length), ...p]));
      return true;
    } catch (e) {
      return false;
    }
  }
}

class MBTLClient {
  constructor() {
    this.clientId = 'c_' + Math.random().toString(36).substring(2, 9);
    this.mqtt = new MiniMQTTClient();

    this.pc = null;
    this.dataChannel = null;
    this.statusCheckTimer = null;
    this.pingTimer = null;
    this.connectTimeout = null;
    this.answerSubTopic = null;
    this.currentPing = null;
    this.currentQuality = '540p';

    this.lastHostSeen = 0;
    this.lastHostStatus = null;

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
    // Мгновенная подписка на статус хоста через MQTT
    this.mqtt.subscribe('47os/mbtl/status', (data) => this.onHostStatus(data));
    this.statusCheckTimer = setInterval(() => this.checkHostHeartbeat(), 2000);

    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => this.handleKeyUp(e));
    window.addEventListener('blur', () => this.releaseAllKeys());

    // Инициализация сенсорного геймпада
    this.setupTouchGamepad();
  }

  onHostStatus(data) {
    if (!data) return;
    this.lastHostSeen = Date.now();
    this.lastHostStatus = data;
    this.isOnline = Boolean(data.online);
    this.renderStatusUI(data);
  }

  checkHostHeartbeat() {
    const isAlive = (Date.now() - this.lastHostSeen) < 6000;
    if (!isAlive && this.isOnline) {
      this.isOnline = false;
      this.renderStatusUI(null);
    }
  }

  renderStatusUI(data) {
    const ledEl = document.getElementById('mbtl-status-led');
    const winStatusEl = document.getElementById('mbtl-win-status');
    const winQueueEl = document.getElementById('mbtl-win-queue');

    if (ledEl) {
      ledEl.className = 'desktop-icon-badge';
      if (!this.isOnline) {
        ledEl.classList.add('badge-offline');
        ledEl.title = 'Статус: Оффлайн (хост на ПК не запущен)';
      } else if (data && data.active_player) {
        ledEl.classList.add('badge-busy');
        ledEl.title = `Статус: В бою (Очередь: ${data.queue_count || 0})`;
      } else {
        ledEl.classList.add('badge-online');
        ledEl.title = 'Статус: Онлайн (Свободно для боя!)';
      }
    }

    if (winStatusEl) {
      if (!this.isOnline) {
        winStatusEl.innerHTML = '<span style="color: #bbb;">⚫ ОФФЛАЙН</span>';
      } else if (data && data.active_player) {
        winStatusEl.innerHTML = '<span style="color: #ff5555;">🔴 В БОЮ</span>';
      } else {
        winStatusEl.innerHTML = '<span style="color: #00ff66;">🟢 СВОБОДНО</span>';
      }
    }

    if (winQueueEl) {
      winQueueEl.textContent = `Очередь: ${data ? (data.queue_count || 0) : 0}`;
    }

    // Если экран не подключен, обновляем оверлей
    const overlayEl = document.getElementById('mbtl-screen-overlay');
    if (overlayEl && !this.isConnected && !this.connectTimeout) {
      if (!this.isOnline) {
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
          <div style="font-size: 16px; color: #00ff66; margin-bottom: 8px;">🟢 ХОСТ В СЕТИ (60 FPS)</div>
          <button class="win-btn" onclick="window.mbtlClient.connect()" style="font-size: 12px; padding: 6px 18px; cursor: pointer;">
            ⚔ Войти на трансляцию
          </button>
        `;
      }
    }
  }

  setupTouchGamepad() {
    const win = document.getElementById('win-mbtl');
    if (!win) return;

    const arena = document.getElementById('mbtl-arena');
    const isTouch = ('ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth < 768);

    // На ПК по умолчанию скрываем сенсорные крылья геймпада
    if (!isTouch && arena) {
      arena.classList.add('mbtl-wings-hidden');
    }

    const buttons = win.querySelectorAll('button[data-key]');
    buttons.forEach(btn => {
      const key = btn.getAttribute('data-key');
      let isTouched = false;

      const press = (e) => {
        if (e.type === 'touchstart') isTouched = true;
        if (e.type === 'mousedown' && isTouched) return;
        e.preventDefault();
        btn.classList.add('mbtl-btn-active');
        if ('vibrate' in navigator && e.type === 'touchstart') {
          try { navigator.vibrate(12); } catch(err) {}
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
        if (e.type === 'touchend' || e.type === 'touchcancel') {
          setTimeout(() => { isTouched = false; }, 350);
        }
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
    const arena = document.getElementById('mbtl-arena');
    if (arena) {
      arena.classList.toggle('mbtl-wings-hidden');
    }
  }

  toggleFullscreen() {
    const win = document.getElementById('win-mbtl');
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      const target = win || document.documentElement;
      if (target.requestFullscreen) {
        target.requestFullscreen().catch(() => {});
      } else if (target.webkitRequestFullscreen) {
        target.webkitRequestFullscreen();
      }
      if (window.winManager && win) {
        const winData = window.winManager.windows.get('win-mbtl');
        if (winData && !winData.maximized) {
          window.winManager.toggleMaximize('win-mbtl');
        }
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
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

  openWindow() {
    if (window.winManager) {
      window.winManager.openWindow('win-mbtl');
    }
    this.checkHostHeartbeat();
  }

  async connect() {
    const overlayEl = document.getElementById('mbtl-screen-overlay');
    if (overlayEl) {
      overlayEl.style.display = 'flex';
      overlayEl.innerHTML = `
        <div style="font-size: 14px; color: #ffff77; margin-bottom: 6px;">[1/3] ПОИСК МАРШРУТОВ STUN...</div>
        <div style="color: #aaa; font-size: 11px;">Определение внешних и локальных маршрутов...</div>
      `;
    }

    try {
      this.disconnect();

      this.clientId = 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);

      this.pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.cloudflare.com:3478' },
          { urls: 'stun:stun.nextcloud.com:3478' },
          { urls: 'stun:stun.sipgate.net:3478' }
        ]
      });

      // Приём видеопотока 60 FPS
      this.pc.ontrack = (event) => {
        const videoEl = document.getElementById('mbtl-video');
        if (videoEl && event.streams && event.streams[0]) {
          videoEl.srcObject = event.streams[0];
          videoEl.muted = true;
          videoEl.setAttribute('playsinline', '');
          videoEl.setAttribute('webkit-playsinline', '');
          videoEl.play().catch(e => console.warn('Video play error:', e));
          if (overlayEl) overlayEl.style.display = 'none';
          this.isConnected = true;
          this.updateControlIndicator();
        }
      };

      // DataChannel для клавиш и замера пинга
      this.dataChannel = this.pc.createDataChannel('mbtl-input', {
        ordered: true
      });

      this.dataChannel.onopen = () => {
        console.log('MBTL DataChannel connected');
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

      // Подписываемся на персональный ответ хоста через MQTT
      this.answerSubTopic = `47os/mbtl/answers/${this.clientId}`;
      let answerHandled = false;

      this.mqtt.subscribe(this.answerSubTopic, async (payload) => {
        if (answerHandled) return;
        answerHandled = true;
        if (this.connectTimeout) {
          clearTimeout(this.connectTimeout);
          this.connectTimeout = null;
        }
        this.mqtt.unsubscribe(this.answerSubTopic);

        try {
          await this.pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
          this.role = payload.role || 'spectator';
          this.inQueue = false;
          this.isBlockedByHost = Boolean(payload.is_blocked);
          this.updateControlIndicator();
          console.log('[+] WebRTC Answer принят через мгновенный MQTT WSS!');
        } catch (err) {
          console.error('Remote description error:', err);
        }
      });

      // Создаем SDP Offer
      const offer = await this.pc.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: false
      });
      await this.pc.setLocalDescription(offer);

      // Сбор кандидатов Anycast STUN с поддержкой Trickle ICE
      await new Promise(resolve => {
        let isDone = false;
        const done = () => {
          if (!isDone) {
            isDone = true;
            resolve();
          }
        };

        const onGatherChange = () => {
          if (this.pc && this.pc.iceGatheringState === 'complete') {
            done();
          }
        };
        this.pc.addEventListener('icegatheringstatechange', onGatherChange);

        this.pc.onicecandidate = (e) => {
          if (e.candidate) {
            // Trickle ICE: транслируем кандидат на хост
            this.mqtt.publish(`47os/mbtl/candidates/${this.clientId}`, {
              clientId: this.clientId,
              candidate: e.candidate.toJSON ? e.candidate.toJSON() : {
                candidate: e.candidate.candidate,
                sdpMid: e.candidate.sdpMid,
                sdpMLineIndex: e.candidate.sdpMLineIndex
              }
            });

            // При обнаружении публичного маршрута (srflx) ждём 200 мс на финализацию
            if (e.candidate.type === 'srflx' || (e.candidate.candidate && e.candidate.candidate.includes('srflx'))) {
              setTimeout(done, 200);
            }
          } else {
            // e.candidate === null означает завершение сбора
            done();
          }
        };

        setTimeout(done, 1500);
      });

      if (overlayEl) {
        overlayEl.innerHTML = `
          <div style="font-size: 14px; color: #ffff77; margin-bottom: 6px;">[2/3] РЕГИСТРАЦИЯ В ЛОББИ...</div>
          <div style="color: #aaa; font-size: 11px;">Передача сетевых координат на хост...</div>
        `;
      }

      // Публикуем оффер хосту через MQTT
      const offerPayload = {
        clientId: this.clientId,
        time: Date.now(),
        offer: {
          sdp: this.pc.localDescription.sdp,
          type: this.pc.localDescription.type
        }
      };
      this.mqtt.publish('47os/mbtl/offers', offerPayload);

      if (overlayEl) {
        overlayEl.innerHTML = `
          <div style="font-size: 14px; color: #00ffcc; margin-bottom: 6px;">[3/3] ОЖИДАНИЕ ХОСТА...</div>
          <div style="color: #aaa; font-size: 11px;">Открытие P2P прямого туннеля (60 FPS)...</div>
        `;
      }

      // Таймаут на ответ хоста
      this.connectTimeout = setTimeout(() => {
        if (!answerHandled) {
          if (overlayEl) {
            overlayEl.innerHTML = `
              <div style="font-size: 14px; color: #ff5555; margin-bottom: 6px;">⚠ ХОСТ НЕ ОТВЕТИЛ</div>
              <div style="color: #aaa; font-size: 11px; margin-bottom: 8px;">Убедитесь, что <b>start_host.bat</b> запущен на ПК хоста.</div>
              <button class="win-btn" onclick="window.mbtlClient.connect()">Повторить</button>
            `;
          }
        }
      }, 12000);

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
    } else if (msg.type === 'role') {
      this.role = msg.role;
      if (typeof msg.blocked === 'boolean') {
        this.isBlockedByHost = msg.blocked;
      }
      if (typeof msg.queue_count === 'number') {
        const qEl = document.getElementById('mbtl-win-queue');
        if (qEl) qEl.textContent = `Очередь: ${msg.queue_count}`;
      }
      this.updateControlIndicator();
    } else if (msg.type === 'queue_info') {
      if (typeof msg.in_queue === 'boolean') this.inQueue = msg.in_queue;
      if (typeof msg.position === 'number') this.queuePosition = msg.position;
      if (typeof msg.queue_count === 'number') {
        const qEl = document.getElementById('mbtl-win-queue');
        if (qEl) qEl.textContent = `Очередь: ${msg.queue_count}`;
      }
      this.updateControlIndicator();
    } else if (msg.type === 'status') {
      if (typeof msg.blocked === 'boolean') {
        this.isBlockedByHost = msg.blocked;
      }
      this.updateControlIndicator();
    } else if (msg.type === 'kicked') {
      this.role = 'spectator';
      this.inQueue = false;
      this.queuePosition = 0;
      this.releaseAllKeys();
      this.updateControlIndicator();
    }
  }

  updateControlIndicator() {
    const roleEl = document.getElementById('mbtl-role-indicator');
    const lockEl = document.getElementById('mbtl-lock-indicator');
    const queueBtn = document.getElementById('mbtl-queue-btn');

    if (roleEl) {
      if (this.role === 'player2') {
        roleEl.innerHTML = '<span style="color: #00ff66; font-weight: bold;">⚔ ИГРОК 2 (ВЫ В БОЮ!)</span>';
      } else if (this.inQueue) {
        roleEl.innerHTML = `<span style="color: #ffff55; font-weight: bold;">⏳ В ОЧЕРЕДИ (Вы #${this.queuePosition || 1})</span>`;
      } else {
        roleEl.innerHTML = '<span style="color: #00ccff;">👁 ЗРИТЕЛЬ</span>';
      }
    }

    if (lockEl) {
      if (this.role === 'player2') {
        if (this.isBlockedByHost) {
          lockEl.innerHTML = '<span style="color: #ff5555; font-weight: bold;">🔒 УПРАВЛЕНИЕ ЗАБЛОКИРОВАНО ХОСТОМ (F9)</span>';
        } else {
          lockEl.innerHTML = '<span style="color: #00ff66; font-weight: bold;">🔓 УПРАВЛЕНИЕ АКТИВНО!</span>';
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

  async runDiagnostics() {
    let modal = document.getElementById('mbtl-diag-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'mbtl-diag-modal';
      modal.className = 'window';
      modal.style.position = 'fixed';
      modal.style.top = '50%';
      modal.style.left = '50%';
      modal.style.transform = 'translate(-50%, -50%)';
      modal.style.width = 'min(92vw, 460px)';
      modal.style.zIndex = '99999';
      modal.style.boxShadow = '0 6px 20px rgba(0,0,0,0.5)';
      document.body.appendChild(modal);
    }
    modal.style.display = 'block';
    modal.innerHTML = `
      <div class="title-bar">
        <div class="title-bar-text">🔍 47OS 98 — Самодиагностика сети MBTL</div>
        <div class="title-bar-controls">
          <button class="title-btn btn-close" onclick="document.getElementById('mbtl-diag-modal').style.display='none'">✕</button>
        </div>
      </div>
      <div class="window-body" style="padding: 10px; font-size: 12px;">
        <div id="mbtl-diag-content" style="background: #fff; border: 2px inset #dfdfdf; padding: 10px; font-family: monospace; min-height: 180px; line-height: 1.6; word-break: break-word;">
          Запуск тестов связи...
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px;">
          <button class="win-btn" onclick="window.mbtlClient.runDiagnostics()">🔄 Повторить тест</button>
          <button class="win-btn" onclick="document.getElementById('mbtl-diag-modal').style.display='none'">Закрыть</button>
        </div>
      </div>
    `;

    const logEl = document.getElementById('mbtl-diag-content');
    const logs = [];
    const addLog = (icon, title, details = '') => {
      logs.push(`${icon} ${title}${details ? ' — ' + details : ''}`);
      logEl.innerHTML = logs.map(l => `<div style="margin-bottom: 4px;">${l}</div>`).join('');
    };

    addLog('⏳', 'Версия клиента', 'v2.2 (MQTT WSS + Trickle ICE)');
    await new Promise(r => setTimeout(r, 200));

    // 1. WebRTC & Codecs
    if (window.RTCPeerConnection) {
      addLog('🟢', '1. WebRTC API в браузере', 'Поддерживается');
    } else {
      addLog('🔴', '1. WebRTC API в браузере', 'НЕ поддерживается!');
      return;
    }

    // 2. Сигнальный сервер WSS (MQTT)
    addLog('⏳', '2. Сигнальный WSS брокер', 'Проверка связи...');
    let mqttOk = false;

    if (this.mqtt.connected) {
      mqttOk = true;
    } else {
      for (let i = 0; i < 25; i++) {
        if (this.mqtt.connected) {
          mqttOk = true;
          break;
        }
        await new Promise(r => setTimeout(r, 100));
      }
    }

    if (mqttOk) {
      const brokerHost = this.mqtt.currentBroker.replace('wss://', '').split('/')[0];
      addLog('🟢', '2. Сигнальный WSS брокер', `Подключен к ${brokerHost}`);
    } else {
      addLog('🔴', '2. Сигнальный WSS брокер', 'Сбой подключения! Проверьте сеть.');
    }

    // 3. Anycast STUN
    addLog('⏳', '3. Anycast STUN сервер', 'Определение IP...');
    let stunIp = null;
    try {
      const testPc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }]
      });
      testPc.createDataChannel('diag');
      const testOffer = await testPc.createOffer();
      await testPc.setLocalDescription(testOffer);

      await new Promise(resolve => {
        const timeout = setTimeout(() => { try { testPc.close(); } catch(e){} resolve(); }, 2000);
        testPc.onicecandidate = (e) => {
          if (e.candidate && e.candidate.candidate && e.candidate.candidate.includes('srflx')) {
            const parts = e.candidate.candidate.split(' ');
            stunIp = parts[4];
            clearTimeout(timeout);
            try { testPc.close(); } catch(err){}
            resolve();
          }
        };
      });

      if (stunIp) {
        addLog('🟢', '3. Anycast STUN сервер', `Внешний IP: ${stunIp}`);
      } else {
        addLog('🟡', '3. Anycast STUN сервер', 'Маршрут LAN (в одной Wi-Fi сети с хостом)');
      }
    } catch (err) {
      addLog('🔴', '3. STUN ошибка', err.message);
    }

    // 4. Пинг хост-машины (ПК)
    addLog('⏳', '4. Связь с ПК хоста', 'Запрос к mbtl_host.py...');
    let hostPong = null;
    const diagTopic = `47os/mbtl/diag/pong/${this.clientId}`;
    const tStart = performance.now();

    const onPong = (data) => {
      hostPong = data;
    };
    this.mqtt.subscribe(diagTopic, onPong);

    this.mqtt.publish('47os/mbtl/diag/ping', {
      clientId: this.clientId,
      time: Date.now()
    });

    for (let i = 0; i < 30; i++) {
      if (hostPong) break;
      await new Promise(r => setTimeout(r, 100));
    }
    this.mqtt.unsubscribe(diagTopic, onPong);

    if (hostPong) {
      const rtt = Math.round(performance.now() - tStart);
      const winStatus = hostPong.game_window ? 'Окно игры захвачено (60 FPS)' : 'Ожидание окна MBTL';
      addLog('🟢', '4. ПК Хоста на связи!', `${rtt} ms | ${winStatus}`);
      addLog('✨', 'ИТОГ', 'Все узлы работают! Нажмите «Подключиться».');
    } else {
      addLog('🔴', '4. ПК Хоста НЕ отвечает!', 'start_host.bat не запущен или завис');
      addLog('💡', 'Решение', 'Закройте окно start_host.bat на ПК и запустите его снова.');
    }
  }

  disconnect() {
    if (this.connectTimeout) {
      clearTimeout(this.connectTimeout);
      this.connectTimeout = null;
    }
    if (this.answerSubTopic) {
      this.mqtt.unsubscribe(this.answerSubTopic);
      this.answerSubTopic = null;
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
      try { this.dataChannel.close(); } catch (e) {}
      this.dataChannel = null;
    }
    if (this.pc) {
      try { this.pc.close(); } catch (e) {}
      this.pc = null;
    }
    const videoEl = document.getElementById('mbtl-video');
    if (videoEl) videoEl.srcObject = null;
    this.isConnected = false;
    this.role = 'spectator';
    this.checkHostHeartbeat();
    this.updateControlIndicator();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.mbtlClient = new MBTLClient();
});
