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

  /* ---------- RAG: Keyword extraction ---------- */
  var TECH_KEYWORDS = ['unity', 'c#', 'lua', 'python', 'csharp', 'c井', 'javascript', 'hexo', '博客', '游戏', '钓鱼', '教程', '学习', '笔记', '委托', 'delegate', '事件', 'event', '接口', '类', '对象', '继承', '多态', '数组', '字符串', '异步', 'async', 'await', '协程', '线程', '性能', '优化', '动画', '物理', '碰撞', '相机', '场景', 'ui', '导航', '寻路', '粒子', '序列化', '网络', '加密', 'linq', '泛型', '反射', '特性', '依赖', '注入', '设计模式', '函数式', '编译器', 'roslyn', 'sourcegen', '互操作', '延迟', 'ai', 'deepseek', 'opencode', 'qwen', 'ollama', 'rag', 'docker', 'vercel', 'cloudflare', 'turso', 'waline', 'tidb', 'leancloud', 'seo', 'pwa', 'webp', 'cdn', 'pjax', 'rss', 'sitemap', '图床', '评论', '抖音', '微信', 'github', '域名', '重定向', '多项目', '场景', '管理器', '组件', '预制体', '协程', '动画', '音频', '持久化', '对象池', '导航网格', '粒子特效', '构建发布', 'ecs', 'job', 'burst', 'shader', 'urp', '渲染', '后处理', 'bloom', '体积光', '状态机', '行为树', 'netcode', '多人', '输入', '重绑定', '键盘', '手柄', 'profiler', 'gc', '内存', 'addressables', '资源管理', 'lod', '遮挡剔除', '单例', '单例模式', '事件总线', '命令模式', '依赖注入', 'scriptableobject', 'unirx', 'unitask', 'vcontainer', 'zenject', '编辑器', 'inspector', 'propertydrawer', '工具'];

  function extractKeywords(text) {
    if (!text) return [];
    var cleaned = text.replace(/[的了吗是和我有在就了也吗啊呢吧呗给被把让向从对于关于]|[，。！？、；：""''（）【】《》\s,.!?;:'"()\[\]{}<>]/g, ' ');
    var words = cleaned.split(/\s+/).filter(function(w) { return w.length > 1; });
    var unique = {};
    for (var i = 0; i < words.length; i++) unique[words[i].toLowerCase()] = true;
    for (var t = 0; t < TECH_KEYWORDS.length; t++) {
      if (text.toLowerCase().indexOf(TECH_KEYWORDS[t]) !== -1) unique[TECH_KEYWORDS[t]] = true;
    }
    return Object.keys(unique);
  }

  function rankArticles(question, posts) {
    if (!question || !posts || !posts.length) return [];
    var keywords = extractKeywords(question);
    if (keywords.length === 0) return posts.slice(0, 5);
    var scored = posts.map(function(post) {
      var score = 0;
      var title = (post.title || '').toLowerCase();
      var excerpt = (post.excerpt || '').toLowerCase();
      var tags = (post.tags || []).join(' ').toLowerCase();
      var cats = (post.categories || []).join(' ').toLowerCase();
      var headings = (post.headings || []).join(' ').toLowerCase();
      var postKeywords = (post.keywords || []).join(' ').toLowerCase();
      for (var i = 0; i < keywords.length; i++) {
        var kw = keywords[i].toLowerCase();
        if (title.indexOf(kw) !== -1) score += 3;
        else if (headings.indexOf(kw) !== -1) score += 2;
        else if (tags.indexOf(kw) !== -1) score += 2;
        else if (postKeywords.indexOf(kw) !== -1) score += 1;
        else if (excerpt.indexOf(kw) !== -1) score += 1;
        else if (cats.indexOf(kw) !== -1) score += 1;
      }
      return { post: post, score: score };
    });
    scored.sort(function(a, b) { return b.score - a.score; });
    var matched = scored.filter(function(s) { return s.score > 0; }).slice(0, 5).map(function(s) { return s.post; });
    return matched.length > 0 ? matched : posts.slice(0, 5);
  }

  /* ---------- System prompt ---------- */
  function buildSystemPrompt(index, topArticles) {
    var lines = [
      '你是 ByteFisher 博客的 AI 助手 ByteBot。',
      '作者是淡水鱼，Unity 游戏开发者 + 钓鱼爱好者。',
      '博客地址：https://www.bytefisher.top'
    ];
    if (index && index.meta) {
      var m = index.meta;
      lines.push('');
      lines.push('博客概况（可信数据，回答基于此，推荐页面时复制 Markdown 链接）：');
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
      lines.push('推荐文章时直接复制下方整行 Markdown 链接：');
      lines.push('');
      lines.push('可推荐的文章（与用户问题相关）：');
      var articles = topArticles && topArticles.length ? topArticles : index.posts.slice(0, 5);
      for (var i = 0; i < articles.length; i++) {
        var p = articles[i];
        lines.push('- [' + p.title.replace(/\]/g, '\\]') + '](' + p.url + ')');
        if (p.series) {
          lines.push('  所属系列：' + p.series);
        }
        if (p.headings && p.headings.length) {
          lines.push('  包含章节：' + p.headings.join('、'));
        }
      }
    } else {
      lines.push('博客共有 ' + (index ? index.total : 0) + ' 篇文章。');
      lines.push('博客内容涵盖：Unity3D、C#、Lua、Python、钓鱼技巧、游戏开发教程。');
    }
    lines.push('');
    lines.push('回答格式要求（重要）：');
    lines.push('- 用 `## 小标题` 分隔不同板块，让回答有层次感');
    lines.push('- 用 `---` 分隔不同的功能或分类模块');
    lines.push('- 用 `- ` 无序列表罗列条目，不要挤成段落');
    lines.push('- 突出内容用 `**加粗**`');
    lines.push('');
    lines.push('内容规则：');
    lines.push('- 简洁中文，可适当使用 emoji');
    lines.push('- 推荐文章/页面/相册时，**必须**使用 Markdown 链接格式 `- [标题](URL)`，将此行原样复制到回复中');
    lines.push('- **严禁**只写纯文本标题而不带链接，用户必须能点击访问');
    lines.push('- 如果用户问某个系列的某个知识点，优先推荐该系列文章，并说明是第几篇');
    lines.push('- 如果文章有章节信息，可以告诉用户相关内容在哪个章节');
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
    trackEvent('send');

    isLoading = true;
    document.getElementById('ai-send').style.display = 'none';
    document.getElementById('ai-stop').style.display = '';
    showTyping();

    abortController = new AbortController();

    ensurePostsIndex()
      .then(function(index) {
        var topArticles = rankArticles(text, index.posts);
        var msgs = [{ role: 'system', content: buildSystemPrompt(index, topArticles) }];
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
        trackEvent('error');
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
      flush();
      if (fullReply) { messages.push({ role: 'assistant', content: fullReply }); saveSession(); }
      isLoading = false;
      showStopBtn(false);
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
    var sorted = postsIndexCache.posts.slice().sort(function(a, b) { return b.title.length - a.title.length; });
    var lines = text.split('\n');
    for (var li = 0; li < lines.length; li++) {
      var line = lines[li].trim();
      if (!line || line.indexOf('[') === 0) continue;
      var normLine = line.replace(/\s/g, '');
      for (var pi = 0; pi < sorted.length; pi++) {
        var title = sorted[pi].title;
        var normTitle = title.replace(/\s/g, '');
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

  function render(text) {
    text = preLinkArticles(text);
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
