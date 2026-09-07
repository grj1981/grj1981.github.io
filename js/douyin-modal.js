'use strict';

(function() {
  var _musicIframe = null;
  var _musicParent = null;
  var _musicSibling = null;
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
    var iframe = findMusicIframe();
    if (!iframe || _musicIframe) return;
    _musicParent = iframe.parentNode;
    _musicSibling = iframe.nextSibling;
    _musicIframe = iframe;
    _musicParent.removeChild(iframe);
  }

  function resumeMusic() {
    if (!_musicIframe || !_musicParent) return;
    if (_musicSibling) {
      _musicParent.insertBefore(_musicIframe, _musicSibling);
    } else {
      _musicParent.appendChild(_musicIframe);
    }
    _musicIframe = null;
    _musicParent = null;
    _musicSibling = null;
  }

  function init() {
    var cards = document.querySelectorAll('.video-card');
    videoIds = [];
    for (var j = 0; j < cards.length; j++) {
      var id = cards[j].getAttribute('data-id');
      if (id) videoIds.push(id);
    }
  }

  function getPlayerUrl(videoId) {
    return 'https://open.douyin.com/player/video?vid=' + encodeURIComponent(videoId);
  }

  function resetPlayer() {
    var currentPlayer = document.getElementById('douyin-player');
    if (!currentPlayer || !currentPlayer.parentNode) return null;

    currentPlayer.src = '';
    var freshPlayer = currentPlayer.cloneNode(false);
    freshPlayer.src = '';
    currentPlayer.replaceWith(freshPlayer);
    return freshPlayer;
  }

  function loadVideo(videoId) {
    if (!videoId) return;
    var player = resetPlayer();
    if (player) player.src = getPlayerUrl(videoId);
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
    loadVideo(videoId);
  }

  function openModal(e) {
    var card = e.currentTarget;
    var videoId = card.getAttribute('data-id');
    var modal = document.getElementById('douyin-modal');
    currentIndex = videoIds.indexOf(videoId);
    if (currentIndex < 0) currentIndex = 0;
    if (modal && videoId) {
      pauseMusic();
      loadVideo(videoId);
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
      var diaryLink = e.target.closest('.related-diary-link');
      if (diaryLink) {
        e.preventDefault();
        if (window._pjax) {
          window._pjax.loadUrl(diaryLink.href);
        } else {
          window.location.href = diaryLink.href;
        }
        return;
      }

      var card = e.target.closest('.video-card');
      if (card) openModal({ currentTarget: card });
    });

    var modal = document.getElementById('douyin-modal');
    var closeBtn = modal ? modal.querySelector('.close-btn') : null;
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    var prevBtn = modal ? modal.querySelector('.nav-btn.prev-btn') : null;
    var nextBtn = modal ? modal.querySelector('.nav-btn.next-btn') : null;
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

    if (modal) {
      modal.addEventListener('click', function(e) {
        if (e.target === modal) closeModal();
      });
    }

    window.addEventListener('pjax:send', function() {
      if (_musicIframe) resumeMusic();
      var modal = document.getElementById('douyin-modal');
      if (modal && modal.classList.contains('active')) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      }
    });
    window.addEventListener('pjax:success', init);
    window.addEventListener('pageshow', function(e) {
      if (e.persisted) init();
    });
  }

  window._douyinModalInit = init;

  setupEvents();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
