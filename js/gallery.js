/**
 * 47OS Art & Meme Gallery Manager
 * Displays watermarked previews from gallery.json and opens retro image viewer.
 */

class GalleryManager {
  constructor() {
    this.gridEl = document.getElementById('gallery-grid-el');
    this.viewerWinEl = document.getElementById('win-image-viewer');
    this.viewerImgEl = document.getElementById('viewer-img');
    this.viewerTitleEl = document.getElementById('viewer-title');
    this.viewerInfoEl = document.getElementById('viewer-info');
    
    this.items = [];
    this.selectedItem = null;
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

    this.render();
  }

  render() {
    if (!this.gridEl) return;
    this.gridEl.innerHTML = '';

    if (!this.items || this.items.length === 0) {
      this.gridEl.innerHTML = `
        <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 180px; color: #666; font-size: 11px; text-align: center;">
          <div style="font-size: 28px; margin-bottom: 8px;">📁</div>
          <div>Папка пуста.</div>
          <div style="margin-top: 4px; color: #888;">Работы появятся здесь, когда ты выберешь, что выложить.</div>
        </div>
      `;
      return;
    }

    this.items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'gallery-card';
      card.innerHTML = `
        <div class="gallery-thumb-wrap">
          <img src="${item.thumb || item.file}" alt="${item.title}" loading="lazy">
        </div>
        <div class="gallery-title">${item.title}</div>
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
    this.viewerImgEl.src = item.file;
    this.viewerTitleEl.textContent = item.title;
    this.viewerInfoEl.textContent = `${item.category} • Автор: 47Rubles`;

    if (window.winManager) {
      window.winManager.openWindow('win-image-viewer');
    }
  }
}

window.galleryMgr = new GalleryManager();
