'use strict';

(function() {
  var CONFIG = {
    apiEndpoint: 'https://api.bytefisher.top/api/chat',
    botName: 'ByteBot',
    welcomeMessage: '🎣 欢迎来到 ByteFisher 博客！\n\n我是 ByteBot，主要帮你查找和理解本站内容：\n📖 推荐 Unity / C# / AI 编程教程\n🎣 查找钓鱼日记、相册和地图\n🎮 介绍博客里的小游戏\n\n可以问我：博客里有哪些 Unity 入门文章？',
    placeholder: '',
    maxInputLength: 2000,
    maxHistoryTurns: 6,
    debounceInterval: 1000
  };

  var isOpen = false;
  var isLoading = false;
  var postsIndexCache = null;
  var messages = [];
  var lastSentTime = 0;
  var abortController = null;
  var conversationTopic = null;
  var currentArticles = [];
  var lastUserQuestion = '';

  /* ---------- Analytics ---------- */
  function trackEvent(type) {
    try {
      var key = 'ai_stats';
      var stats = JSON.parse(localStorage.getItem(key)) || { opens: 0, sends: 0, errors: 0 };
      if (type === 'open') stats.opens++;
      else if (type === 'send') stats.sends++;
      else if (type === 'error') stats.errors++;
      localStorage.setItem(key, JSON.stringify(stats));
    } catch(e) { /* ignore */ }
  }

  /* ---------- Toast ---------- */
  function showToast(text, type) {
    var panel = document.getElementById('ai-assistant-panel');
    if (!panel) return;
    var old = document.querySelector('.ai-toast');
    if (old) old.remove();
    var t = document.createElement('div');
    t.className = 'ai-toast ai-toast-' + (type || 'error');
    t.textContent = text;
    panel.appendChild(t);
    setTimeout(function() { t.remove(); }, 3000);
  }

  /* ---------- Error classification ---------- */
  function classifyError(err, response) {
    if (err && err.name === 'AbortError') return null;
    if (!response) return '网络连接失败，请检查网络后重试';
    var s = response.status;
    if (s === 429) return '服务忙，请稍后再试 🐟';
    if (s === 504) return '回答超时了，请简化问题后重试';
    if (s === 401 || s === 403) return '服务配置异常，请联系站长';
    if (s >= 500) return '服务暂时不可用，请稍后重试';
    return '抱歉没理解，换个问法试试？';
  }

  function getToastType(err, response) {
    if (!response) return 'error';
    var s = response.status;
    if (s === 429 || s === 504) return 'warning';
    return 'error';
  }

  /* ---------- Retry ---------- */
  function showRetry(text) {
    var container = document.getElementById('ai-msgs');
    if (!container) return;
    var div = document.createElement('div');
    div.className = 'ai-message ai-message-error';
    div.innerHTML = '<p>' + text + '</p><button class="ai-retry-btn" style="margin-top:6px;padding:4px 12px;border:1px solid #e74c3c;border-radius:4px;background:transparent;color:#e74c3c;cursor:pointer">重试</button>';
    div.querySelector('.ai-retry-btn').addEventListener('click', function() {
      div.remove();
      var msgs = messages;
      var lastUserMsg = '';
      for (var i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'user') { lastUserMsg = msgs[i].content; break; }
      }
      if (lastUserMsg) {
        document.getElementById('ai-input').value = lastUserMsg;
        send();
      }
    });
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  /* ---------- Token estimation ---------- */
  function estimateTokens(text) {
    var chinese = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    var other = text.length - chinese;
    return Math.ceil(chinese / 1.5 + other / 4);
  }

  function truncateMessages(msgs) {
    var maxTokens = 3000;
    if (msgs.length <= 4) return msgs;

    // Always keep first user + assistant pair
    var head = msgs.slice(0, 2);
    var tail = msgs.slice(2);

    var result = [];
    var total = head.reduce(function(s, m) { return s + estimateTokens(m.content); }, 0);
    for (var i = tail.length - 1; i >= 0; i--) {
      var t = estimateTokens(tail[i].content);
      if (total + t > maxTokens) break;
      total += t;
      result.unshift(tail[i]);
    }
    return head.concat(result);
  }

  /* ---------- Create UI ---------- */
  function adjustBtnPosition() {
    var btn = document.getElementById('ai-assistant-btn');
    if (!btn) return;
    // Reset to CSS default before each calculation to prevent PJAX cumulative offset
    btn.style.bottom = '';
    btn.style.removeProperty('bottom');
    var btnRect = btn.getBoundingClientRect();
    var fixedEls = document.querySelectorAll('*');
    var maxOverlap = 0;
    for (var i = 0; i < fixedEls.length; i++) {
      var el = fixedEls[i];
      if (el === btn || el.id === 'ai-assistant-panel') continue;
      var style = window.getComputedStyle(el);
      if (style.position !== 'fixed') continue;
      var rect = el.getBoundingClientRect();
      if (rect.bottom > btnRect.top && rect.top < btnRect.bottom &&
          rect.right > btnRect.left && rect.left < btnRect.right) {
        var overlap = Math.min(rect.bottom, btnRect.bottom) - Math.max(rect.top, btnRect.top);
        if (overlap > maxOverlap) maxOverlap = overlap;
      }
    }
    if (maxOverlap > 10) {
      btn.style.bottom = (80 + maxOverlap + 10) + 'px';
    }
  }

  function createBtn() {
    var btn = document.createElement('div');
    btn.id = 'ai-assistant-btn';
    btn.title = 'AI 问答助手';
    btn.innerHTML = '<span class="ai-btn-icon">🎣</span><span class="ai-btn-text">AI 助手</span>';
    btn.addEventListener('click', toggle);
    document.body.appendChild(btn);
    setTimeout(adjustBtnPosition, 100);
    // Remove old listener before adding (prevents PJAX duplicate bindings)
    window.removeEventListener('resize', adjustBtnPosition);
    window.addEventListener('resize', adjustBtnPosition);
    // Reposition after PJAX page navigation
    document.removeEventListener('pjax:complete', adjustBtnPosition);
    document.addEventListener('pjax:complete', adjustBtnPosition);
  }

  function createPanel() {
    var panel = document.createElement('div');
    panel.id = 'ai-assistant-panel';
    panel.innerHTML =
      '<div class="ai-header">' +
        '<span>🎣 ' + CONFIG.botName + '</span>' +
        '<div class="ai-header-actions">' +
          '<button class="ai-clear" title="清空对话">清空</button>' +
          '<button class="ai-close" title="关闭">&times;</button>' +
        '</div>' +
      '</div>' +
      '<div class="ai-messages" id="ai-msgs"></div>' +
      '<div class="ai-input-area">' +
        '<div class="ai-input-wrap">' +
          '<textarea id="ai-input" rows="1" placeholder="' + CONFIG.placeholder + '" maxlength="' + CONFIG.maxInputLength + '"></textarea>' +
          '<div class="ai-input-footer">' +
            '<span class="ai-char-count" id="ai-charcount">0/' + CONFIG.maxInputLength + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="ai-actions">' +
          '<button id="ai-stop" class="ai-stop-btn" style="display:none">停止</button>' +
          '<button id="ai-send">发送</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(panel);

    panel.querySelector('.ai-close').addEventListener('click', toggle);
    panel.querySelector('.ai-clear').addEventListener('click', clearConversation);
    document.getElementById('ai-send').addEventListener('click', send);
    document.getElementById('ai-stop').addEventListener('click', stopGeneration);
    document.getElementById('ai-input').addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && isOpen) toggle();
    });

    // Swipe to close (mobile)
    var touchStartY = 0;
    panel.addEventListener('touchstart', function(e) {
      if (e.target.closest('.ai-input-area') || e.target.closest('.ai-header')) {
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });
    panel.addEventListener('touchmove', function(e) {
      if (!touchStartY) return;
      var dy = e.touches[0].clientY - touchStartY;
      if (dy > 80) {
        touchStartY = 0;
        toggle();
      }
    }, { passive: true });

    // Delegate internal link clicks to PJAX (prevent full page reload)
    document.getElementById('ai-msgs').addEventListener('click', function(e) {
      var link = e.target.closest('a');
      if (!link) return;
      var href = link.getAttribute('href');
      if (!href || href.indexOf('javascript:') === 0) return;
      if (link.getAttribute('target') === '_blank') return;
      var isInternal = href.indexOf('/') === 0 || href.indexOf('bytefisher.top') !== -1;
      if (!isInternal) return;
      e.preventDefault();
      if (window.pjax && typeof window.pjax.loadUrl === 'function') {
        window.pjax.loadUrl(href);
      } else {
        location.href = href;
      }
    });
  }

  /* ---------- Toggle ---------- */
  function toggle() {
    isOpen = !isOpen;
    var panel = document.getElementById('ai-assistant-panel');
    var btn = document.getElementById('ai-assistant-btn');
    panel.classList.toggle('active', isOpen);
    btn.classList.toggle('hidden', isOpen);
    if (isOpen) {
      document.getElementById('ai-input').focus();
      ensurePostsIndex();
      trackEvent('open');
    }
  }

  /* ---------- Posts index ---------- */
  function ensurePostsIndex() {
    if (postsIndexCache) return Promise.resolve(postsIndexCache);
    return fetch('/api/posts-index.json')
      .then(function(r) { return r.json(); })
      .then(function(d) { postsIndexCache = d; return d; })
      .catch(function() { return null; });
  }

  /* ---------- RAG: Article ranking (BM25) ---------- */
  function getArticleSearchText(post) {
    return [
      post.title || '',
      post.textForSearch || '',
      post.summary || '',
      post.excerpt || ''
    ].join(' ').toLowerCase();
  }

  function rankArticles(question, posts) {
    if (!question || !posts || !posts.length) return [];
    var qTokens = question.toLowerCase().split(/[\s,，。.、！？;；：:()（）\[\]【】]+/).filter(function(w) { return w.length > 1; });
    if (qTokens.length === 0) return posts.slice(0, 10);

    var N = posts.length;
    var k1 = 1.5, b = 0.75;
    var totalLen = 0;
    for (var i = 0; i < posts.length; i++) totalLen += getArticleSearchText(posts[i]).length;
    var avgDocLen = totalLen / N || 1;

    // Document frequency
    var df = {};
    for (var ti = 0; ti < qTokens.length; ti++) {
      var w = qTokens[ti];
      if (df[w] !== undefined) continue;
      var count = 0;
      for (var pi = 0; pi < posts.length; pi++) {
        if (getArticleSearchText(posts[pi]).indexOf(w) !== -1) count++;
      }
      df[w] = count;
    }

    // IDF
    var idf = {};
    for (var w in df) {
      idf[w] = Math.log((N - df[w] + 0.5) / (df[w] + 0.5) + 1);
    }

    var now = Date.now();
    var scored = [];
    for (var pi = 0; pi < posts.length; pi++) {
      var text = getArticleSearchText(posts[pi]);
      var docLen = text.length || 1;
      var score = 0;
      for (var ti = 0; ti < qTokens.length; ti++) {
        var w = qTokens[ti];
        if (!idf[w]) continue;
        // Term frequency in this doc
        var tf = 0, idx = 0;
        while ((idx = text.indexOf(w, idx)) !== -1) { tf++; idx += w.length; }
        score += idf[w] * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * docLen / avgDocLen));
      }
      // Recency boost
      if (posts[pi].date) {
        var days = (now - new Date(posts[pi].date).getTime()) / 86400000;
        if (days < 30) score *= 1.3;
        else if (days < 60) score *= 1.15;
      }
      scored.push({ post: posts[pi], score: score });
    }

    scored.sort(function(a, b) { return b.score - a.score; });

    // Series dedup: max 2 per series
    var seriesCount = {}, result = [];
    for (var i = 0; i < scored.length && result.length < 10; i++) {
      var s = scored[i].post.series;
      if (s) {
        seriesCount[s] = (seriesCount[s] || 0) + 1;
        if (seriesCount[s] > 2) continue;
      }
      result.push(scored[i].post);
    }
    return result.length > 0 ? result : posts.slice(0, 10);
  }

  function showFallbackRecommendations(question) {
    if (!postsIndexCache || !postsIndexCache.posts || !postsIndexCache.posts.length) return false;
    var articles = rankArticles(question, postsIndexCache.posts).slice(0, 5);
    if (!articles.length) return false;

    var lines = [
      'AI 服务暂时不可用，先为你匹配到这些站内内容：',
      ''
    ];
    for (var i = 0; i < articles.length; i++) {
      var p = articles[i];
      var url = (p.url || '').replace(/^https?:\/\/[^\/]+/, '') || '/';
      lines.push('- [' + p.title.replace(/\]/g, '\\]') + '](' + url + ')');
    }
    addMsg('bot', lines.join('\n'));
    return true;
  }

  /* ---------- System prompt ---------- */
  function buildSystemPrompt(index, topArticles, isNewTopic) {
    if (!isNewTopic && conversationTopic) {
      return '你是 ByteBot。继续当前话题回答，推荐文章时使用 Markdown 链接格式 `- [标题](URL)`。';
    }
    var lines = [
      '你是 ByteFisher 博客的 AI 助手 ByteBot。',
      '作者是淡水鱼，Unity 游戏开发者 + 钓鱼爱好者。',
      '博客地址：https://www.bytefisher.top'
    ];
    if (index && index.meta) {
      var m = index.meta;
      lines.push('');
      lines.push('博客概况（回答基于此数据，但构建时生成可能滞后，若与页面显示有出入，以归档页/侧边栏为准）：');
      lines.push('- 文章：共 ' + m.totalPosts + ' 篇');
      if (m.games) lines.push('- 小游戏：' + m.games.count + ' 款（' + m.games.names.join('、') + '）');
      if (m.videos && m.videos.count) lines.push('- 钓鱼视频：' + m.videos.count + ' 个（收录在[抖音专栏](/douyin/)）');
      if (m.albums && m.albums.count) {
        var albumLinks = m.albums.dirs.map(function(d) {
          var y = d.match(/\d{4}/);
          var label = y ? y[0] + '年鱼获' : (d === 'img2' ? '钓场风景' : (d === 'img3' ? '个人随拍' : d));
          return '[' + label + '](/fish/' + d + '/)';
        });
        lines.push('- 钓鱼相册：' + m.albums.count + ' 个（' + albumLinks.join('、') + '）');
      }
      if (m.fishing) {
        var f = m.fishing;
        lines.push('- 钓鱼钓点：' + f.spotsCount + ' 个（含' + (f.spotTypes ? Object.keys(f.spotTypes).join('、') : '多种') + '类型）');
        if (f.bestSpots && f.bestSpots.length) lines.push('  热门钓点：' + f.bestSpots.join('、'));
        if (f.species) {
          var sp = Object.keys(f.species).filter(function(k) { return f.species[k] > 0; }).slice(0, 6);
          if (sp.length) lines.push('- 主要鱼种：' + sp.join('、') + ' 等');
        }
      }
      lines.push('');
      if (m.seriesSummary && m.seriesSummary.length) {
        lines.push('博客教程系列（只能从以下列表中推荐，不要编造不存在的系列）：');
        for (var si = 0; si < m.seriesSummary.length; si++) {
          var ss = m.seriesSummary[si];
          var seriesUrl = ss.slug ? '/tags/' + encodeURIComponent(ss.slug) + '/' : ('/tutorials/#' + ss.name);
          lines.push('- [' + ss.name + '](' + seriesUrl + ')：' + ss.count + ' 篇，' + ss.difficulty + '，' + ss.status + '）');
        }
      }
      lines.push('');
      lines.push('博客功能页面（复制这些 Markdown 链接推荐给用户）：');
      lines.push('- [游戏合集](/ai-games/)：' + m.games.count + ' 款小游戏');
      lines.push('- [抖音专栏](/douyin/)：' + m.videos.count + ' 个钓鱼视频');
      lines.push('- [钓鱼相册](/fish/)：' + m.albums.count + ' 个相册');
      lines.push('- [钓鱼地图](/fish/map/)：' + m.fishing.spotsCount + ' 个钓点');
      lines.push('- [教程系列](/tutorials/)');
      lines.push('- [关于博主](/about/)');
      lines.push('- [留言互动](/guestbook/)');
      lines.push('');
      lines.push('（仅当用户明确询问博客内容或寻找文章时，才从下方列表推荐文章，否则忽略此列表）');
      lines.push('');
      lines.push('文章列表（仅限以下列表，严禁编造）：');
      var articles = topArticles && topArticles.length ? topArticles : index.posts.slice(0, 10);
      for (var i = 0; i < articles.length; i++) {
        var p = articles[i];
        lines.push('- [' + p.title.replace(/\]/g, '\\]') + '](' + p.url + ')');
        if (p.series) lines.push('  系列：' + p.series);
        if (i < 3 && p.summary) lines.push('  摘要：' + p.summary.substring(0, 150));
      }
    } else {
      lines.push('博客共有 ' + (index ? index.total : 0) + ' 篇文章。');
      lines.push('博客内容涵盖：Unity3D、C#、Lua、Python、钓鱼技巧、游戏开发教程。');
    }
    lines.push('');
    lines.push('回答规则：');
    lines.push('- 用 `##` 小标题 + `---` 分隔线 + `-` 无序列表 + `**加粗**` 组织回答');
    lines.push('- 推荐链接格式 `- [原文标题](URL)`，严禁只写标题不加链接');
    lines.push('- 优先推荐系列对应文章，说明是第几篇；章节名放在 `](URL)` 后说明');
    lines.push('- **日常问候、闲聊无需推荐文章**，直接回答即可');
    lines.push('');
    lines.push('⚠️ **重要规则**：');
    lines.push('- **严禁编造不存在的文章标题或 URL**');
    lines.push('- 如果实在找不到相关内容，如实说"博客目前还没有这方面的文章"');
    lines.push('- **不要为了推荐而推荐**，用户没问文章就不要提文章链接');
    return lines.join('\n');
  }

  /* ---------- Send ---------- */
  function send() {
    var input = document.getElementById('ai-input');
    var text = input.value.trim();
    if (!text || isLoading) return;

    var now = Date.now();
    if (now - lastSentTime < CONFIG.debounceInterval) return;
    lastSentTime = now;

    input.value = '';
    input.style.height = 'auto';
    updateCharCount();
    addMsg('user', text);
    lastUserQuestion = text;

    messages.push({ role: 'user', content: text });
    messages = truncateMessages(messages);
    saveSession();
    trackEvent('send');

    isLoading = true;
    document.getElementById('ai-send').style.display = 'none';
    document.getElementById('ai-stop').style.display = '';
    showTyping();

    abortController = new AbortController();
    ensurePostsIndex();

    fetch(CONFIG.apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: abortController.signal,
      body: JSON.stringify({ messages: messages, stream: true })
    })
      .then(function(response) {
        if (!response.ok) {
          var errMsg = classifyError(null, response);
          hideTyping();
          isLoading = false;
          showStopBtn(false);
          if (errMsg) showToast(errMsg, getToastType(null, response));
          showFallbackRecommendations(text);
          return null;
        }
        var contentType = response.headers.get('Content-Type') || '';
        if (contentType.indexOf('text/event-stream') === -1) {
          return response.json().then(function(data) {
            hideTyping();
            isLoading = false;
            showStopBtn(false);
            var reply = data.choices && data.choices[0] && data.choices[0].message;
            if (reply) {
              addMsg('bot', reply.content);
              messages.push({ role: 'assistant', content: reply.content });
              saveSession();
            }
          });
        }
        return handleStream(response);
      })
      .catch(function(err) {
        hideTyping();
        isLoading = false;
        showStopBtn(false);
        if (err.name === 'AbortError') return;
        trackEvent('error');
        if (!showFallbackRecommendations(text)) {
          showRetry(classifyError(err, null));
        }
      });
  }

  /* ---------- Streaming ---------- */
  function handleStream(response) {
    var reader = response.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';
    var fullReply = '';
    var botDiv = null;
    var pending = '';
    var rafId = null;

    function flush() {
      rafId = null;
      if (!botDiv) {
        botDiv = createBotMessageDiv();
        hideTyping();
      }
      fullReply += pending;
      pending = '';
      botDiv.innerHTML = render(fullReply);
      var container = document.getElementById('ai-msgs');
      container.scrollTop = container.scrollHeight;
    }

    function queue(text) {
      pending += text;
      if (rafId === null) {
        rafId = requestAnimationFrame(flush);
      }
    }

    function endStream() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (pending || fullReply) flush();
      if (fullReply) { messages.push({ role: 'assistant', content: fullReply }); saveSession(); }
      isLoading = false;
      showStopBtn(false);
    }

    function failStream(message) {
      hideTyping();
      isLoading = false;
      showStopBtn(false);
      trackEvent('error');
      if (!showFallbackRecommendations(lastUserQuestion)) {
        showRetry(message || '服务暂时不可用，请稍后重试');
      }
    }

    function readChunk() {
      return reader.read().then(function(result) {
        if (result.done) { endStream(); return; }
        buffer += decoder.decode(result.value, { stream: true });
        var lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          if (!line || !line.startsWith('data: ')) continue;
          var data = line.substring(6);
          if (data === '[DONE]') { endStream(); return; }
          try {
            var parsed = JSON.parse(data);
            if (parsed.error) {
              failStream(parsed.error.message);
              return;
            }
            var choice = parsed.choices && parsed.choices[0];
            if (!choice) continue;
            if (choice.finish_reason === 'stop') { endStream(); return; }
            var delta = choice.delta;
            if (delta && delta.content) {
              queue(delta.content);
            }
          } catch(e) { /* skip malformed chunk */ }
        }
        return readChunk();
      });
    }

    return readChunk();
  }

  function createBotMessageDiv() {
    var container = document.getElementById('ai-msgs');
    var div = document.createElement('div');
    div.className = 'ai-message ai-message-bot';
    container.appendChild(div);
    return div;
  }

  /* ---------- Stop generation ---------- */
  function stopGeneration() {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    isLoading = false;
    hideTyping();
    showStopBtn(false);
  }

  function clearConversation() {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    messages = [];
    conversationTopic = null;
    currentArticles = [];
    lastUserQuestion = '';
    isLoading = false;
    hideTyping();
    showStopBtn(false);
    try {
      sessionStorage.removeItem('ai_messages');
      sessionStorage.setItem('ai_open', isOpen ? '1' : '0');
    } catch(e) { /* ignore */ }
    var container = document.getElementById('ai-msgs');
    if (container) container.innerHTML = '';
    addMsg('bot', CONFIG.welcomeMessage);
  }

  function showStopBtn(show) {
    document.getElementById('ai-send').style.display = show ? 'none' : '';
    document.getElementById('ai-stop').style.display = show ? '' : 'none';
  }

  /* ---------- Message ---------- */
  function addMsg(role, text) {
    var container = document.getElementById('ai-msgs');
    var div = document.createElement('div');
    div.className = 'ai-message ai-message-' + role;
    div.innerHTML = render(text);
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  /* ---------- Typing ---------- */
  function showTyping() {
    var container = document.getElementById('ai-msgs');
    var div = document.createElement('div');
    div.className = 'ai-message ai-message-bot ai-message-typing';
    div.id = 'ai-typing';
    div.innerHTML = '<span></span><span></span><span></span>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function hideTyping() {
    var el = document.getElementById('ai-typing');
    if (el) el.remove();
  }

  /* ---------- Markdown render (marked + DOMPurify) ---------- */
  if (typeof marked !== 'undefined') {
    marked.use({
      renderer: {
        heading: function(text, level) {
          var tag = level <= 2 ? 'h3' : 'h4';
          return '<' + tag + '>' + text + '</' + tag + '>';
        },
        link: function(href, title, text) {
          if (href.indexOf('bytefisher.top') !== -1) {
            href = href.replace(/^https?:\/\/[^\/]+/, '') || '/';
          }
          var isInternal = href.indexOf('/') === 0;
          return '<a href="' + href + '"' + (isInternal ? '' : ' target="_blank" rel="noopener noreferrer"') + '>' + text + '</a>';
        }
      },
      gfm: true,
      breaks: true
    });
  }

  function preLinkArticles(text) {
    if (!postsIndexCache || !postsIndexCache.posts) return text;

    function norm(s) {
      return s.replace(/\s/g, '')
              .replace(/[－—–―]/g, '-')
              .replace(/[：:]/g, ':')
              .replace(/[；;]/g, ';')
              .replace(/[，,]/g, ',')
              .replace(/[。.]/g, '.')
              .replace(/[（(]/g, '(')
              .replace(/[）)]/g, ')')
              .replace(/[／/]/g, '/')
              .replace(/[’']/g, "'")
              .replace(/[“”]/g, '"')
              .replace(/[Ａ-Ｚ]/g, function(c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
              .replace(/[ａ-ｚ]/g, function(c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
              .replace(/[０-９]/g, function(c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
              .replace(/[＃]/g, '#');
    }

    var sorted = postsIndexCache.posts.slice().sort(function(a, b) { return b.title.length - a.title.length; });
    var lines = text.split('\n');
    for (var li = 0; li < lines.length; li++) {
      var line = lines[li].trim();
      if (!line || line.indexOf('[') === 0) continue;
      var normLine = norm(line);
      for (var pi = 0; pi < sorted.length; pi++) {
        var title = sorted[pi].title;
        var normTitle = norm(title);
        if (normLine === normTitle || normLine.indexOf(normTitle) === 0) {
          var rest = line.substring(title.length);
          var url = sorted[pi].url.replace(/^https?:\/\/[^\/]+/, '');
          lines[li] = '[' + title + '](' + url + ')' + rest;
          break;
        }
      }
    }

    return lines.join('\n');
  }

  /* ---------- URL validation ---------- */
  function validateLinks(text, index) {
    if (!index || !index.posts || !index.posts.length) return text;

    var articleUrls = {};
    for (var i = 0; i < index.posts.length; i++) {
      var relUrl = index.posts[i].url.replace(/^https?:\/\/[^\/]+/, '');
      articleUrls[relUrl] = index.posts[i].title;
    }

    var pathPrefixes = [
      '/fish/', '/ai-games/', '/douyin/',
      '/about/', '/guestbook/', '/tutorials/', '/program/',
      '/tags/', '/categories/', '/archives/',
      '/page/', '/images/', '/css/', '/js/', '/lib/',
      '/search.xml', '/atom.xml', '/sitemap.xml',
      '/sitemap_images.xml', '/api/'
    ];

    return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(match, linkText, url) {
      var relUrl = url.replace(/^https?:\/\/[^\/]+/, '');

      // External URL → pass through
      if (url.indexOf('://') !== -1 && url.indexOf('bytefisher.top') === -1) return match;

      // Known article URL → pass
      if (articleUrls[relUrl]) return match;

      // Matches a known path prefix → pass (tags, categories, albums, etc.)
      for (var p = 0; p < pathPrefixes.length; p++) {
        if (relUrl.indexOf(pathPrefixes[p]) === 0) return match;
      }

      // Root path
      if (relUrl === '/' || relUrl === '') return match;

      // Try to match link text to article title → auto-correct URL
      for (var i = 0; i < index.posts.length; i++) {
        if (index.posts[i].title === linkText) {
          return '[' + linkText + '](' + index.posts[i].url.replace(/^https?:\/\/[^\/]+/, '') + ')';
        }
      }
      // Partial title match → auto-correct (only if lengths are close)
      for (var i = 0; i < index.posts.length; i++) {
        var title = index.posts[i].title;
        if (Math.abs(title.length - linkText.length) <= 4 && (title.indexOf(linkText) !== -1 || linkText.indexOf(title) !== -1)) {
          return '[' + linkText + '](' + index.posts[i].url.replace(/^https?:\/\/[^\/]+/, '') + ')';
        }
      }

      // Cannot fix — strip link, keep plain text
      return linkText;
    });
  }

  function render(text) {
    text = preLinkArticles(text);
    text = validateLinks(text, postsIndexCache);
    if (typeof marked === 'undefined') {
      return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    var html = marked.parse(text);
    if (typeof DOMPurify !== 'undefined') {
      html = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['h3', 'h4', 'p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'code', 'pre', 'a', 'ul', 'ol', 'li', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
        ALLOWED_ATTR: ['href', 'target', 'rel']
      });
    }
    return html;
  }

  /* ---------- Input ---------- */
  function autoResizeInput() {
    var input = document.getElementById('ai-input');
    input.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 80) + 'px';
      updateCharCount();
    });
  }

  function updateCharCount() {
    var input = document.getElementById('ai-input');
    var count = document.getElementById('ai-charcount');
    var len = input.value.length;
    count.textContent = len + '/' + CONFIG.maxInputLength;
    count.style.color = len > CONFIG.maxInputLength * 0.9 ? '#e74c3c' : (len > CONFIG.maxInputLength ? '#e74c3c' : '#999');
  }

  /* ---------- Mobile keyboard ---------- */
  function handleMobileKeyboard() {
    if ('visualViewport' in window) {
      var panel = document.getElementById('ai-assistant-panel');
      window.visualViewport.addEventListener('resize', function() {
        var diff = window.innerHeight - window.visualViewport.height;
        if (diff > 100) {
          panel.style.bottom = (diff + 10) + 'px';
          panel.style.maxHeight = 'calc(100vh - ' + (diff + 60) + 'px)';
        } else {
          panel.style.bottom = '';
          panel.style.maxHeight = '';
        }
      });
    }
  }

  /* ---------- Init ---------- */
  function restoreSession() {
    try {
      var saved = sessionStorage.getItem('ai_messages');
      if (saved) messages = JSON.parse(saved);
    } catch(e) { /* ignore */ }
    if (sessionStorage.getItem('ai_open') === '1') {
      isOpen = true;
    }
  }

  function saveSession() {
    try {
      sessionStorage.setItem('ai_messages', JSON.stringify(messages));
      sessionStorage.setItem('ai_open', isOpen ? '1' : '0');
    } catch(e) { /* ignore */ }
  }

  function restoreMessagesToDOM() {
    var container = document.getElementById('ai-msgs');
    if (!container) return;
    for (var i = 0; i < messages.length; i++) {
      var m = messages[i];
      addMsg(m.role, m.content);
    }
  }

  function init() {
    restoreSession();
    if (document.getElementById('ai-assistant-btn')) return;
    createBtn();
    createPanel();
    if (!isOpen) {
      addMsg('bot', CONFIG.welcomeMessage);
    } else if (messages.length > 0) {
      restoreMessagesToDOM();
    }
    if (isOpen) {
      var btn = document.getElementById('ai-assistant-btn');
      var panel = document.getElementById('ai-assistant-panel');
      btn.classList.add('hidden');
      panel.classList.add('active');
      ensurePostsIndex();
    }
    autoResizeInput();
    updateCharCount();
    handleMobileKeyboard();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
