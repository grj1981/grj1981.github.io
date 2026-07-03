'use strict';

(function() {
  var mobileQuery = window.matchMedia('(max-width: 767px)');
  var musicPlayer = null;
  var originalParent = null;
  var originalSibling = null;

  function rememberOriginalPosition(player) {
    if (originalParent) return;
    originalParent = player.parentNode;
    originalSibling = player.nextSibling;
  }

  function moveToMobileHolder(player, holder) {
    rememberOriginalPosition(player);
    holder.appendChild(player);
    holder.classList.add('is-visible');
    holder.setAttribute('aria-hidden', 'false');
    player.setAttribute('allow', 'autoplay; encrypted-media');
    player.setAttribute('width', '298');
    player.setAttribute('height', '52');
  }

  function restoreOriginalPosition(player, holder) {
    if (!originalParent) return;
    if (originalSibling && originalSibling.parentNode === originalParent) {
      originalParent.insertBefore(player, originalSibling);
    } else {
      originalParent.appendChild(player);
    }
    holder.classList.remove('is-visible');
    holder.setAttribute('aria-hidden', 'true');
  }

  function syncMusicPlayer() {
    var holder = document.getElementById('mobile-music-player');
    var player = musicPlayer || document.getElementById('music-player');
    if (!holder || !player) return;

    musicPlayer = player;
    if (mobileQuery.matches) {
      moveToMobileHolder(player, holder);
    } else {
      restoreOriginalPosition(player, holder);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncMusicPlayer);
  } else {
    syncMusicPlayer();
  }

  if (typeof mobileQuery.addEventListener === 'function') {
    mobileQuery.addEventListener('change', syncMusicPlayer);
  } else if (typeof mobileQuery.addListener === 'function') {
    mobileQuery.addListener(syncMusicPlayer);
  }

  window.addEventListener('pageshow', syncMusicPlayer);
  window.addEventListener('pjax:success', syncMusicPlayer);
})();
