'use strict';

(function() {
  var SWITCH_TIMEOUT = 3000;
  var _musicIframe = null;
  var _musicParent = null;
  var _musicSibling = null;
  var _switchTimer = null;
  var _isSwitching = false;
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

  function getModalElement(selector) {
    var modal = document.getElementById('douyin-modal');
    return modal ? modal.querySelector(selector) : null;
  }

  function setNavigationState(disabled) {
    var buttons = [
      getModalElement('.nav-btn.prev-btn'),
      getModalElement('.nav-btn.next-btn')
    ];

    buttons.forEach(function(button) {
      if (!button) return;
      if (disabled) {
        button.classList.add('is-disabled');
        button.setAttribute('aria-disabled', 'true');
      } else {
        button.classList.remove('is-disabled');
        button.removeAttribute('aria-disabled');
      }
    });
  }

  function clearSwitchTimer() {
    if (_switchTimer !== null) {
      clearTimeout(_switchTimer);
      _switchTimer = null;
    }
  }

  function finishSwitch(showTimeout) {
    clearSwitchTimer();
    _isSwitching = false;
    setNavigationState(false);

    var status = getModalElement('.douyin-player-status');
    if (!status) return;

    if (showTimeout) {
      status.textContent = '视频加载超时，请打开抖音原页播放';
      status.classList.add('is-visible');
    } else {
      status.textContent = '';
      status.classList.remove('is-visible');
    }
  }

  function updateFallbackLink(videoId) {
    var link = getModalElement('.douyin-fallback-link');
    if (!link) return;
    link.href = 'https://www.douyin.com/video/' + encodeURIComponent(videoId);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
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
    if (!videoId || _isSwitching) return;
    clearSwitchTimer();
    _isSwitching = true;
    setNavigationState(true);
    updateFallbackLink(videoId);

    var status = getModalElement('.douyin-player-status');
    if (status) {
      status.textContent = '正在加载视频…';
      status.classList.remove('is-visible');
    }

    var player = resetPlayer();
    if (!player) {
      finishSwitch(true);
      return;
    }

    player.addEventListener('load', function() {
      finishSwitch(false);
    });
    _switchTimer = setTimeout(function() {
      finishSwitch(true);
    }, SWITCH_TIMEOUT);
    player.src = getPlayerUrl(videoId);
  }

  function navigateVideo(direction) {
    if (videoIds.length === 0 || _isSwitching) return;
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
    clearSwitchTimer();
    _isSwitching = false;
    setNavigationState(false);
    if (player) player.src = '';
    if (modal) modal.classList.remove('active');
    var status = getModalElement('.douyin-player-status');
    if (status) {
      status.textContent = '';
      status.classList.remove('is-visible');
    }
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
        clearSwitchTimer();
        _isSwitching = false;
        setNavigationState(false);
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
