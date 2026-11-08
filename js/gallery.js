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
    }

    if (!this.items || this.items.length === 0) {
      // Fallback sample
      this.items = [
        {
          id: "NecoArcPTRD",
          title: "Neco-Arc с ПТРД",
          category: "Ручной арт",
          file: "assets/gallery/thumb_NecoArcPTRD.jpg",
          watermark: "Protected with 47R pattern"
        },
        {
          id: "StalcArc",
          title: "StalcArc (S.T.A.L.K.E.R.)",
          category: "Арт по мотивам Зоны",
          file: "assets/gallery/thumb_StalcArc.jpg",
          watermark: "Protected with 47R pattern"
        },
        {
          id: "Cat_posing_with_mittens",
          title: "Котейка в варежках",
          category: "Иллюстрация",
          file: "assets/gallery/thumb_Cat_posing_with_mittens_202607211109.jpg",
          watermark: "Protected with 47R pattern"
        }
      ];
    }

    this.render();
  }

  render() {
    if (!this.gridEl) return;
    this.gridEl.innerHTML = '';

    this.items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'gallery-card';
      card.innerHTML = `
        <div class="gallery-thumb-wrap">
          <img src="${item.file}" alt="${item.title}" loading="lazy">
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
    this.viewerInfoEl.textContent = `${item.category} • [Водяной знак: паттерн «47R»]`;

    if (window.winManager) {
      window.winManager.openWindow('win-image-viewer');
    }

    if (window.necoPet) {
      window.necoPet.playSound('nya');
    }
  }
}

window.galleryMgr = new GalleryManager();
