// Fast footer statistics with a static snapshot and batched visit reporting.
'use strict';

(function() {
  var API_URL = '/api/site-stats';
  var EVENT_URL = '/api/site-stats-event';
  var SNAPSHOT_URL = '/api/site-stats-local.json';
  var VISITOR_KEY = 'bytefisher_site_visitor';
  var LAST_STATS_KEY = 'bytefisher_site_stats';
  var TIMEOUT_MS = 4000;
  var EVENT_TIMEOUT_MS = 10000;
  var CACHE_TTL_MS = 10 * 60 * 1000;
  var REFRESH_INTERVAL_MS = 30 * 60 * 1000;
  var BATCH_SIZE = 5;
  var MAX_BATCH_VIEWS = 20;
  var FLUSH_DELAY_MS = 15000;
  var MAX_PENDING_VIEWS = 50;
  var authoritativeStats = null;
  var pendingPv = 0;
  var pendingUvIncrement = 0;
  var pendingBatch = [];
  var flushTimer = null;
  var flushing = false;
  var fallbackVisitorId = null;

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

    setText('site_stats_value_uv', formatNumber(authoritativeStats.uv + pendingUvIncrement));
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

    return fetch(API_URL, {
      method: 'GET',
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
    return {
      view: randomId(),
      path: location.pathname
    };
  }

  function scheduleFlush() {
    if (flushTimer || flushing || !pendingBatch.length) return;
    flushTimer = setTimeout(function() {
      flushTimer = null;
      flushBatch(false);
    }, FLUSH_DELAY_MS);
  }

  function settleBatch(count, uvCount) {
    pendingPv = Math.max(0, pendingPv - count);
    pendingUvIncrement = Math.max(0, pendingUvIncrement - uvCount);
    renderCurrentStats();
  }

  function requeueBatch(batch, uvCount) {
    pendingBatch = batch.concat(pendingBatch);
    pendingUvIncrement = Math.max(pendingUvIncrement, uvCount);
    if (pendingBatch.length > MAX_PENDING_VIEWS) {
      var overflow = pendingBatch.length - MAX_PENDING_VIEWS;
      pendingBatch = pendingBatch.slice(overflow);
      pendingPv = Math.max(0, pendingPv - overflow);
    }
    renderCurrentStats();
    scheduleFlush();
  }

  function buildBatchBody(batch) {
    return JSON.stringify({
      visitor: getVisitorIdentity().id,
      views: batch.map(function(event) {
        return { view: event.view, path: event.path };
      })
    });
  }

  function flushBatch(useBeacon) {
    if (flushing || !pendingBatch.length) return;

    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }

    var batch = pendingBatch.slice(0, MAX_BATCH_VIEWS);
    var batchUv = pendingUvIncrement;
    var body = buildBatchBody(batch);
    pendingBatch = pendingBatch.slice(MAX_BATCH_VIEWS);

    if (useBeacon && navigator.sendBeacon && window.Blob) {
      try {
        var queued = navigator.sendBeacon(
          EVENT_URL,
          new Blob([body], { type: 'application/json;charset=UTF-8' })
        );
        if (queued) {
          settleBatch(batch.length, batchUv);
          if (pendingBatch.length) flushBatch(true);
          return;
        }
      } catch (error) {}
    }

    flushing = true;
    var flushAgain = false;
    var controller = window.AbortController ? new AbortController() : null;
    var timer = controller ? setTimeout(function() {
      controller.abort();
    }, EVENT_TIMEOUT_MS) : null;

    fetch(EVENT_URL, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json;charset=UTF-8'
      },
      body: body,
      signal: controller ? controller.signal : undefined
    })
      .then(function(res) {
        if (!res.ok) throw new Error('Event HTTP ' + res.status);
        return res.json();
      })
      .then(function(payload) {
        settleBatch(batch.length, batchUv);
        if (payload && !payload.errno && payload.data &&
            payload.data.pv != null && payload.data.uv != null) {
          setAuthoritativeStats(payload.data, true);
        }
        flushAgain = pendingBatch.length >= BATCH_SIZE;
      })
      .catch(function(error) {
        requeueBatch(batch, batchUv);
        console.warn('Site stats event unavailable:', error);
      })
      .finally(function() {
        if (timer) clearTimeout(timer);
        flushing = false;
        if (flushAgain) {
          flushBatch(false);
        } else {
          scheduleFlush();
        }
      });
  }

  function queueVisitEvent() {
    if (isLocalPreview()) return;

    var visitor = getVisitorIdentity();
    if (visitor.isNew) pendingUvIncrement = 1;

    pendingBatch.push(createVisitEvent());
    pendingPv += 1;
    renderCurrentStats();

    if (pendingBatch.length >= BATCH_SIZE) {
      flushBatch(false);
    } else {
      scheduleFlush();
    }
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

    queueVisitEvent();
  }

  function bindPjax() {
    if (window.__bytefisherSiteStatsBound) return;
    window.__bytefisherSiteStatsBound = true;
    window.addEventListener('pjax:success', loadPageStats);
  }

  function bindFlushEvents() {
    window.addEventListener('pagehide', function() {
      flushBatch(true);
    });
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'hidden') flushBatch(true);
    });
  }

  function startAutoRefresh() {
    if (window.__bytefisherStatsTimer) return;
    window.__bytefisherStatsTimer = setInterval(function() {
      if (!isLocalPreview() && pendingPv === 0) refreshStats(true);
    }, REFRESH_INTERVAL_MS);
  }

  function init() {
    loadPageStats();
    bindPjax();
    bindFlushEvents();
    startAutoRefresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
