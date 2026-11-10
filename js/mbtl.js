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

  async checkHostStatus() {
    try {
      let data = null;

      // 1. Быстрая проверка через ntfy с жестким таймаутом 1.2 сек (защита от зависаний)
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 1200);
        const ntfyRes = await fetch('https://ntfy.sh/mbtl_47r_status/json?poll=1', {
          cache: 'no-store',
          signal: ctrl.signal
        });
        clearTimeout(tid);
        if (ntfyRes.ok) {
          const text = await ntfyRes.text();
          const lines = text.trim().split('\n').filter(Boolean);
          if (lines.length > 0) {
            const raw = JSON.parse(lines[lines.length - 1]);
            if (raw.event === 'message') {
              const parsed = JSON.parse(raw.message);
              const nowSec = Date.now() / 1000;
              if (parsed && (nowSec - (parsed.time || 0) < 18)) {
                data = parsed;
              }
            }
          }
        }
      } catch (e) {}

      // 2. Резервная проверка через воркер с таймаутом 1.5 сек
      if (!data) {
        try {
          const ctrl2 = new AbortController();
          const tid2 = setTimeout(() => ctrl2.abort(), 1500);
          const res = await fetch(`${this.apiBase}/status`, {
            cache: 'no-store',
            signal: ctrl2.signal
          });
          clearTimeout(tid2);
          if (res.ok) {
            const wData = await res.json();
            if (wData.online) data = wData;
          }
        } catch (e) {}
      }

      this.isOnline = Boolean(data && data.online);

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

      // Если окно открыто и не подключены, показываем соответствующую плашку
      const overlayEl = document.getElementById('mbtl-screen-overlay');
      if (overlayEl && !this.isConnected && !this.pollTimer) {
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
        <div style="color: #aaa; font-size: 11px;">Быстрое определение внешнего IP (Anycast)...</div>
      `;
    }

    try {
      this.disconnect(); // Сброс старой сессии

      // Генерируем уникальный ID для каждой попытки подключения
      this.clientId = 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);

      // Только скоростные Anycast STUN серверы (ответ 30-50 мс)
      this.pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.cloudflare.com:3478' },
          { urls: 'stun:stun.nextcloud.com:3478' },
          { urls: 'stun:stun.sipgate.net:3478' }
        ]
      });

      // Приём входящего 60 FPS видеопотока
      this.pc.ontrack = (event) => {
        console.log('Incoming video track received:', event.track.kind);
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

      // DataChannel для клавиш и пинга
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

      // Открываем мгновенный SSE push-канал для получения SDP Answer
      let sseReceived = false;
      try {
        if (this.sse) {
          try { this.sse.close(); } catch(e) {}
        }
        this.sse = new EventSource(`https://ntfy.sh/mbtl_47r_ans_${this.clientId}/sse`);
        this.sse.onmessage = async (evt) => {
          if (sseReceived) return;
          try {
            const raw = JSON.parse(evt.data);
            if (raw.event === 'message') {
              const payload = JSON.parse(raw.message);
              if (payload.answer) {
                sseReceived = true;
                if (this.sse) { this.sse.close(); this.sse = null; }
                if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
                await this.pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
                this.role = payload.role || 'spectator';
                this.inQueue = false;
                this.isBlockedByHost = Boolean(payload.is_blocked);
                this.updateControlIndicator();
                console.log('[+] WebRTC Answer принят через мгновенный SSE push!');
              }
            }
          } catch (e) {
            console.warn('SSE message parse error:', e);
          }
        };
      } catch (e) {
        console.warn('EventSource not supported:', e);
      }

      // Создаем SDP Offer
      const offer = await this.pc.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: false
      });
      await this.pc.setLocalDescription(offer);

      // Сбор кандидатов Anycast STUN (выходим мгновенно при нахождении srflx)
      await new Promise(resolve => {
        let isDone = false;
        const done = () => {
          if (!isDone) {
            isDone = true;
            resolve();
          }
        };
        this.pc.onicecandidate = (e) => {
          if (e.candidate && (e.candidate.type === 'srflx' || (e.candidate.candidate && e.candidate.candidate.includes('srflx')))) {
            setTimeout(done, 250);
          }
        };
        setTimeout(done, 1500); // максимум 1.5 сек
      });

      if (overlayEl) {
        overlayEl.innerHTML = `
          <div style="font-size: 14px; color: #ffff77; margin-bottom: 6px;">[2/3] РЕГИСТРАЦИЯ В ЛОББИ...</div>
          <div style="color: #aaa; font-size: 11px;">Передача сетевых координат на хост...</div>
        `;
      }

      const offerPayload = {
        clientId: this.clientId,
        time: Date.now(),
        offer: {
          sdp: this.pc.localDescription.sdp,
          type: this.pc.localDescription.type
        }
      };

      // 1. Мгновенная прямая отправка хосту через ntfy (push)
      fetch('https://ntfy.sh/mbtl_47r_offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(offerPayload)
      }).catch(() => {});

      // 2. Резервная отправка на воркер
      fetch(`${this.apiBase}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(offerPayload)
      }).catch(() => {});

      if (overlayEl) {
        overlayEl.innerHTML = `
          <div style="font-size: 14px; color: #00ffcc; margin-bottom: 6px;">[3/3] ОЖИДАНИЕ ХОСТА...</div>
          <div style="color: #aaa; font-size: 11px;">Открытие P2P прямого туннеля (60 FPS)...</div>
        `;
      }

      // Резервный опрос ответа (если сеть блокирует SSE)
      let attempts = 0;
      this.pollTimer = setInterval(async () => {
        if (sseReceived) {
          clearInterval(this.pollTimer);
          this.pollTimer = null;
          return;
        }

        attempts++;
        if (overlayEl && attempts > 1) {
          const subText = overlayEl.querySelector('div:last-child');
          if (subText) subText.textContent = `Ожидание ответа хоста (${attempts}/25)...`;
        }

        if (attempts > 25) {
          clearInterval(this.pollTimer);
          this.pollTimer = null;
          if (this.sse) { this.sse.close(); this.sse = null; }
          if (overlayEl) {
            overlayEl.innerHTML = `
              <div style="font-size: 14px; color: #ff5555; margin-bottom: 6px;">⚠ ХОСТ НЕ ОТВЕТИЛ</div>
              <div style="color: #aaa; font-size: 11px; margin-bottom: 8px;">Убедитесь, что <b>start_host.bat</b> запущен на ПК и VPN выключен.</div>
              <button class="win-btn" onclick="window.mbtlClient.connect()">Повторить</button>
            `;
          }
          return;
        }

        // Проверяем ntfy poll (с таймаутом 600мс, защита от блокировки)
        try {
          const c1 = new AbortController();
          const t1 = setTimeout(() => c1.abort(), 600);
          const pollRes = await fetch(`https://ntfy.sh/mbtl_47r_ans_${encodeURIComponent(this.clientId)}/json?poll=1`, {
            cache: 'no-store',
            signal: c1.signal
          });
          clearTimeout(t1);
          if (pollRes.ok) {
            const text = await pollRes.text();
            const lines = text.trim().split('\n').filter(Boolean);
            if (lines.length > 0) {
              const raw = JSON.parse(lines[lines.length - 1]);
              if (raw.event === 'message') {
                const data = JSON.parse(raw.message);
                if (data.answer && !sseReceived) {
                  sseReceived = true;
                  if (this.sse) { this.sse.close(); this.sse = null; }
                  clearInterval(this.pollTimer);
                  this.pollTimer = null;
                  await this.pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                  this.role = data.role || 'spectator';
                  this.inQueue = false;
                  this.isBlockedByHost = Boolean(data.is_blocked);
                  this.updateControlIndicator();
                  console.log('[+] WebRTC Answer принят через ntfy poll!');
                  return;
                }
              }
            }
          }
        } catch (e) {}

        // Резервная проверка через воркер (таймаут 800мс)
        try {
          const c2 = new AbortController();
          const t2 = setTimeout(() => c2.abort(), 800);
          const checkRes = await fetch(`${this.apiBase}/client_pull?clientId=${encodeURIComponent(this.clientId)}`, {
            cache: 'no-store',
            signal: c2.signal
          });
          clearTimeout(t2);
          if (checkRes.ok) {
            const data = await checkRes.json();
            if (data.ready && data.answer && !sseReceived) {
              sseReceived = true;
              if (this.sse) { this.sse.close(); this.sse = null; }
              clearInterval(this.pollTimer);
              this.pollTimer = null;
              await this.pc.setRemoteDescription(new RTCSessionDescription(data.answer));
              this.role = 'spectator';
              this.inQueue = false;
              this.isBlockedByHost = Boolean(data.is_blocked);
              this.updateControlIndicator();
              console.log('[+] WebRTC Answer принят через воркер!');
              return;
            }
          }
        } catch (e) {}
      }, 700);

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
    if (this.sse) {
      try { this.sse.close(); } catch(e) {}
      this.sse = null;
    }
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
