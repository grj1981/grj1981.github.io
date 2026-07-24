// Fast footer statistics with a static snapshot and async event reporting.
'use strict';

(function() {
  var API_URL = 'https://api.bytefisher.top/api/site-stats';
  var EVENT_URL = 'https://api.bytefisher.top/api/site-stats-event';
  var SNAPSHOT_URL = '/api/site-stats-local.json';
  var VISITOR_KEY = 'bytefisher_site_visitor';
  var LAST_STATS_KEY = 'bytefisher_site_stats';
  var TIMEOUT_MS = 4000;
  var CACHE_TTL_MS = 10 * 60 * 1000;
  var REFRESH_INTERVAL_MS = 10 * 60 * 1000;
  var liveStatsRendered = false;

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
    } catch (error) {
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
    } catch (error) {
      return null;
    }
  }

  function isCacheFresh(payload) {
    return !!(payload && payload.ts && (Date.now() - payload.ts < CACHE_TTL_MS));
  }

  function renderStats(data, persist) {
    if (!data || data.uv == null || data.pv == null) return;

    setText('site_stats_value_uv', formatNumber(data.uv));
    setText('site_stats_value_pv', formatNumber(data.pv));

    if (!persist) return;
    try {
      localStorage.setItem(LAST_STATS_KEY, JSON.stringify({
        uv: Number(data.uv),
        pv: Number(data.pv),
        ts: Date.now()
      }));
    } catch (error) {}
  }

  function fetchSnapshot() {
    return fetch(SNAPSHOT_URL, { cache: 'no-cache' })
      .then(function(res) {
        if (!res.ok) throw new Error('Snapshot HTTP ' + res.status);
        return res.json();
      })
      .then(function(payload) {
        if (!liveStatsRendered && payload && !payload.errno && payload.data) {
          renderStats(payload.data, true);
        }
      })
      .catch(function() {});
  }

  function refreshStats(force) {
    var cached = readLastStats();
    if (!force && isCacheFresh(cached)) return Promise.resolve();

    var controller = window.AbortController ? new AbortController() : null;
    var timer = controller ? setTimeout(function() {
      controller.abort();
    }, TIMEOUT_MS) : null;

    return fetch(API_URL, {
      method: 'GET',
      mode: 'cors',
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
        liveStatsRendered = true;
        renderStats(payload.data, true);
      })
      .catch(function(error) {
        console.warn('Live site stats unavailable:', error);
      })
      .finally(function() {
        if (timer) clearTimeout(timer);
      });
  }

  function postVisitEvent() {
    if (isLocalPreview()) return;

    var body = new URLSearchParams({
      visitor: getVisitorId(),
      view: randomId(),
      path: location.pathname
    }).toString();

    if (navigator.sendBeacon && window.Blob) {
      var queued = navigator.sendBeacon(
        EVENT_URL,
        new Blob([body], {
          type: 'application/x-www-form-urlencoded;charset=UTF-8'
        })
      );
      if (queued) return;
    }

    fetch(EVENT_URL, {
      method: 'POST',
      mode: 'cors',
      keepalive: true,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      },
      body: body
    }).catch(function() {});
  }

  function loadPageStats() {
    showContainer('site_stats_container_uv');
    showContainer('site_stats_container_pv');

    var cached = readLastStats();
    if (cached) {
      renderStats(cached, false);
    } else {
      fetchSnapshot();
    }

    postVisitEvent();
    refreshStats(false);
  }

  function bindPjax() {
    if (window.__bytefisherSiteStatsBound) return;
    window.__bytefisherSiteStatsBound = true;
    window.addEventListener('pjax:success', loadPageStats);
  }

  function startAutoRefresh() {
    if (window.__bytefisherStatsTimer) return;
    window.__bytefisherStatsTimer = setInterval(function() {
      refreshStats(true);
    }, REFRESH_INTERVAL_MS);
  }

  function init() {
    loadPageStats();
    bindPjax();
    startAutoRefresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
