// Fast footer statistics with a static snapshot and async event reporting.
'use strict';

(function() {
  var API_URL = 'https://api.bytefisher.top/api/site-stats';
  var EVENT_URL = 'https://api.bytefisher.top/api/site-stats-event';
  var SNAPSHOT_URL = '/api/site-stats-local.json';
  var VISITOR_KEY = 'bytefisher_site_visitor';
  var LAST_STATS_KEY = 'bytefisher_site_stats';
  var TIMEOUT_MS = 4000;
  var EVENT_TIMEOUT_MS = 10000;
  var CACHE_TTL_MS = 10 * 60 * 1000;
  var REFRESH_INTERVAL_MS = 10 * 60 * 1000;
  var authoritativeStats = null;
  var pendingPv = 0;
  var pendingUv = 0;
  var fallbackVisitorId = null;
  var eventQueue = Promise.resolve();

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

  function getVisitorIdentity() {
    try {
      var existing = localStorage.getItem(VISITOR_KEY);
      if (existing) {
        return { id: existing, isNew: false };
      }

      var id = randomId();
      localStorage.setItem(VISITOR_KEY, id);
      return { id: id, isNew: true };
    } catch (error) {
      if (!fallbackVisitorId) {
        fallbackVisitorId = randomId();
        return { id: fallbackVisitorId, isNew: true };
      }
      return { id: fallbackVisitorId, isNew: false };
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

  function normalizeStats(data) {
    if (!data || data.uv == null || data.pv == null) return null;
    var uv = Number(data.uv);
    var pv = Number(data.pv);
    if (!Number.isFinite(uv) || !Number.isFinite(pv) || uv < 0 || pv < 0) {
      return null;
    }
    return { uv: uv, pv: pv };
  }

  function renderCurrentStats() {
    if (!authoritativeStats) return;

    setText('site_stats_value_uv', formatNumber(authoritativeStats.uv + pendingUv));
    setText('site_stats_value_pv', formatNumber(authoritativeStats.pv + pendingPv));
  }

  function setAuthoritativeStats(data, persist) {
    var normalized = normalizeStats(data);
    if (!normalized) return;

    if (authoritativeStats) {
      authoritativeStats = {
        uv: Math.max(authoritativeStats.uv, normalized.uv),
        pv: Math.max(authoritativeStats.pv, normalized.pv)
      };
    } else {
      authoritativeStats = normalized;
    }

    renderCurrentStats();

    if (!persist) return;
    try {
      localStorage.setItem(LAST_STATS_KEY, JSON.stringify({
        uv: authoritativeStats.uv,
        pv: authoritativeStats.pv,
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
        if (payload && !payload.errno && payload.data) {
          setAuthoritativeStats(payload.data, true);
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

    var url = force ? API_URL + '?t=' + Date.now() : API_URL;
    return fetch(url, {
      method: 'GET',
      mode: 'cors',
      cache: force ? 'no-store' : 'default',
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
        setAuthoritativeStats(payload.data, true);
      })
      .catch(function(error) {
        console.warn('Live site stats unavailable:', error);
      })
      .finally(function() {
        if (timer) clearTimeout(timer);
      });
  }

  function createVisitEvent() {
    var visitor = getVisitorIdentity();
    return {
      visitor: visitor.id,
      view: randomId(),
      path: location.pathname,
      uvIncrement: visitor.isNew ? 1 : 0
    };
  }

  function getEventBody(event) {
    return new URLSearchParams({
      visitor: event.visitor,
      view: event.view,
      path: event.path
    }).toString();
  }

  function addPendingEvent(event) {
    event.pending = true;
    pendingPv += 1;
    pendingUv += event.uvIncrement;
    renderCurrentStats();
  }

  function settlePendingEvent(event) {
    if (!event.pending) return;
    event.pending = false;
    pendingPv = Math.max(0, pendingPv - 1);
    pendingUv = Math.max(0, pendingUv - event.uvIncrement);
    renderCurrentStats();
  }

  function queueBeacon(event) {
    if (!navigator.sendBeacon || !window.Blob) return false;
    return navigator.sendBeacon(
      EVENT_URL,
      new Blob([getEventBody(event)], {
        type: 'application/x-www-form-urlencoded;charset=UTF-8'
      })
    );
  }

  function sendVisitEvent(event) {
    var controller = window.AbortController ? new AbortController() : null;
    var timer = controller ? setTimeout(function() {
      controller.abort();
    }, EVENT_TIMEOUT_MS) : null;

    return fetch(EVENT_URL, {
      method: 'POST',
      mode: 'cors',
      keepalive: true,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      },
      body: getEventBody(event),
      signal: controller ? controller.signal : undefined
    })
      .then(function(res) {
        if (!res.ok) throw new Error('Event HTTP ' + res.status);
        return res.json();
      })
      .then(function(payload) {
        settlePendingEvent(event);
        if (payload && !payload.errno && payload.data &&
            payload.data.pv != null && payload.data.uv != null) {
          setAuthoritativeStats(payload.data, true);
          return;
        }
        return refreshStats(true);
      })
      .catch(function(error) {
        if (queueBeacon(event)) {
          return new Promise(function(resolve) {
            setTimeout(resolve, 1500);
          }).then(function() {
            return refreshStats(true);
          }).finally(function() {
            settlePendingEvent(event);
          });
        }

        settlePendingEvent(event);
        console.warn('Site stats event unavailable:', error);
        return refreshStats(true);
      })
      .finally(function() {
        if (timer) clearTimeout(timer);
      });
  }

  function postVisitEvent() {
    if (isLocalPreview()) return;

    var event = createVisitEvent();
    addPendingEvent(event);
    eventQueue = eventQueue
      .then(function() {
        return sendVisitEvent(event);
      })
      .catch(function(error) {
        settlePendingEvent(event);
        console.warn('Site stats event queue failed:', error);
      });
  }

  function loadPageStats() {
    showContainer('site_stats_container_uv');
    showContainer('site_stats_container_pv');

    var cached = readLastStats();
    if (cached) {
      setAuthoritativeStats(cached, false);
    } else {
      fetchSnapshot();
    }

    if (isLocalPreview()) {
      refreshStats(false);
    } else {
      postVisitEvent();
    }
  }

  function bindPjax() {
    if (window.__bytefisherSiteStatsBound) return;
    window.__bytefisherSiteStatsBound = true;
    window.addEventListener('pjax:success', loadPageStats);
  }

  function startAutoRefresh() {
    if (window.__bytefisherStatsTimer) return;
    window.__bytefisherStatsTimer = setInterval(function() {
      if (pendingPv === 0) refreshStats(true);
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
