'use strict';

(function() {
  var musicIframe = null;
  var isMusicPaused = false;
  var videoIds = [];
  var currentIndex = 0;

  function findMusicIframe() {
    var iframes = document.getElementsByTagName('iframe');
    for (var i = 0; i < iframes.length; i++) {
      var src = iframes[i].src || '';
      if (src.indexOf('music.163.com') > -1 || src.indexOf('outchain/player') > -1) {
        return iframes[i];
      }
    }
    return null;
  }

  function pauseMusic() {
    musicIframe = findMusicIframe();
    if (musicIframe) {
      var src = musicIframe.src || '';
      if (src.indexOf('auto=1') > -1) {
        musicIframe.src = src.replace('auto=1', 'auto=0');
      }
      isMusicPaused = true;
    }
  }

  function resumeMusic() {
    if (musicIframe && isMusicPaused) {
      var src = musicIframe.src || '';
      if (src.indexOf('auto=0') > -1) {
        musicIframe.src = src.replace('auto=0', 'auto=1');
      }
      isMusicPaused = false;
    }
  }

  function init() {
    var cards = document.querySelectorAll('.video-card');
    videoIds = [];
    for (var j = 0; j < cards.length; j++) {
      var id = cards[j].getAttribute('data-id');
      if (id) videoIds.push(id);
    }
  }

  function navigateVideo(direction) {
    if (videoIds.length === 0) return;
    currentIndex += direction;
    if (currentIndex < 0) {
      currentIndex = videoIds.length - 1;
    } else if (currentIndex >= videoIds.length) {
      currentIndex = 0;
    }
    var videoId = videoIds[currentIndex];
    var player = document.getElementById('douyin-player');
    if (player && videoId) {
      player.src = 'https://open.douyin.com/player/video?vid=' + videoId;
    }
  }

  function openModal(e) {
    var card = e.currentTarget;
    var videoId = card.getAttribute('data-id');
    var player = document.getElementById('douyin-player');
    var modal = document.getElementById('douyin-modal');
    currentIndex = videoIds.indexOf(videoId);
    if (player && modal && videoId) {
      pauseMusic();
      player.src = 'https://open.douyin.com/player/video?vid=' + videoId;
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.marginRight = '0px';
    }
  }

  function closeModal() {
    var player = document.getElementById('douyin-player');
    var modal = document.getElementById('douyin-modal');
    if (player) player.src = '';
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    resumeMusic();
  }

  function setupEvents() {
    if (window._douyinInit) return;
    window._douyinInit = true;

    document.addEventListener('click', function(e) {
      var card = e.target.closest('.video-card');
      if (card) openModal({ currentTarget: card });
    });

    var closeBtn = document.querySelector('.close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    var prevBtn = document.querySelector('.prev-btn');
    var nextBtn = document.querySelector('.next-btn');
    if (prevBtn) {
      prevBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        navigateVideo(-1);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        navigateVideo(1);
      });
    }

    var modal = document.getElementById('douyin-modal');
    if (modal) {
      modal.addEventListener('click', function(e) {
        if (e.target === modal) closeModal();
      });
    }

    window.addEventListener('pjax:success', init);
    window.addEventListener('pageshow', function(e) {
      if (e.persisted) init();
    });
  }

  setupEvents();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
