'use strict';

(function() {
  var videoIds = [];
  var currentIndex = 0;

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
  }

  function setupEvents() {
    if (window._douyinInit) return;
    window._douyinInit = true;

    document.addEventListener('click', function(e) {
      if (e.target.closest('.video-related-diaries')) return;
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

  window._douyinModalInit = init;

  setupEvents();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
