/**
 * 47OS Art & Meme Gallery Explorer
 * Categorizes artworks into directories: Hand-drawn, AI Art, Memes.
 * Uses watermarked web copies and prevents image viewer flashing.
 */

class GalleryManager {
  constructor() {
    this.gridEl = document.getElementById('gallery-grid-el');
    this.viewerWinEl = document.getElementById('win-image-viewer');
    this.viewerImgEl = document.getElementById('viewer-img');
    this.viewerLoadingEl = document.getElementById('viewer-loading');
    this.viewerTitleEl = document.getElementById('viewer-title');
    this.viewerInfoEl = document.getElementById('viewer-info');
    this.currentPathEl = document.getElementById('gallery-current-path');
    
    this.items = [];
    this.currentFolder = 'all'; // 'all', 'hand', 'ai', 'memes'
    this.selectedItem = null;

    this.folderTitles = {
      all: 'Все работы',
      hand: 'Ручная работа',
      ai: 'ИИ арты',
      memes: 'Мемы'
    };

    this.init();
  }

  async init() {
    try {
      const res = await fetch('assets/gallery/gallery.json');
      if (res.ok) {
        this.items = await res.json();
      }
    } catch (e) {
      console.warn("Could not load gallery manifest:", e);
      this.items = [];
    }

    this.updateFolderCounts();
    this.render();

    // Hook viewer close to clear src
    if (this.viewerWinEl) {
      const closeBtn = this.viewerWinEl.querySelector('.btn-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.clearViewer());
      }
    }
  }

  updateFolderCounts() {
    const counts = { all: this.items.length, hand: 0, ai: 0, memes: 0 };
    this.items.forEach(it => {
      if (counts[it.folder] !== undefined) {
        counts[it.folder]++;
      }
    });

    for (const key in counts) {
      const el = document.getElementById(`count-${key}`);
      if (el) el.textContent = counts[key];
    }
  }

  switchFolder(folderId) {
    this.currentFolder = folderId;

    // Update active tab styling
    document.querySelectorAll('.gallery-tab').forEach(btn => {
      if (btn.getAttribute('data-folder') === folderId) {
        btn.classList.add('active');
        btn.style.fontWeight = 'bold';
      } else {
        btn.classList.remove('active');
        btn.style.fontWeight = 'normal';
      }
    });

    // Update path bar
    if (this.currentPathEl) {
      this.currentPathEl.textContent = `C:\\Галерея_47R\\${this.folderTitles[folderId] || folderId}`;
    }

    this.render();
  }

  render() {
    if (!this.gridEl) return;
    this.gridEl.innerHTML = '';

    let filtered = this.items;
    if (this.currentFolder !== 'all') {
      filtered = this.items.filter(item => item.folder === this.currentFolder);
    }

    if (!filtered || filtered.length === 0) {
      const folderName = this.folderTitles[this.currentFolder] || '';
      this.gridEl.innerHTML = `
        <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 180px; color: #666; font-size: 11px; text-align: center;">
          <div style="font-size: 32px; margin-bottom: 8px;">📁</div>
          <div style="font-weight: bold; margin-bottom: 4px;">Папка «${folderName}» пока пуста</div>
          <div style="color: #888;">Сюда можно добавить новые изображения.</div>
        </div>
      `;
      return;
    }

    filtered.forEach(item => {
      const card = document.createElement('div');
      card.className = 'gallery-card';
      card.innerHTML = `
        <div class="gallery-thumb-wrap">
          <img src="${item.thumb || item.file}" alt="${item.title}" loading="lazy">
        </div>
        <div class="gallery-title" title="${item.title}">${item.title}</div>
      `;

      card.addEventListener('click', () => {
        document.querySelectorAll('.gallery-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedItem = item;
      });

      card.addEventListener('dblclick', () => {
        this.openViewer(item);
      });

      this.gridEl.appendChild(card);
    });
  }

  openViewer(item) {
    if (!this.viewerWinEl) return;

    // 1. Immediately hide previous image and clear src so it NEVER flashes
    if (this.viewerImgEl) {
      this.viewerImgEl.style.display = 'none';
      this.viewerImgEl.src = '';
    }
    if (this.viewerLoadingEl) {
      this.viewerLoadingEl.textContent = '[ ЗАГРУЗКА ИЗОБРАЖЕНИЯ... ]';
      this.viewerLoadingEl.style.display = 'block';
    }

    this.viewerTitleEl.textContent = item.title;
    this.viewerInfoEl.textContent = `${item.category} • Автор: 47Rubles [Защищено знаком «47R»]`;

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
