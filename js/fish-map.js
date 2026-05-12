'use strict';

(function() {
  var typeColors = {
    '水库': '#37c6c0',
    '河流': '#6bcb77',
    '沙坑': '#f0a050',
    '溪流': '#4d96ff'
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
          var color = typeColors[spot.type] || '#c9c9c9';
          var radius = 8 + spot.photos * 0.4;
          radius = Math.min(radius, 24);

          var marker = new AMap.CircleMarker({
            center: [spot.lng, spot.lat],
            radius: radius,
            fillColor: color,
            fillOpacity: 0.6,
            strokeColor: '#fff',
            strokeWeight: 2,
            zIndex: 10
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
            info.open(map, marker.getCenter());
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
