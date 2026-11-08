/**
 * 47OS CD-Player & Winamp Audio Manager
 * Uses YouTube IFrame API for "Great Cat's Village R (Jazz Remix)"
 * Controls timer strictly based on YouTube player state.
 */

class AudioPlayer {
  constructor() {
    this.playerWindowEl = document.getElementById('win-player');
    this.lcdTitle = document.getElementById('player-lcd-title');
    this.lcdTime = document.getElementById('player-lcd-time');
    this.btnPlay = document.getElementById('player-btn-play');
    this.btnPause = document.getElementById('player-btn-pause');
    this.btnStop = document.getElementById('player-btn-stop');
    this.volumeSlider = document.getElementById('player-volume');
    
    this.ytPlayer = null;
    this.isReady = false;
    this.isPlaying = false;
    this.timerInterval = null;
    this.secondsElapsed = 0;
    this.videoId = 'lsaN3mL-Frg';
    this.volume = 50;
    
    this.init();
  }

  init() {
    // Volume
    this.volumeSlider.addEventListener('input', (e) => {
      this.volume = parseInt(e.target.value, 10);
      if (this.ytPlayer && typeof this.ytPlayer.setVolume === 'function') {
        this.ytPlayer.setVolume(this.volume);
      }
    });

    // Controls
    this.btnPlay.addEventListener('click', () => this.play());
    
    this.btnPause.addEventListener('click', () => {
      this.pause();
      if (window.necoPet && typeof window.necoPet.enforceMusic === 'function') {
        window.necoPet.enforceMusic(this.playerWindowEl, () => this.play());
      }
    });

    this.btnStop.addEventListener('click', () => {
      this.pause();
      this.secondsElapsed = 0;
      this.updateTimeDisplay();
      if (window.necoPet && typeof window.necoPet.enforceMusic === 'function') {
        window.necoPet.enforceMusic(this.playerWindowEl, () => this.play());
      }
    });

    // Load YouTube API
    this.loadYouTubeAPI();
  }

  loadYouTubeAPI() {
    if (window.YT && window.YT.Player) {
      this.createPlayer();
      return;
    }

    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      this.createPlayer();
    };
  }

  createPlayer() {
    this.ytPlayer = new YT.Player('yt-hidden-player', {
      height: '1',
      width: '1',
      videoId: this.videoId,
      playerVars: {
        'playsinline': 1,
        'controls': 0,
        'loop': 1,
        'playlist': this.videoId
      },
      events: {
        'onReady': () => {
          this.isReady = true;
          this.ytPlayer.setVolume(this.volume);
        },
        'onStateChange': (e) => {
          if (e.data === YT.PlayerState.PLAYING) {
            this.isPlaying = true;
            this.startTimer();
            this.lcdTitle.textContent = "1. Great Cat's Village R || Jazz Remix";
          } else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) {
            this.isPlaying = false;
            this.stopTimer();
          }
        }
      }
    });
  }

  play() {
    if (this.ytPlayer && typeof this.ytPlayer.playVideo === 'function') {
      this.ytPlayer.playVideo();
    } else {
      // Retry once ready
      const checkReady = setInterval(() => {
        if (this.ytPlayer && typeof this.ytPlayer.playVideo === 'function') {
          clearInterval(checkReady);
          this.ytPlayer.playVideo();
        }
      }, 300);
      setTimeout(() => clearInterval(checkReady), 4000);
    }
  }

  pause() {
    if (this.ytPlayer && typeof this.ytPlayer.pauseVideo === 'function') {
      this.ytPlayer.pauseVideo();
    }
    this.isPlaying = false;
    this.stopTimer();
  }

  startTimer() {
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.secondsElapsed++;
      this.updateTimeDisplay();
    }, 1000);
  }

  stopTimer() {
    clearInterval(this.timerInterval);
  }

  updateTimeDisplay() {
    const mins = String(Math.floor(this.secondsElapsed / 60)).padStart(2, '0');
    const secs = String(this.secondsElapsed % 60).padStart(2, '0');
    this.lcdTime.textContent = `${mins}:${secs}`;
  }
}

window.audioPlayer = new AudioPlayer();
