/**
 * 47OS Window Manager
 * Handles window creation, dragging, focus/z-index, minimize, maximize, and taskbar tabs.
 */

class WindowManager {
  constructor() {
    this.windows = new Map();
    this.highestZ = 100;
    this.activeWindow = null;
    this.taskbarTasksEl = document.getElementById('taskbar-tasks');
    this.init();
  }

  init() {
    // Register all DOM windows with class .window
    document.querySelectorAll('.window').forEach(winEl => {
      this.registerWindow(winEl);
    });

    // Close start menu on outside click
    document.addEventListener('click', (e) => {
      const startMenu = document.getElementById('start-menu');
      const startBtn = document.getElementById('start-btn');
      if (startMenu && startBtn && !startMenu.contains(e.target) && !startBtn.contains(e.target)) {
        startMenu.style.display = 'none';
        startBtn.classList.remove('active');
      }
    });
  }

  registerWindow(winEl) {
    const id = winEl.id;
    const titleBar = winEl.querySelector('.title-bar');
    const closeBtn = winEl.querySelector('.btn-close');
    const minBtn = winEl.querySelector('.btn-minimize');
    const maxBtn = winEl.querySelector('.btn-maximize');
    const titleText = winEl.querySelector('.title-bar-text')?.textContent.trim() || id;

    // Create taskbar tab
    const tabEl = document.createElement('div');
    tabEl.className = 'taskbar-tab';
    tabEl.id = `tab-${id}`;
    tabEl.innerHTML = `<span class="tab-title">${titleText}</span>`;
    this.taskbarTasksEl.appendChild(tabEl);

    const winData = {
      el: winEl,
      tabEl: tabEl,
      id: id,
      title: titleText,
      minimized: false,
      maximized: false,
      prevRect: null
    };

    this.windows.set(id, winData);

    // Click on window focuses it
    winEl.addEventListener('mousedown', () => this.bringToFront(id));
    winEl.addEventListener('touchstart', () => this.bringToFront(id), { passive: true });

    // Dragging
    if (titleBar) {
      this.makeDraggable(winEl, titleBar);
    }

    // Controls
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeWindow(id);
      });
    }

    if (minBtn) {
      minBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.minimizeWindow(id);
      });
    }

    if (maxBtn) {
      maxBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMaximize(id);
      });
    }

    // Taskbar tab click
    tabEl.addEventListener('click', () => {
      if (winEl.style.display === 'none' || winData.minimized) {
        this.restoreWindow(id);
      } else if (this.activeWindow === id) {
        this.minimizeWindow(id);
      } else {
        this.bringToFront(id);
      }
    });

    // Initial position centering if not set
    if (!winEl.style.top && !winEl.style.left) {
      const offset = (this.windows.size * 25) % 150;
      winEl.style.top = `${60 + offset}px`;
      winEl.style.left = `${80 + offset}px`;
    }
  }

  bringToFront(id) {
    const win = this.windows.get(id);
    if (!win) return;

    this.highestZ += 2;
    win.el.style.zIndex = this.highestZ;

    // Update active classes
    this.windows.forEach(w => {
      w.el.classList.remove('active');
      w.tabEl.classList.remove('active');
    });

    win.el.classList.add('active');
    win.tabEl.classList.add('active');
    this.activeWindow = id;
  }

  openWindow(id) {
    const win = this.windows.get(id);
    if (!win) return;

    win.el.style.display = 'flex';
    win.tabEl.style.display = 'flex';
    win.minimized = false;
    this.bringToFront(id);

    // Trigger open event on window
    win.el.dispatchEvent(new CustomEvent('win:opened', { detail: { id } }));
  }

  closeWindow(id) {
    const win = this.windows.get(id);
    if (!win) return;

    win.el.style.display = 'none';
    win.tabEl.style.display = 'none';
    win.el.classList.remove('active');
    win.tabEl.classList.remove('active');

    if (this.activeWindow === id) {
      this.activeWindow = null;
      // Focus another visible window
      for (const [wId, wData] of this.windows.entries()) {
        if (wData.el.style.display !== 'none' && !wData.minimized) {
          this.bringToFront(wId);
          break;
        }
      }
    }

    win.el.dispatchEvent(new CustomEvent('win:closed', { detail: { id } }));
  }

  minimizeWindow(id) {
    const win = this.windows.get(id);
    if (!win) return;

    win.el.style.display = 'none';
    win.minimized = true;
    win.el.classList.remove('active');
    win.tabEl.classList.remove('active');

    if (this.activeWindow === id) {
      this.activeWindow = null;
    }
  }

  restoreWindow(id) {
    const win = this.windows.get(id);
    if (!win) return;

    win.el.style.display = 'flex';
    win.minimized = false;
    this.bringToFront(id);
  }

  toggleMaximize(id) {
    const win = this.windows.get(id);
    if (!win) return;

    if (!win.maximized) {
      win.prevRect = {
        top: win.el.style.top,
        left: win.el.style.left,
        width: win.el.style.width,
        height: win.el.style.height
      };
      win.el.style.top = '0px';
      win.el.style.left = '0px';
      win.el.style.width = '100vw';
      win.el.style.height = 'calc(100vh - 28px)';
      win.maximized = true;
    } else {
      if (win.prevRect) {
        win.el.style.top = win.prevRect.top;
        win.el.style.left = win.prevRect.left;
        win.el.style.width = win.prevRect.width;
        win.el.style.height = win.prevRect.height;
      }
      win.maximized = false;
    }
    this.bringToFront(id);
  }

  makeDraggable(winEl, handleEl) {
    let isDragging = false;
    let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;

    const onPointerDown = (e) => {
      const pageX = e.type.startsWith('touch') ? e.touches[0].pageX : e.pageX;
      const pageY = e.type.startsWith('touch') ? e.touches[0].pageY : e.pageY;

      // Ignore buttons
      if (e.target.closest('.title-bar-controls')) return;

      isDragging = true;
      startX = pageX;
      startY = pageY;
      initialLeft = winEl.offsetLeft;
      initialTop = winEl.offsetTop;

      document.addEventListener('mousemove', onPointerMove);
      document.addEventListener('mouseup', onPointerUp);
      document.addEventListener('touchmove', onPointerMove, { passive: false });
      document.addEventListener('touchend', onPointerUp);
    };

    const onPointerMove = (e) => {
      if (!isDragging) return;
      const pageX = e.type.startsWith('touch') ? e.touches[0].pageX : e.pageX;
      const pageY = e.type.startsWith('touch') ? e.touches[0].pageY : e.pageY;

      const deltaX = pageX - startX;
      const deltaY = pageY - startY;

      let newLeft = initialLeft + deltaX;
      let newTop = initialTop + deltaY;

      // Boundaries
      newTop = Math.max(0, Math.min(window.innerHeight - 60, newTop));
      newLeft = Math.max(-100, Math.min(window.innerWidth - 100, newLeft));

      winEl.style.left = `${newLeft}px`;
      winEl.style.top = `${newTop}px`;
    };

    const onPointerUp = () => {
      isDragging = false;
      document.removeEventListener('mousemove', onPointerMove);
      document.removeEventListener('mouseup', onPointerUp);
      document.removeEventListener('touchmove', onPointerMove);
      document.removeEventListener('touchend', onPointerUp);
    };

    handleEl.addEventListener('mousedown', onPointerDown);
    handleEl.addEventListener('touchstart', onPointerDown, { passive: true });
  }

  getActiveWindowBounds() {
    if (!this.activeWindow) return null;
    const win = this.windows.get(this.activeWindow);
    if (!win || win.el.style.display === 'none' || win.minimized) return null;
    return win.el.getBoundingClientRect();
  }
}

window.winManager = new WindowManager();
