'use strict';

(function() {
  var container = document.querySelector('.sidebar-inner');
  if (!container) return;

  var existEl = document.getElementById('hot-posts-widget');
  if (existEl) return;

  var widget = document.createElement('div');
  widget.id = 'hot-posts-widget';
  widget.className = 'sidebar-widget hot-posts-widget';
  widget.innerHTML = '<div class="sidebar-widget-title"><i class="fa fa-fire"></i> 热门文章</div>' +
    '<div class="sidebar-widget-body" id="hot-posts-list">' +
    '<p style="color:#999;font-size:13px;text-align:center;padding:10px 0;">加载中...</p></div>';
  container.appendChild(widget);

  function renderHotArticles(res) {
    var el = document.getElementById('hot-posts-list');
    if (!el) return;
    if (res.errno !== 0 || !res.data || !res.data.length) {
      el.innerHTML = '<p style="color:#999;font-size:13px;text-align:center;padding:10px 0;">暂无数据</p>';
      return;
    }
    var html = '<ul style="list-style:none;padding:0;margin:0;">';
    res.data.forEach(function(item, i) {
      html += '<li style="padding:6px 0;border-bottom:1px solid rgba(0,0,0,0.04);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
        '<span style="color:#37c6c0;font-weight:700;margin-right:4px;">' + (i+1) + '.</span>' +
        '<a href="' + item.url + '" style="color:#555;text-decoration:none;border:none;" title="' + (item.title || '') + '">' +
        (item.title || item.url) + '</a>' +
        '<span style="color:#ccc;margin-left:4px;font-size:10px;">' + item.count + ' 次</span>' +
      '</li>';
    });
    html += '</ul>';
    el.innerHTML = html;
    if (window._pjax) window._pjax.refresh();
  }

  fetch('/api/hot-articles.json?t=' + Date.now(), { cache: 'no-store' })
    .then(function(r) { return r.json(); })
    .then(renderHotArticles)
    .catch(function() {
      var el = document.getElementById('hot-posts-list');
      if (el) el.innerHTML = '<p style="color:#999;font-size:13px;text-align:center;padding:10px 0;">暂无数据</p>';
    });
})();
