/**
 * 47OS 98 Art & Meme Gallery Explorer
 * Authentic Windows 98 directory navigation:
 * - Root folder: C:\Галерея_47R with 3 directories (Ручная работа, ИИ арты, Мемы)
 * - Enter directory on double click (or "Открыть" button)
 * - Exact original filenames preserved
 * - In-place watermarked copies and cached thumbnails
 * - Zero-flicker Image Viewer with background preloading
 */

class GalleryManager {
  constructor() {
    this.gridEl = document.getElementById('gallery-grid-el');
    this.currentPathEl = document.getElementById('gallery-current-path');
    this.windowTitleEl = document.getElementById('gallery-window-title');
    this.btnBackEl = document.getElementById('gallery-btn-back');
    this.btnUpEl = document.getElementById('gallery-btn-up');
    this.statusCountEl = document.getElementById('gallery-status-count');

    this.viewerWinEl = document.getElementById('win-image-viewer');
    this.viewerImgEl = document.getElementById('viewer-img');
    this.viewerLoadingEl = document.getElementById('viewer-loading');
    this.viewerTitleEl = document.getElementById('viewer-title');
    this.viewerInfoEl = document.getElementById('viewer-info');

    this.items = [];
    this.folders = [
      { id: 'hand', title: 'Ручная работа', icon: '🎨', desc: 'Авторские рисунки и ручная графика' },
      { id: 'ai', title: 'ИИ арты', icon: '🤖', desc: 'Нейросетевые арты и генерации' },
      { id: 'memes', title: 'Мемы', icon: '🐸', desc: 'Мемы, щитпосты и приколы' }
    ];

    this.currentFolder = null; // null = root directory "C:\Галерея_47R"
    this.selectedItem = null;
    this.selectedFolder = null;

    this.init();
  }

  async init() {
    try {
      const res = await fetch('assets/gallery/gallery.json?t=' + Date.now());
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          this.items = data;
        } else if (data && typeof data === 'object') {
          if (Array.isArray(data.folders) && data.folders.length > 0) {
            this.folders = data.folders;
          }
          if (Array.isArray(data.items)) {
            this.items = data.items;
          }
        }
      }
    } catch (e) {
      console.warn("Could not load gallery manifest:", e);
    }

    this.render();

    // Hook viewer close
    if (this.viewerWinEl) {
      const closeBtn = this.viewerWinEl.querySelector('.btn-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.clearViewer());
      }
    }
  }

  refresh() {
    this.init();
  }

  goToRoot() {
    this.currentFolder = null;
    this.selectedFolder = null;
    this.selectedItem = null;
    this.render();
  }

  openFolder(folderId) {
    this.currentFolder = folderId;
    this.selectedFolder = null;
    this.selectedItem = null;
    this.render();
  }

  openSelected() {
    if (this.currentFolder === null) {
      if (this.selectedFolder) {
        this.openFolder(this.selectedFolder);
      }
    } else {
      if (this.selectedItem) {
        this.openViewer(this.selectedItem);
      }
    }
  }

  formatFileCount(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 19) return 'файлов';
    if (mod10 === 1) return 'файл';
    if (mod10 >= 2 && mod10 <= 4) return 'файла';
    return 'файлов';
  }

  render() {
    if (!this.gridEl) return;
    this.gridEl.innerHTML = '';

    // ==========================================
    // 1. ROOT VIEW: 3 Directories
    // ==========================================
    if (this.currentFolder === null) {
      if (this.currentPathEl) {
        this.currentPathEl.textContent = 'C:\\Галерея_47R';
      }
      if (this.windowTitleEl) {
        this.windowTitleEl.innerHTML = '<span>📁</span> C:\\Галерея_47R';
      }
      if (this.btnBackEl) this.btnBackEl.disabled = true;
      if (this.btnUpEl) this.btnUpEl.disabled = true;

      if (this.statusCountEl) {
        this.statusCountEl.textContent = `${this.folders.length} папки (всего ${this.items.length} файлов)`;
      }

      this.gridEl.className = 'gallery-grid explorer-folders-view';

      this.folders.forEach(f => {
        const count = this.items.filter(it => it.folder === f.id).length;
        const card = document.createElement('div');
        card.className = 'explorer-folder-card';
        card.setAttribute('data-folder', f.id);
        card.innerHTML = `
          <div class="explorer-folder-icon">
            <svg viewBox="0 0 48 48" width="46" height="46">
              <path d="M4 10 L18 10 L22 14 L44 14 L44 38 L4 38 Z" fill="#e8a838" stroke="#000" stroke-width="2"/>
              <path d="M4 17 L44 17 L40 38 L4 38 Z" fill="#fadc62" stroke="#000" stroke-width="2"/>
              <line x1="6" y1="20" x2="41" y2="20" stroke="#fff" stroke-width="1.5"/>
            </svg>
          </div>
          <div class="explorer-folder-title">${f.title}</div>
          <div class="explorer-folder-desc">${count} ${this.formatFileCount(count)}</div>
        `;

        card.addEventListener('click', (e) => {
          document.querySelectorAll('.explorer-folder-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          this.selectedFolder = f.id;
          if (this.statusCountEl) {
            this.statusCountEl.textContent = `Папка «${f.title}» (${count} ${this.formatFileCount(count)})`;
          }
        });

        card.addEventListener('dblclick', () => {
          this.openFolder(f.id);
        });

        this.gridEl.appendChild(card);
      });

      return;
    }

    // ==========================================
    // 2. FOLDER VIEW: Files in selected directory
    // ==========================================
    const currentFolderInfo = this.folders.find(x => x.id === this.currentFolder) || {
      id: this.currentFolder,
      title: this.currentFolder
    };

    if (this.currentPathEl) {
      this.currentPathEl.textContent = `C:\\Галерея_47R\\${currentFolderInfo.title}`;
    }
    if (this.windowTitleEl) {
      this.windowTitleEl.innerHTML = `<span>📁</span> Галерея 47R - [${currentFolderInfo.title}]`;
    }
    if (this.btnBackEl) this.btnBackEl.disabled = false;
    if (this.btnUpEl) this.btnUpEl.disabled = false;

    this.gridEl.className = 'gallery-grid';

    const filesInFolder = this.items.filter(it => it.folder === this.currentFolder);

    if (this.statusCountEl) {
      this.statusCountEl.textContent = `${filesInFolder.length} ${this.formatFileCount(filesInFolder.length)}`;
    }

    if (filesInFolder.length === 0) {
      this.gridEl.innerHTML = `
        <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; color: #666; text-align: center;">
          <div style="font-size: 38px; margin-bottom: 8px;">📁</div>
          <div style="font-weight: bold; font-size: 12px; margin-bottom: 4px;">Папка «${currentFolderInfo.title}» пуста</div>
          <div style="font-size: 11px; color: #888;">В этой папке пока нет файлов.</div>
        </div>
      `;
      return;
    }

    filesInFolder.forEach(item => {
      const card = document.createElement('div');
      card.className = 'gallery-card';
      const displayName = item.filename || item.title;
      card.innerHTML = `
        <div class="gallery-thumb-wrap">
          <img src="${item.thumb || item.file}" alt="${displayName}" loading="lazy" onerror="this.src='${item.file}'">
        </div>
        <div class="gallery-title" title="${displayName}">${displayName}</div>
      `;

      card.addEventListener('click', () => {
        document.querySelectorAll('.gallery-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedItem = item;
        if (this.statusCountEl) {
          const kb = (item.size / 1024).toFixed(1);
          this.statusCountEl.textContent = `1 объект выбран: ${displayName} (${kb} КБ)`;
        }
      });

      card.addEventListener('dblclick', () => {
        this.openViewer(item);
      });

      this.gridEl.appendChild(card);
    });
  }

  openViewer(item) {
    if (!this.viewerWinEl) return;

    // 1. Instantly reset image and clear src so previous image NEVER flashes
    if (this.viewerImgEl) {
      this.viewerImgEl.style.display = 'none';
      this.viewerImgEl.src = '';
    }
    if (this.viewerLoadingEl) {
      this.viewerLoadingEl.textContent = '[ ЗАГРУЗКА ИЗОБРАЖЕНИЯ... ]';
      this.viewerLoadingEl.style.display = 'block';
    }

    const displayName = item.filename || item.title;
    if (this.viewerTitleEl) {
      this.viewerTitleEl.textContent = displayName;
    }
    if (this.viewerInfoEl) {
      this.viewerInfoEl.textContent = `${item.folderTitle || ''} • ${displayName} [Защищено знаком «47R»]`;
    }

    if (window.winManager) {
      window.winManager.openWindow('win-image-viewer');
    }

    // 2. Preload new image in background and reveal only when ready
    const tempImg = new Image();
    tempImg.onload = () => {
      if (this.viewerImgEl) {
        this.viewerImgEl.src = item.file;
        this.viewerImgEl.style.display = 'block';
      }
      if (this.viewerLoadingEl) {
        this.viewerLoadingEl.style.display = 'none';
      }
    };
    tempImg.onerror = () => {
      if (this.viewerLoadingEl) {
        this.viewerLoadingEl.textContent = '[ Ошибка загрузки файла ]';
      }
    };
    tempImg.src = item.file;
  }

  clearViewer() {
    if (this.viewerImgEl) {
      this.viewerImgEl.style.display = 'none';
      this.viewerImgEl.src = '';
    }
    if (this.viewerLoadingEl) {
      this.viewerLoadingEl.style.display = 'none';
    }
  }
}

window.galleryMgr = new GalleryManager();
