'use strict';

(function() {
  var CONFIG = {
    apiEndpoint: 'https://blog-ai-api.vercel.app/api/chat',
    botName: 'ByteBot',
    welcomeMessage: '🎣 欢迎来到 ByteFisher 博客！\n\n我是 ByteBot，可以帮你：\n📖 推荐文章\n💡 解答技术问题\n🎯 了解博客内容\n\n有什么想了解的？',
    placeholder: '输入你的问题...'
  };

  var isOpen = false;
  var isLoading = false;

  function createBtn() {
    var btn = document.createElement('div');
    btn.id = 'ai-assistant-btn';
    btn.innerHTML = '🤖';
    btn.addEventListener('click', toggle);
    document.body.appendChild(btn);
  }

  function createPanel() {
    var panel = document.createElement('div');
    panel.id = 'ai-assistant-panel';
    panel.innerHTML =
      '<div class="ai-header">' +
        '<span>🤖 ' + CONFIG.botName + '</span>' +
        '<button class="ai-close">&times;</button>' +
      '</div>' +
      '<div class="ai-messages" id="ai-msgs"></div>' +
      '<div class="ai-input-area">' +
        '<textarea id="ai-input" rows="1" placeholder="' + CONFIG.placeholder + '"></textarea>' +
        '<button id="ai-send">发送</button>' +
      '</div>';
    document.body.appendChild(panel);

    panel.querySelector('.ai-close').addEventListener('click', toggle);
    document.getElementById('ai-send').addEventListener('click', send);
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

  function toggle() {
    isOpen = !isOpen;
    var panel = document.getElementById('ai-assistant-panel');
    var btn = document.getElementById('ai-assistant-btn');
    panel.classList.toggle('active', isOpen);
    btn.classList.toggle('hidden', isOpen);
    if (isOpen) {
      document.getElementById('ai-input').focus();
    }
  }

  function send() {
    var input = document.getElementById('ai-input');
    var text = input.value.trim();
    if (!text || isLoading) return;
    input.value = '';
    input.style.height = 'auto';
    addMsg('user', text);
    isLoading = true;
    showTyping();

    var system = [
      '你是一个博客助手，帮助访客了解 ByteFisher 博客。',
      '作者是淡水鱼，Unity 游戏开发者 + 钓鱼爱好者。',
      '博客内容涵盖：Unity3D、C#、Lua、Python、钓鱼技巧、游戏开发教程。',
      '博客地址：https://www.bytefisher.top，文章总数 95+ 篇。',
      '',
      '回答规则：',
      '- 简洁中文，可适当使用 emoji',
      '- 不确定的不编造'
    ].join('\n');

    fetch(CONFIG.apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: text }
        ]
      })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      hideTyping();
      isLoading = false;
      var reply = data.choices && data.choices[0] && data.choices[0].message;
      if (reply) {
        addMsg('bot', reply.content);
      } else {
        addMsg('bot', '抱歉没理解，换个问法试试？');
      }
    })
    .catch(function() {
      hideTyping();
      isLoading = false;
      addMsg('bot', '网络开小差了，请稍后重试 🐟');
    });
  }

  function addMsg(role, text) {
    var container = document.getElementById('ai-msgs');
    var div = document.createElement('div');
    div.className = 'ai-message ai-message-' + role;
    div.innerHTML = render(text);
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

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

  function render(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  function autoResizeInput() {
    var input = document.getElementById('ai-input');
    input.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 80) + 'px';
    });
  }

  function init() {
    createBtn();
    createPanel();
    addMsg('bot', CONFIG.welcomeMessage);
    autoResizeInput();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
