'use strict';

(function() {
  function initHeroTyping() {
    var el = document.getElementById('hero-typing');
    if (!el) return;
    var texts = ['编程世界', '数字乐园', '钓鱼天地', '技术博客'];
    var textIndex = 0;
    var charIndex = 0;
    var isDeleting = false;

    function type() {
      var current = texts[textIndex];
      if (isDeleting) {
        el.textContent = current.substring(0, charIndex--);
      } else {
        el.textContent = current.substring(0, charIndex++);
      }
      if (!isDeleting && charIndex === current.length) {
        setTimeout(function() { isDeleting = true; }, 2000);
      } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        textIndex = (textIndex + 1) % texts.length;
      }
      setTimeout(type, isDeleting ? 50 : 100);
    }
    type();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeroTyping);
  } else {
    initHeroTyping();
  }

  document.addEventListener('pjax:success', initHeroTyping);
})();
