// Site statistics fallback for footer counters.
'use strict';

(function() {
  var API_URL = 'https://api.bytefisher.top/api/site-stats';
  var VISITOR_KEY = 'bytefisher_site_visitor';
  var TIMEOUT_MS = 6000;

  function getCounter(id) {
    return document.getElementById(id);
  }

  function showContainer(id) {
    var el = getCounter(id);
    if (el) el.style.display = 'inline';
  }

  function setText(id, value) {
    var el = getCounter(id);
    if (el) el.textContent = value;
  }

  function formatNumber(value) {
    var num = Number(value || 0);
    if (!Number.isFinite(num) || num < 0) return '-';
    return num.toLocaleString();
  }

  function randomId() {
    var bytes = new Uint8Array(16);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(bytes);
      return Array.prototype.map.call(bytes, function(byte) {
        return byte.toString(16).padStart(2, '0');
      }).join('');
    }
    return String(Date.now()) + Math.random().toString(36).slice(2, 18);
  }

  function getVisitorId() {
    try {
      var existing = localStorage.getItem(VISITOR_KEY);
      if (existing) return existing;

      var id = randomId();
      localStorage.setItem(VISITOR_KEY, id);
      return id;
    } catch (err) {
      return randomId();
    }
  }

  function hasBusuanziValue() {
    var uv = getCounter('busuanzi_value_site_uv');
    var pv = getCounter('busuanzi_value_site_pv');
    var uvText = uv ? uv.textContent.trim() : '';
    var pvText = pv ? pv.textContent.trim() : '';
    return !!((uvText && uvText !== '...') || (pvText && pvText !== '...'));
  }

  function hideIfUnavailable() {
    setTimeout(function() {
      if (hasBusuanziValue()) return;

      var uv = getCounter('busuanzi_container_site_uv');
      var pv = getCounter('busuanzi_container_site_pv');
      if (uv) uv.style.display = 'none';
      if (pv) pv.style.display = 'none';
    }, 8000);
  }

  function loadStats() {
    showContainer('busuanzi_container_site_uv');
    showContainer('busuanzi_container_site_pv');

    var controller = window.AbortController ? new AbortController() : null;
    var timer = controller ? setTimeout(function() {
      controller.abort();
    }, TIMEOUT_MS) : null;

    fetch(API_URL + '?visitor=' + encodeURIComponent(getVisitorId()) + '&path=' + encodeURIComponent(location.pathname), {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      signal: controller ? controller.signal : undefined
    })
      .then(function(res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function(payload) {
        if (!payload || payload.errno || !payload.data) throw new Error('Invalid stats response');
        setText('busuanzi_value_site_uv', formatNumber(payload.data.uv));
        setText('busuanzi_value_site_pv', formatNumber(payload.data.pv));
      })
      .catch(function(error) {
        console.warn('Site stats unavailable:', error);
        hideIfUnavailable();
      })
      .finally(function() {
        if (timer) clearTimeout(timer);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadStats);
  } else {
    loadStats();
  }
})();
