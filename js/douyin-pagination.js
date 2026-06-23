(function() {
  'use strict';

  var ROWS_PER_PAGE = 4;
  var videos = [];
  var currentPage = 1;

  function getColumnCount() {
    var container = document.getElementById('douyin-videos-container');
    if (!container) return 4;
    var cols = getComputedStyle(container).gridTemplateColumns;
    return cols ? cols.split(' ').length : 4;
  }

  function getItemsPerPage() {
    return Math.max(1, getColumnCount() * ROWS_PER_PAGE);
  }

  function renderCard(video) {
    var cover = video.cover
      ? 'background-image: url(\'' + video.cover + '\');'
      : 'background-image: url(https://picsum.photos/360/440?random=' + video.video_id + ');';

    var relatedHtml = '';
    if (video.relatedDiaries && video.relatedDiaries.length > 0) {
      relatedHtml = '<div class="video-related-diaries">';
      relatedHtml += '<div class="related-label">相关日记</div>';
      var maxShow = Math.min(video.relatedDiaries.length, 3);
      for (var i = 0; i < maxShow; i++) {
        var d = video.relatedDiaries[i];
        relatedHtml += '<a href="' + d.path + '" class="related-diary-link" title="' + escapeHtml(d.title) + '" onclick="event.stopPropagation();">' + escapeHtml(d.title).substring(0, 8) + '</a>';
      }
      if (video.relatedDiaries.length > 3) {
        relatedHtml += '<span class="related-more" onclick="event.stopPropagation();">+' + (video.relatedDiaries.length - 3) + '</span>';
      }
      relatedHtml += '</div>';
    }

    return '<div class="videos-item video-card" data-id="' + video.video_id + '">' +
      '<div class="video-cover" style="' + cover + '">' +
        '<div class="video-play-icon"><i class="fa fa-play"></i></div>' +
        '<div class="video-overlay">' +
          '<div class="video-title">' + escapeHtml(video.title).substring(0, 10) + '</div>' +
          '<div class="video-date">' + escapeHtml(video.date) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="video-desc">' + escapeHtml(video.desc) + '</div>' +
      relatedHtml +
    '</div>';
  }

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function getTotalPages() {
    return Math.max(1, Math.ceil(videos.length / getItemsPerPage()));
  }

  function renderGrid() {
    var container = document.getElementById('douyin-videos-container');
    if (!container || !videos.length) return;

    var pageSize = getItemsPerPage();
    var start = (currentPage - 1) * pageSize;
    var end = Math.min(start + pageSize, videos.length);
    var pageVideos = videos.slice(start, end);

    var html = '';
    pageVideos.forEach(function(video) {
      html += renderCard(video);
    });
    container.innerHTML = html;

    if (window._douyinModalInit) {
      window._douyinModalInit();
    }
  }

  function renderPagination() {
    var el = document.getElementById('douyin-pagination');
    if (!el || !videos.length) return;

    var total = getTotalPages();
    if (total <= 1) {
      el.innerHTML = '';
      return;
    }

    var html = '';

    html += '<span class="page-btn prev-btn" data-page="' + (currentPage - 1) + '">&#10094;</span>';

    var range = getPageRange(total);
    range.forEach(function(p) {
      if (p === '...') {
        html += '<span class="page-btn disabled">...</span>';
      } else {
        html += '<span class="page-btn' + (p === currentPage ? ' active' : '') + '" data-page="' + p + '">' + p + '</span>';
      }
    });

    html += '<span class="page-btn next-btn" data-page="' + (currentPage + 1) + '">&#10095;</span>';

    el.innerHTML = html;
    el.style.display = '';
  }

  function getPageRange(total) {
    var range = [];
    if (total <= 7) {
      for (var i = 1; i <= total; i++) range.push(i);
      return range;
    }

    range.push(1);

    if (currentPage > 3) range.push('...');

    var start = Math.max(2, currentPage - 1);
    var end = Math.min(total - 1, currentPage + 1);

    if (currentPage <= 3) start = 2;
    if (currentPage >= total - 2) end = total - 1;

    for (var j = start; j <= end; j++) range.push(j);

    if (currentPage < total - 2) range.push('...');

    range.push(total);
    return range;
  }

  function goToPage(page) {
    var total = getTotalPages();
    if (page < 1 || page > total || page === currentPage) return;
    currentPage = page;
    renderGrid();
    renderPagination();
    window.scrollTo({ top: document.getElementById('douyin-videos-container').offsetTop - 80, behavior: 'smooth' });
  }

  function bindEvents() {
    document.addEventListener('click', function(e) {
      var btn = e.target.closest('.page-btn');
      if (!btn) return;
      var page = parseInt(btn.getAttribute('data-page'), 10);
      if (!isNaN(page)) goToPage(page);
    });
  }

  function init() {
    var dataEl = document.getElementById('douyin-video-data');
    if (!dataEl) return;

    try {
      videos = JSON.parse(dataEl.textContent || dataEl.innerText);
    } catch (e) {
      videos = [];
    }

    if (!videos.length) return;

    var urlPage = parseInt(window.location.hash.replace('#page=', ''), 10);
    currentPage = urlPage >= 1 && urlPage <= getTotalPages() ? urlPage : 1;

    renderGrid();
    renderPagination();
  }

  bindEvents();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('pjax:success', function() {
    setTimeout(init, 0);
  });

  window.addEventListener('hashchange', function() {
    var p = parseInt(window.location.hash.replace('#page=', ''), 10);
    var total = getTotalPages();
    if (p >= 1 && p <= total && p !== currentPage) {
      currentPage = p;
      renderGrid();
      renderPagination();
    }
  });

  var resizeTimer = null;
  window.addEventListener('resize', function() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
      var total = getTotalPages();
      if (currentPage > total) currentPage = total;
      renderGrid();
      renderPagination();
    }, 300);
  });
})();
