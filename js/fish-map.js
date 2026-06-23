'use strict';

(function() {
  var typeColors = {
    '水库': { start: '#FF6B6B', end: '#EE5A24' },
    '河流': { start: '#FFB347', end: '#E67E22' },
    '沙坑': { start: '#FF6B9D', end: '#E84393' },
    '溪流': { start: '#4FC3F7', end: '#0984E3' }
  };

  var correlationMap = null;

  function loadCorrelationData() {
    var el = document.getElementById('fish-correlation-data');
    if (!el) return null;
    try {
      return JSON.parse(el.textContent || el.innerText);
    } catch (e) {
      return null;
    }
  }

  function loadAmap(callback, retryCount) {
    if (typeof AMap !== 'undefined') {
      callback();
      return;
    }
    retryCount = retryCount || 0;
    window._AMapSecurityConfig = {
      securityJsCode: '8210555c6356b64ebe70c137c6426391'
    };
    var script = document.createElement('script');
    script.src = 'https://webapi.amap.com/maps?v=2.0&key=8d1186c326c9273d8c7a9d5d5256bf42';
    script.onload = callback;
    script.onerror = function() {
      if (retryCount < 1) {
        script.remove();
        setTimeout(function() { loadAmap(callback, retryCount + 1); }, 2000);
      } else {
        var el = document.getElementById('fish-map');
        if (el) el.innerHTML = '<p style="text-align:center;color:#999;padding:40px;">地图加载失败 🐟</p>';
      }
    };
    document.head.appendChild(script);
  }

  function createPinHtml(colors, size) {
    var d = size + 6;
    var th = Math.round(d * 0.32);
    var h = d + th;
    var tw = Math.round(d * 0.5);
    var fs = Math.round(d * 0.38);
    return '<div class="pin-marker" style="--d:' + d + 'px;--h:' + h + 'px;--c1:' + colors.start + ';--c2:' + colors.end + ';--tw:' + tw + 'px;--th:' + th + 'px;--fs:' + fs + 'px">' +
      '<div class="pin-head"><span class="pin-icon">🐟</span></div>' +
      '<div class="pin-tail"></div></div>';
  }

  function buildInfoContent(spot, corr) {
    var html = '<div class="map-info-window">';
    html += '<div class="map-info-header">' +
      '<b>' + spot.name + '</b>' +
      '<span class="map-info-type">' + spot.type + '</span>' +
    '</div>';

    html += '<div class="map-info-stats">';
    html += '<span>📸 ' + spot.photos + ' 张照片</span>';
    html += '<span>🎣 ' + spot.species.join('、') + '</span>';
    html += '<span>📅 ' + spot.year + '</span>';
    if (corr) {
      html += '<span>📝 ' + corr.diaryCount + ' 篇日记</span>';
      html += '<span>🎬 ' + corr.videoCount + ' 个视频</span>';
    }
    html += '</div>';

    html += '<p class="map-info-desc">' + spot.desc + '</p>';

    if (corr && (corr.diaries.length > 0 || corr.videos.length > 0)) {
      html += '<div class="map-info-links">';
      if (corr.diaries.length > 0) {
        html += '<a href="/tags/series-钓鱼日记/" class="map-info-btn">📝 相关日记 (' + corr.diaryCount + ')</a>';
      }
      if (corr.videos.length > 0) {
        html += '<a href="/douyin/" class="map-info-btn">🎬 相关视频 (' + corr.videoCount + ')</a>';
      }
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  function setupPjaxBtn() {
    document.addEventListener('click', function(e) {
      var btn = e.target.closest('.map-info-btn');
      if (!btn) return;
      e.preventDefault();
      var url = btn.getAttribute('href');
      if (url && window._pjax) {
        window._pjax.loadUrl(url);
      } else if (url) {
        window.location.href = url;
      }
    }, true);
  }

  function init() {
    var container = document.getElementById('fish-map');
    if (!container) return;

    correlationMap = loadCorrelationData();
    setupPjaxBtn();

    var map = new AMap.Map('fish-map', {
      zoom: 12,
      resizeEnable: true
    });

    fetch('/fish/map/spots.json')
      .then(function(r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function(data) {
        if (!data.spots || data.spots.length === 0) return;

        var topSpot = data.spots.reduce(function(a, b) {
          return a.photos > b.photos ? a : b;
        });
        map.setCenter([topSpot.lng, topSpot.lat]);

        data.spots.forEach(function(spot) {
          var colors = typeColors[spot.type] || { start: '#ccc', end: '#aaa' };
          var headSize = Math.round(24 + spot.photos * 0.5);
          headSize = Math.min(headSize, 44);
          var d = headSize + 6;
          var h = d + Math.round(d * 0.32);

          var marker = new AMap.Marker({
            position: [spot.lng, spot.lat],
            content: createPinHtml(colors, headSize),
            offset: new AMap.Pixel(-Math.round(d / 2), -h),
            zIndex: 12
          });
          marker.setMap(map);

          var corr = correlationMap && correlationMap.map && correlationMap.map[spot.name] ? correlationMap.map[spot.name] : null;

          var info = new AMap.InfoWindow({
            content: buildInfoContent(spot, corr),
            offset: new AMap.Pixel(0, -20),
            size: new AMap.Size(280, 0)
          });

          marker.on('click', function() {
            info.open(map, marker.getPosition());
          });
        });
      })
      .catch(function(err) {
        console.error('[FishMap] 错误:', err);
        container.innerHTML =
          '<p style="text-align:center;color:#999;padding:40px;">地图数据加载失败 🐟</p>';
      });
  }

  function start() {
    var el = document.getElementById('fish-map');
    if (!el) return;
    loadAmap(init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
