// Site statistics powered by the ByteFisher TiDB API.
'use strict';

(function() {
  var API_URL = 'https://api.bytefisher.top/api/site-stats';
  var LOCAL_API_URL = '/api/site-stats-local.json';
  var VISITOR_KEY = 'bytefisher_site_visitor';
  var LAST_STATS_KEY = 'bytefisher_site_stats';
  var TIMEOUT_MS = 4000;
  var RETRIES = 1;
  var CACHE_TTL_MS = 10 * 60 * 1000;
  var REFRESH_INTERVAL_MS = 10 * 60 * 1000;

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

  function isLocalPreview() {
    return location.hostname === 'localhost' ||
      location.hostname === '127.0.0.1' ||
      location.hostname === '[::1]';
  }

  function readLastStats() {
    try {
      var payload = JSON.parse(localStorage.getItem(LAST_STATS_KEY) || '');
      return payload && payload.uv >= 0 && payload.pv >= 0 ? payload : null;
    } catch (err) {
      return null;
    }
  }

  function isCacheFresh() {
    try {
      var payload = JSON.parse(localStorage.getItem(LAST_STATS_KEY) || '');
      return payload && payload.ts && (Date.now() - payload.ts < CACHE_TTL_MS);
    } catch (err) {
      return false;
    }
  }

  function renderStats(data) {
    setText('site_stats_value_uv', formatNumber(data.uv));
    setText('site_stats_value_pv', formatNumber(data.pv));
    try {
      localStorage.setItem(LAST_STATS_KEY, JSON.stringify({
        uv: Number(data.uv),
        pv: Number(data.pv),
        ts: Date.now()
      }));
    } catch (err) {}
  }

  function requestStats(visitor, view, attempt) {
    var requestUrl = API_URL +
      '?visitor=' + encodeURIComponent(visitor) +
      '&view=' + encodeURIComponent(view) +
      '&path=' + encodeURIComponent(location.pathname);
    var controller = window.AbortController ? new AbortController() : null;
    var timer = controller ? setTimeout(function() {
      controller.abort();
    }, TIMEOUT_MS) : null;

    return fetch(requestUrl, {
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
        if (!payload || payload.errno || !payload.data) {
          throw new Error('Invalid stats response');
        }
        renderStats(payload.data);
      })
      .catch(function(error) {
        if (attempt < RETRIES) {
          return new Promise(function(resolve) {
            setTimeout(resolve, 500 * Math.pow(2, attempt));
          }).then(function() {
            return requestStats(visitor, view, attempt + 1);
          });
        }
        throw error;
      })
      .finally(function() {
        if (timer) clearTimeout(timer);
      });
  }

  function loadStats() {
    showContainer('site_stats_container_uv');
    showContainer('site_stats_container_pv');

    var lastStats = readLastStats();
    if (lastStats) renderStats(lastStats);

    if (isCacheFresh()) return;

    var isLocal = isLocalPreview();
    var visitor = getVisitorId();
    var view = randomId();
    requestStats(visitor, view, 0).catch(function(error) {
      console.warn('Site stats unavailable:', error);
      if (!lastStats) setText('site_stats_value_uv', '-');
      if (!lastStats) setText('site_stats_value_pv', '-');
      if (isLocal) {
        fetch(LOCAL_API_URL, { cache: 'no-store' })
          .then(function(res) { return res.json(); })
          .then(function(payload) {
            if (payload && !payload.errno && payload.data) renderStats(payload.data);
          })
          .catch(function() {});
      }
    });
  }

  function bindPjax() {
    if (window.__bytefisherSiteStatsBound) return;
    window.__bytefisherSiteStatsBound = true;
    window.addEventListener('pjax:success', loadStats);
  }

  function startAutoRefresh() {
    if (window.__bytefisherStatsTimer) return;
    window.__bytefisherStatsTimer = setInterval(loadStats, REFRESH_INTERVAL_MS);
  }

  function init() {
    loadStats();
    bindPjax();
    startAutoRefresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
