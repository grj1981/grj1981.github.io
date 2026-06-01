'use strict';

(function() {
  var btn = document.getElementById('darkmode-toggle');
  if (!btn) return;

  if (localStorage.getItem('blog-darkmode') === '1') {
    document.body.classList.add('dark-mode');
    btn.classList.add('on');
  }

  if (document.body.classList.contains('dark-mode')) btn.classList.add('on');

  btn.addEventListener('click', function() {
    document.body.classList.toggle('dark-mode');
    btn.classList.toggle('on');
    localStorage.setItem('blog-darkmode', document.body.classList.contains('dark-mode') ? '1' : '0');
  });
})();
