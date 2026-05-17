'use strict';

(function() {
  var typeColors = {
    '水库': { start: '#FF6B6B', end: '#EE5A24' },
    '河流': { start: '#FFB347', end: '#E67E22' },
    '沙坑': { start: '#FF6B9D', end: '#E84393' },
    '溪流': { start: '#4FC3F7', end: '#0984E3' }
  };

  function loadAmap(callback) {
    if (typeof AMap !== 'undefined') {
      callback();
      return;
    }
    window._AMapSecurityConfig = {
      securityJsCode: '8210555c6356b64ebe70c137c6426391'
    };
    var script = document.createElement('script');
    script.src = 'https://webapi.amap.com/maps?v=2.0&key=8d1186c326c9273d8c7a9d5d5256bf42';
    script.onload = callback;
    script.onerror = function() {
      var el = document.getElementById('fish-map');
      if (el) el.innerHTML = '<p style="text-align:center;color:#999;padding:40px;">地图加载失败 🐟</p>';
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

  function init() {
    var container = document.getElementById('fish-map');
    if (!container) return;

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

          var info = new AMap.InfoWindow({
            content:
              '<b>' + spot.name + '</b><br>' +
              '📸 ' + spot.photos + ' 张照片<br>' +
              '🎣 ' + spot.species.join('、') + '<br>' +
              '📅 ' + spot.year + '<br>' +
              '<small>' + spot.desc + '</small>',
            offset: new AMap.Pixel(0, -20),
            size: new AMap.Size(0, 0)
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
