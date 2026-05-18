(function() {
    'use strict';

    var C_TEAL = '#37c6c0';
    var C_TEAL_DARK = '#2aa39e';
    var C_TEAL_DEEP = '#1d8a84';
    var C_CORAL = '#ff6b6b';
    var C_GOLD = '#ffd93d';
    var C_GREEN = '#6bcb77';
    var C_SAND = '#e8d5b5';
    var C_SAND_DARK = '#d4be9a';
    var C_SKY_TOP = '#37c6c0';
    var C_SKY_BOT = '#87CEEB';

    var GRAVITY = 0.5;
    var JUMP_FORCE = -6;
    var MAX_SPEED = 10;
    var PIPE_WIDTH = 52;
    var PIPE_SPACING = 200;
    var BIRD_X = 80;

    function getDifficulty() {
        var gap = Math.max(150, 170 - Math.floor(score / 8) * 5);
        var speed = Math.min(2, 1.5 + Math.floor(score / 10) * 0.2);
        return { gap: gap, speed: speed };
    }

    var canvas, ctx, scoreSpan, bestScoreSpan, readyOverlay;
    var bird, pipes, score, bestScore, gameState, animFrame;
    var particles = [];
    var particleTimer = 0;

    function resetGame() {
        bird = {
            x: BIRD_X,
            y: 240,
            w: 32,
            h: 24,
            vy: 0,
            rotation: 0,
            wingUp: false,
            wingTimer: 0
        };
        pipes = [];
        score = 0;
        gameState = 'ready';
        if (scoreSpan) scoreSpan.textContent = '0';
        bestScore = parseInt(localStorage.getItem('flappyBestScore') || '0', 10);
        updateBestDisplay();
        if (readyOverlay) {
            readyOverlay.style.display = 'flex';
            readyOverlay.className = 'ready';
            readyOverlay.innerHTML = '<div class="go-hint" style="font-size:1.1rem">🐤 点击画面开始游戏</div>';
        }
        particles = [];
        console.log('游戏已重置');
    }

    function updateBestDisplay() {
        if (bestScoreSpan) bestScoreSpan.textContent = bestScore.toString();
    }

    function createPipe() {
        var diff = getDifficulty();
        var minGapY = 80;
        var maxGapY = canvas.height - 80 - diff.gap - 60;
        var gapY = minGapY + Math.random() * (maxGapY - minGapY);
        pipes.push({
            x: canvas.width,
            w: PIPE_WIDTH,
            gapY: gapY,
            gapH: diff.gap,
            scored: false
        });
    }

    function checkCollision() {
        if (bird.y < 0) return true;
        var groundY = canvas.height - 60;
        if (bird.y + bird.h > groundY) return true;

        for (var i = 0; i < pipes.length; i++) {
            var p = pipes[i];
            if (bird.x + bird.w > p.x && bird.x < p.x + p.w) {
                if (bird.y < p.gapY || bird.y + bird.h > p.gapY + p.gapH) {
                    return true;
                }
            }
        }
        return false;
    }

    function updateParticles() {
        particleTimer++;
        if (particleTimer % 20 === 0 && particles.length < 10) {
            particles.push({
                x: Math.random() * canvas.width,
                y: canvas.height - 80,
                r: 2 + Math.random() * 4,
                speed: 0.3 + Math.random() * 0.5,
                alpha: 0.3 + Math.random() * 0.4
            });
        }
        for (var i = particles.length - 1; i >= 0; i--) {
            var p = particles[i];
            p.y -= p.speed;
            p.x += Math.sin(p.y * 0.02) * 0.3;
            if (p.y < -10) {
                particles.splice(i, 1);
            }
        }
    }

    function update() {
        if (gameState !== 'playing') return;
        updateParticles();

        bird.vy += GRAVITY;
        if (bird.vy > MAX_SPEED) bird.vy = MAX_SPEED;
        bird.y += bird.vy;

        bird.rotation = bird.vy < 0 ? -0.35 : Math.min(bird.vy * 0.1, 1.4);

        bird.wingTimer++;
        if (bird.wingTimer % 8 === 0) {
            bird.wingUp = !bird.wingUp;
        }

        for (var i = pipes.length - 1; i >= 0; i--) {
            pipes[i].x -= getDifficulty().speed;
            if (!pipes[i].scored && pipes[i].x + pipes[i].w < bird.x) {
                pipes[i].scored = true;
                score++;
                if (scoreSpan) scoreSpan.textContent = score.toString();
            }
            if (pipes[i].x + pipes[i].w < 0) {
                pipes.splice(i, 1);
            }
        }

        if (pipes.length === 0 || pipes[pipes.length - 1].x < canvas.width - PIPE_SPACING) {
            createPipe();
        }

        if (checkCollision()) {
            gameState = 'gameover';
            if (score > bestScore) {
                bestScore = score;
                localStorage.setItem('flappyBestScore', bestScore.toString());
                updateBestDisplay();
            }
            if (readyOverlay) {
                readyOverlay.style.display = 'flex';
                readyOverlay.className = 'gameover';
                var newBest = score >= bestScore && score > 0 ? ' 🏆 新纪录!' : '';
                readyOverlay.innerHTML = 
                    '<div class="go-title">💀 Game Over</div>' +
                    '<div class="go-score-row"><span class="go-label">得分</span><span class="go-num">' + score + '</span></div>' +
                    '<div class="go-score-row"><span class="go-label">最佳</span><span class="go-num">' + bestScore + '</span><span class="go-new">' + newBest + '</span></div>' +
                    '<div class="go-hint">点击重新开始</div>';
            }
            console.log('游戏结束，得分:', score);
        }
    }

    function drawBg() {
        var isDark = document.body.classList.contains('dark-mode');
        var skyTop = isDark ? '#1a1a2e' : C_SKY_TOP;
        var skyMid = isDark ? '#16213e' : '#5dd5c8';
        var skyBot = isDark ? '#0f3460' : C_SKY_BOT;
        var grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, skyTop);
        grad.addColorStop(0.5, skyMid);
        grad.addColorStop(0.85, skyBot);
        grad.addColorStop(1, isDark ? '#0a1628' : '#b8e6f0');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        var cloudY = isDark ? 40 : 45;
        for (var c = 0; c < 3; c++) {
            var cx = (Date.now() * 0.015 + c * 220) % (canvas.width + 120) - 60;
            ctx.fillStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.5)';
            ctx.beginPath();
            ctx.ellipse(cx, cloudY + c * 25, 45, 14, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = isDark ? 'rgba(255,217,61,0.03)' : 'rgba(255,217,61,0.08)';
            ctx.beginPath();
            ctx.ellipse(cx + 15, cloudY + c * 25 - 3, 30, 10, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawGround() {
        var gy = canvas.height - 60;

        var waterGrad = ctx.createLinearGradient(0, gy, 0, canvas.height);
        waterGrad.addColorStop(0, '#7dd3c8');
        waterGrad.addColorStop(0.15, C_SAND);
        waterGrad.addColorStop(0.5, C_SAND);
        waterGrad.addColorStop(1, C_SAND_DARK);
        ctx.fillStyle = waterGrad;
        ctx.fillRect(0, gy, canvas.width, 60);

        ctx.fillStyle = C_TEAL;
        ctx.fillRect(0, gy, canvas.width, 3);

        ctx.fillStyle = 'rgba(55,198,192,0.3)';
        ctx.fillRect(0, gy + 3, canvas.width, 5);

        var offset = -(Date.now() * 0.04) % 28;
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        for (var i = 0; i < 18; i++) {
            var lx = i * 28 + offset;
            ctx.fillRect(lx, gy + 10, 12, 2);
        }
    }

    function drawPipes() {
        for (var i = 0; i < pipes.length; i++) {
            var p = pipes[i];
            var grad = ctx.createLinearGradient(p.x, 0, p.x + p.w, 0);
            grad.addColorStop(0, C_TEAL_DEEP);
            grad.addColorStop(0.3, C_TEAL);
            grad.addColorStop(0.7, C_TEAL);
            grad.addColorStop(1, C_TEAL_DARK);

            ctx.fillStyle = grad;
            ctx.fillRect(p.x, 0, p.w, p.gapY);
            ctx.fillRect(p.x, p.gapY + p.gapH, p.w, canvas.height - p.gapY - p.gapH - 60);

            ctx.fillStyle = C_TEAL_DEEP;
            ctx.fillRect(p.x - 4, p.gapY - 22, p.w + 8, 22);
            ctx.fillRect(p.x - 4, p.gapY + p.gapH, p.w + 8, 22);

            ctx.fillStyle = C_GOLD;
            ctx.fillRect(p.x - 4, p.gapY - 22, p.w + 8, 3);
            ctx.fillRect(p.x - 4, p.gapY + p.gapH, p.w + 8, 3);
            ctx.fillRect(p.x - 4, p.gapY - 3, p.w + 8, 3);
            ctx.fillRect(p.x - 4, p.gapY + p.gapH + 19, p.w + 8, 3);

            ctx.fillStyle = 'rgba(55,198,192,0.08)';
            ctx.fillRect(p.x + 4, p.gapY - 18, 8, p.gapY);
            ctx.fillRect(p.x + 4, p.gapY + p.gapH + 4, 8, canvas.height - p.gapY - p.gapH - 64);
        }
    }

    function drawBird() {
        ctx.save();
        ctx.translate(bird.x + bird.w / 2, bird.y + bird.h / 2);
        ctx.rotate(bird.rotation);

        var bodyGrad = ctx.createRadialGradient(-3, -3, 2, 0, 0, bird.w / 2 + 2);
        bodyGrad.addColorStop(0, '#ffe566');
        bodyGrad.addColorStop(0.6, C_GOLD);
        bodyGrad.addColorStop(1, '#e6c300');
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.ellipse(0, 0, bird.w / 2, bird.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = C_GOLD;
        ctx.shadowColor = 'rgba(255,217,61,0.3)';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.ellipse(0, 0, bird.w / 2, bird.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = C_TEAL;
        var wingY = bird.wingUp ? -7 : 1;
        ctx.beginPath();
        ctx.ellipse(-8, wingY, 10, 6, -0.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = C_TEAL_DARK;
        ctx.beginPath();
        ctx.ellipse(-10, wingY + 2, 8, 4, -0.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(7, -4, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(9, -4, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(10, -5.5, 1, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = C_CORAL;
        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.lineTo(24, 2);
        ctx.lineTo(14, 5);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#e05555';
        ctx.beginPath();
        ctx.moveTo(14, 1);
        ctx.lineTo(22, 2);
        ctx.lineTo(14, 4);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    function drawParticles() {
        for (var i = 0; i < particles.length; i++) {
            var p = particles[i];
            ctx.fillStyle = 'rgba(55,198,192,' + p.alpha + ')';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawHUD() {
        if (gameState === 'playing' || gameState === 'ready') {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.shadowColor = 'rgba(0,0,0,0.3)';
            ctx.shadowBlur = 4;
            ctx.fillStyle = C_GOLD;
            ctx.font = 'bold 42px Arial';
            ctx.fillText(score.toString(), canvas.width / 2, 18);
            ctx.shadowBlur = 0;
        }
    }

    function drawOverlay() {
        if (gameState === 'ready' || gameState === 'gameover') {
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }

    function draw() {
        drawBg();
        drawPipes();
        drawParticles();
        drawGround();
        drawBird();
        drawOverlay();
        drawHUD();
    }

    function gameLoop() {
        update();
        draw();
        animFrame = requestAnimationFrame(gameLoop);
    }

    function handleInput() {
        if (gameState === 'ready') {
            gameState = 'playing';
            if (readyOverlay) readyOverlay.style.display = 'none';
            bird.vy = JUMP_FORCE;
            console.log('游戏已开始');
            return;
        }
        if (gameState === 'gameover') {
            resetGame();
            return;
        }
        if (gameState === 'playing') {
            bird.vy = JUMP_FORCE;
        }
    }

    function handleClick(e) {
        e.preventDefault();
        handleInput();
    }
    window._flappyClick = handleClick;

    function handleTouchStart(e) {
        e.preventDefault();
        handleInput();
    }
    window._flappyTouchStart = handleTouchStart;

    var handleKeydown;
    function initGame() {
        console.log('初始化游戏...');
        canvas = document.getElementById('game-canvas');
        if (!canvas) {
            console.error('找不到 canvas 元素');
            return;
        }

        ctx = canvas.getContext('2d');
        scoreSpan = document.getElementById('score');
        bestScoreSpan = document.getElementById('best-score');
        readyOverlay = document.getElementById('ready-overlay');

        if (!ctx || !scoreSpan) {
            console.error('游戏初始化失败：元素未就绪');
            return;
        }

        handleKeydown = function(e) {
            if (e.key === ' ' || e.key === 'Space') {
                e.preventDefault();
                handleInput();
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                if (gameState === 'ready' || gameState === 'gameover') handleInput();
            }
        };
        window._flappyKeyHandler = handleKeydown;

        function handleTouchEnd(e) { e.preventDefault(); }
        window._flappyTouchEnd = handleTouchEnd;

        canvas.addEventListener('click', handleClick);
        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
        window.addEventListener('keydown', handleKeydown);

        resetGame();
        if (animFrame) cancelAnimationFrame(animFrame);
        gameLoop();
        console.log('Flappy Byte 游戏已启动');
    }

    function cleanupGame() {
        console.log('清理游戏...');
        if (animFrame) {
            cancelAnimationFrame(animFrame);
            animFrame = null;
        }
        if (canvas) {
            canvas.removeEventListener('click', window._flappyClick);
            canvas.removeEventListener('touchstart', window._flappyTouchStart);
            canvas.removeEventListener('touchend', window._flappyTouchEnd);
        }
        window.removeEventListener('keydown', window._flappyKeyHandler);
        console.log('Flappy Byte 已清理');
    }

    if (window.GameManager) {
        window.GameManager.register('flappy', {
            init: initGame,
            cleanup: cleanupGame,
            timerKey: null
        });
    }
})();
