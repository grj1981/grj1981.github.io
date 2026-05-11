'use strict';

(function() {
  var PI = Math.PI;
  var A = 6378245.0;
  var EE = 0.00669342162296594323;

  function transformLat(x, y) {
    var ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0;
    ret += (160.0 * Math.sin(y / 12.0 * PI) + 320.0 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0;
    return ret;
  }

  function transformLng(x, y) {
    var ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0;
    ret += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0;
    return ret;
  }

  function delta(lat, lng) {
    var dLat = transformLat(lng - 105.0, lat - 35.0);
    var dLng = transformLng(lng - 105.0, lat - 35.0);
    var radLat = lat / 180.0 * PI;
    var magic = Math.sin(radLat);
    magic = 1 - EE * magic * magic;
    var sqrtMagic = Math.sqrt(magic);
    dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI);
    dLng = (dLng * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI);
    return { lat: dLat, lng: dLng };
  }

  function gcj02ToWgs84(lat, lng) {
    var d = delta(lat, lng);
    return { lat: lat - d.lat, lng: lng - d.lng };
  }

  var typeColors = {
    '水库': '#37c6c0',
    '河流': '#6bcb77',
    '沙坑': '#f0a050',
    '溪流': '#4d96ff'
  };

  function init() {
    var container = document.getElementById('fish-map');
    if (!container) return;

    var map = L.map('fish-map');

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://openstreetmap.org">OSM</a>',
      maxZoom: 18
    }).addTo(map);

    fetch('/fish/map/spots.json')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!data.spots || data.spots.length === 0) return;

        data.spots.forEach(function(spot) {
          var wgs = gcj02ToWgs84(spot.lat, spot.lng);
          spot.wgsLat = wgs.lat;
          spot.wgsLng = wgs.lng;
        });

        var topSpot = data.spots.reduce(function(a, b) {
          return a.photos > b.photos ? a : b;
        });
        map.setView([topSpot.wgsLat, topSpot.wgsLng], 12);

        data.spots.forEach(function(spot) {
          var color = typeColors[spot.type] || '#c9c9c9';
          var radius = 8 + spot.photos * 0.4;

          L.circleMarker([spot.wgsLat, spot.wgsLng], {
            radius: Math.min(radius, 24),
            color: color,
            fillColor: color,
            fillOpacity: 0.6,
            weight: 2
          }).addTo(map).bindPopup(
            '<b>' + spot.name + '</b><br>' +
            '📸 ' + spot.photos + ' 张照片<br>' +
            '🎣 ' + spot.species.join('、') + '<br>' +
            '📅 ' + spot.year + '<br>' +
            '<small>' + spot.desc + '</small>'
          );
        });
      })
      .catch(function() {
        container.innerHTML =
          '<p style="text-align:center;color:#999;padding:40px;">地图数据加载失败 🐟</p>';
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
