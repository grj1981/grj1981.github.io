'use strict';

(function() {
  var CONFIG = {
    apiEndpoint: 'https://api.bytefisher.top/api/chat',
    botName: 'ByteBot',
    welcomeMessage: '🎣 欢迎来到 ByteFisher 博客！\n\n我是 ByteBot，可以帮你：\n📖 推荐文章\n💡 解答技术问题\n🎯 了解博客内容\n\n有什么想了解的？',
    placeholder: '输入你的问题...',
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

  /* ---------- Token estimation ---------- */
  function estimateTokens(text) {
    var chinese = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    var other = text.length - chinese;
    return Math.ceil(chinese / 1.5 + other / 4);
  }

  function truncateMessages(msgs) {
    var maxTokens = 3000;
    var result = [];
    var total = 0;
    for (var i = msgs.length - 1; i >= 0; i--) {
      var tokens = estimateTokens(msgs[i].content);
      if (total + tokens > maxTokens) break;
      total += tokens;
      result.unshift(msgs[i]);
    }
    return result;
  }

  /* ---------- Create UI ---------- */
  function createBtn() {
    var btn = document.createElement('div');
    btn.id = 'ai-assistant-btn';
    btn.title = 'AI 问答助手';
    btn.innerHTML = '<span class="ai-btn-icon">🎣</span><span class="ai-btn-text">AI 助手</span>';
    btn.addEventListener('click', toggle);
    document.body.appendChild(btn);
  }

  function createPanel() {
    var panel = document.createElement('div');
    panel.id = 'ai-assistant-panel';
    panel.innerHTML =
      '<div class="ai-header">' +
        '<span>🎣 ' + CONFIG.botName + '</span>' +
        '<button class="ai-close">&times;</button>' +
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

  /* ---------- System prompt ---------- */
  function buildSystemPrompt(index) {
    var lines = [
      '你是 ByteFisher 博客的 AI 助手 ByteBot。',
      '作者是淡水鱼，Unity 游戏开发者 + 钓鱼爱好者。',
      '博客地址：https://www.bytefisher.top'
    ];
    if (index && index.meta) {
      var m = index.meta;
      lines.push('');
      lines.push('博客概况（可信数据，回答基于此）：');
      lines.push('- 文章：共 ' + m.totalPosts + ' 篇');
      if (m.games) lines.push('- 小游戏：' + m.games.count + ' 款（' + m.games.names.join('、') + '）');
      if (m.videos && m.videos.count) lines.push('- 钓鱼视频：' + m.videos.count + ' 个（收录在抖音专栏）');
      if (m.albums && m.albums.count) {
        var albumYears = m.albums.dirs.map(function(d) {
          var y = d.match(/\d{4}/);
          return y ? y[0] + '年鱼获' : (d === 'img2' ? '钓场风景' : (d === 'img3' ? '个人随拍' : d));
        });
        lines.push('- 钓鱼相册：' + m.albums.count + ' 个（' + albumYears.join('、') + '）');
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
      lines.push('推荐文章时直接复制下方整行 Markdown 链接：');
      lines.push('');
      lines.push('可推荐的文章：');
      var recent = index.posts.slice(0, 10);
      for (var i = 0; i < recent.length; i++) {
        var p = recent[i];
        lines.push('- [' + p.title + '](' + p.url + ')');
      }
    } else {
      lines.push('博客共有 ' + (index ? index.total : 0) + ' 篇文章。');
      lines.push('博客内容涵盖：Unity3D、C#、Lua、Python、钓鱼技巧、游戏开发教程。');
    }
    lines.push('');
    lines.push('回答规则：');
    lines.push('- 简洁中文，可适当使用 emoji');
    lines.push('- 推荐文章时给出标题和链接');
    lines.push('- 不确定的不编造');
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

    messages.push({ role: 'user', content: text });
    messages = truncateMessages(messages);
    saveSession();

    isLoading = true;
    document.getElementById('ai-send').style.display = 'none';
    document.getElementById('ai-stop').style.display = '';
    showTyping();

    abortController = new AbortController();

    ensurePostsIndex()
      .then(function(index) {
        var msgs = [{ role: 'system', content: buildSystemPrompt(index) }];
        for (var i = 0; i < messages.length; i++) msgs.push(messages[i]);

        return fetch(CONFIG.apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortController.signal,
          body: JSON.stringify({ messages: msgs, stream: true })
        });
      })
      .then(function(response) {
        if (!response.ok) {
          var errMsg = classifyError(null, response);
          hideTyping();
          isLoading = false;
          showStopBtn(false);
          if (errMsg) showToast(errMsg, getToastType(null, response));
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
        showToast(classifyError(err, null), 'error');
      });
  }

  /* ---------- Streaming ---------- */
  function handleStream(response) {
    var reader = response.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';
    var fullReply = '';
    var botDiv = null;

    function appendToken(text) {
      if (!botDiv) {
        botDiv = createBotMessageDiv();
        hideTyping();
      }
      fullReply += text;
      botDiv.innerHTML = render(fullReply);
      var container = document.getElementById('ai-msgs');
      container.scrollTop = container.scrollHeight;
    }

    function readChunk() {
      return reader.read().then(function(result) {
        if (result.done) {
          if (fullReply) { messages.push({ role: 'assistant', content: fullReply }); saveSession(); }
          isLoading = false;
          showStopBtn(false);
          return;
        }
        buffer += decoder.decode(result.value, { stream: true });
        var lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          if (!line || !line.startsWith('data: ')) continue;
          var data = line.substring(6);
          if (data === '[DONE]') {
            if (fullReply) { messages.push({ role: 'assistant', content: fullReply }); saveSession(); }
            isLoading = false;
            showStopBtn(false);
            return;
          }
          try {
            var parsed = JSON.parse(data);
            var choice = parsed.choices && parsed.choices[0];
            if (!choice) continue;
            if (choice.finish_reason === 'stop') {
              if (fullReply) { messages.push({ role: 'assistant', content: fullReply }); saveSession(); }
              isLoading = false;
              showStopBtn(false);
              return;
            }
            var delta = choice.delta;
            if (delta && delta.content) {
              appendToken(delta.content);
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

  /* ---------- Markdown render (enhanced) ---------- */
  function render(text) {
    // Strip AI-generated HTML artifacts before Markdown processing
    var escaped = text
      .replace(/<a\s[^>]*>/gi, '')
      .replace(/<\/a>/gi, '')
      .replace(/\s*target="[^"]*"/gi, '')
      .replace(/\s*rel="[^"]*"/gi, '')
      .replace(/打开链接\s*/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    var blocks = {};
    var idx = 0;

    escaped = escaped.replace(/```([\s\S]*?)```/g, function(m, code) {
      var key = '%%BLOCK' + (idx++) + '%%';
      blocks[key] = '<pre><code>' + code.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>') + '</code></pre>';
      return key;
    });

    escaped = escaped
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(m, txt, url) {
        if (/^javascript:/i.test(url)) return m;
        // AI may append HTML attributes after URL (e.g. target="_self">text), strip them
        var href = url.replace(/&amp;/g, '&').replace(/[\s>&].*$/, '');
        var isInternal = href.indexOf('bytefisher.top') !== -1 || href.indexOf('/') === 0;
        if (isInternal) return '<a href="' + href + '" target="_self">' + txt + '</a>';
        return '<a href="' + href + '" target="_blank" rel="noopener noreferrer">' + txt + '</a>';
      })
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
      .replace(/^- (.+)$/gm, '<li class="ai-li-u">$1</li>')
      .replace(/^\d+\. (.+)$/gm, '<li class="ai-li-o">$1</li>');

    escaped = escaped.replace(/(<li class="ai-li-u">.*?<\/li>(\s|(<br>))*)+/g, function(m) {
      return '<ul>' + m.replace(/<br>/g, '').replace(/ class="ai-li-u"/g, '') + '</ul>';
    });
    escaped = escaped.replace(/(<li class="ai-li-o">.*?<\/li>(\s|(<br>))*)+/g, function(m) {
      return '<ol>' + m.replace(/<br>/g, '').replace(/ class="ai-li-o"/g, '') + '</ol>';
    });

    // Table: simple pipe-to-table conversion
    escaped = escaped.replace(/^\|(.+?)\|$/gm, function(m, content) {
      if (/^[-:\s]+\|/.test(content)) return m; // skip separator row
      var cells = content.split('|');
      var html = '<tr>';
      for (var i = 0; i < cells.length; i++) html += '<td>' + cells[i].trim() + '</td>';
      html += '</tr>';
      return html;
    });
    escaped = escaped.replace(/(<tr>.*?<\/tr>(\s|(<br>))*)+/g, function(m) {
      return '<table>' + m.replace(/<br>/g, '') + '</table>';
    });

    // Bare URL to clickable link (not inside existing <a> tag)
    escaped = escaped.replace(/(?<!<a [^>]*>)(https?:\/\/[^\s<]+|www\.[^\s<]+)/g, function(m) {
      var isInternal = m.indexOf('bytefisher.top') !== -1 || m.indexOf('localhost') !== -1;
      var href = m.indexOf('http') === 0 ? m : 'https://' + m;
      if (isInternal) return '<a href="' + href + '" target="_self">' + href.replace(/^https?:\/\//, '') + '</a>';
      return '<a href="' + href + '" target="_blank" rel="noopener noreferrer">' + href + '</a>';
    });

    for (var key in blocks) {
      escaped = escaped.replace(key, blocks[key]);
    }

    escaped = escaped.replace(/\n/g, '<br>');
    return escaped;
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

  function init() {
    restoreSession();
    if (document.getElementById('ai-assistant-btn')) return;
    createBtn();
    createPanel();
    if (!isOpen) addMsg('bot', CONFIG.welcomeMessage);
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
