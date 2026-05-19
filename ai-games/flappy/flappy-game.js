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
    var PX = 4;
    var PX_BIRD = 2;

    var PIXEL_DIGITS = [
        '111101101101111',
        '010010010010010',
        '111001111100111',
        '111001111001111',
        '101101111001001',
        '111100111001111',
        '111100111101111',
        '111001001001001',
        '111101111101111',
        '111101111001111',
    ];
    var DIGIT_W = 3;
    var DIGIT_H = 5;

    function getDifficulty() {
        var gap = Math.max(150, 170 - Math.floor(score / 8) * 5);
        var speed = Math.min(2, 1.5 + Math.floor(score / 10) * 0.2);
        return { gap: gap, speed: speed };
    }

    var canvas, ctx, scoreSpan, bestScoreSpan, readyOverlay;
    var bird, pipes, score, bestScore, gameState, animFrame;
    var particles = [];
    var particleTimer = 0;
    var gameoverTimer = 0;
    var countdownInterval = null;

    function clearCountdown() {
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        gameoverTimer = 0;
    }

    function resetGame() {
        clearCountdown();
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
            readyOverlay.innerHTML =
                '<div class="overlay-panel">' +
                '<div class="rd-title">FLAPPY BYTE</div>' +
                '<div class="rd-sub">— 小鸟闯关 —</div>' +
                '<div class="rd-start">▶ 点击画面开始游戏 ◀</div>' +
                '</div>';
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
                var newBest = score >= bestScore && score > 0 ? '<div class="go-new">🏆 新纪录!</div>' : '';
                readyOverlay.innerHTML = 
                    '<div class="overlay-panel">' +
                    '<div class="go-title">💀 GAME OVER</div>' +
                    '<div class="go-score-row">' +
                    '<div class="go-score-item"><div class="go-label">得分</div><div class="go-num">' + score + '</div></div>' +
                    '<div class="go-score-item"><div class="go-label">最佳</div><div class="go-num">' + bestScore + '</div></div>' +
                    '</div>' +
                    newBest +
                    '<div class="go-hint" id="go-hint">3 秒后可关闭</div>' +
                    '</div>';
                clearCountdown();
                gameoverTimer = Date.now() + 3000;
                countdownInterval = setInterval(function() {
                    var remaining = Math.ceil((gameoverTimer - Date.now()) / 1000);
                    var hintEl = document.getElementById('go-hint');
                    if (!hintEl) { clearInterval(countdownInterval); return; }
                    if (remaining > 0) {
                        hintEl.textContent = remaining + ' 秒后可关闭';
                    } else {
                        hintEl.textContent = '点击关闭';
                        clearInterval(countdownInterval);
                        countdownInterval = null;
                    }
                }, 200);
            }
            console.log('游戏结束，得分:', score);
        }
    }

    function drawBg() {
        var isDark = document.body.classList.contains('dark-mode');
        var skyColors = isDark
            ? ['#1a1a2e', '#16213e', '#0f3460', '#0a1628']
            : ['#37c6c0', '#4dc9c3', '#6ed0c9', '#87CEEB', '#b8e6f0'];
        var bandH = Math.ceil(canvas.height / skyColors.length / PX) * PX;
        for (var i = 0; i < skyColors.length; i++) {
            ctx.fillStyle = skyColors[i];
            ctx.fillRect(0, i * bandH, canvas.width, bandH + PX);
        }

        var cloudP = PX;
        for (var c = 0; c < 3; c++) {
            var cx = (Date.now() * 0.015 + c * 220) % (canvas.width + 120) - 60;
            var cy = Math.floor((40 + c * 25) / cloudP) * cloudP;
            var cloudGrid = [
                [0,0,1,1,1,1,1,1,0,0],
                [0,1,1,1,1,1,1,1,1,0],
                [1,1,1,1,1,1,1,1,1,1],
                [0,1,1,1,1,1,1,1,0,0],
            ];
            ctx.fillStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.45)';
            for (var r = 0; r < cloudGrid.length; r++) {
                for (var col = 0; col < cloudGrid[r].length; col++) {
                    if (cloudGrid[r][col]) {
                        ctx.fillRect(cx + col * cloudP, cy + r * cloudP, cloudP, cloudP);
                    }
                }
            }
        }
    }

    function drawGround() {
        var gy = canvas.height - 60;
        var p = PX;

        ctx.fillStyle = C_SAND_DARK;
        ctx.fillRect(0, gy, canvas.width, 60);

        var offset = -(Date.now() * 0.04) % (p * 2);
        ctx.fillStyle = C_SAND;
        for (var x = 0; x < canvas.width; x += p * 2) {
            ctx.fillRect(x + offset, gy, p, 60);
        }

        ctx.fillStyle = C_TEAL_DEEP;
        ctx.fillRect(0, gy, canvas.width, p);

        ctx.fillStyle = C_TEAL;
        for (var i = 0; i < 12; i++) {
            var bx = (i * p * 3 + offset * 2) % (canvas.width + p * 3) - p;
            ctx.fillRect(bx, gy + p * 2, p, p);
            ctx.fillRect(bx + p, gy + p * 4, p, p);
        }
    }

    function drawPipes() {
        var p = PX;
        for (var i = 0; i < pipes.length; i++) {
            var pp = pipes[i];
            var x = Math.round(pp.x / p) * p;
            var w = Math.round(pp.w / p) * p;
            var gapY = Math.round(pp.gapY / p) * p;
            var gapH = Math.round(pp.gapH / p) * p;
            var capH = 20;

            ctx.fillStyle = C_TEAL_DEEP;
            ctx.fillRect(x, 0, w, gapY);
            ctx.fillRect(x, gapY + gapH, w, canvas.height - gapY - gapH - 60);

            ctx.fillStyle = C_TEAL;
            ctx.fillRect(x + p, 0, p * 2, gapY);
            ctx.fillRect(x + p, gapY + gapH, p * 2, canvas.height - gapY - gapH - 60);

            ctx.fillStyle = '#1d746f';
            ctx.fillRect(x + w - p, 0, p, gapY);
            ctx.fillRect(x + w - p, gapY + gapH, p, canvas.height - gapY - gapH - 60);

            var capW = Math.round((w + 8) / p) * p;
            var capX = x - Math.round(4 / p) * p;
            ctx.fillStyle = C_TEAL_DEEP;
            ctx.fillRect(capX, gapY - capH, capW, capH);
            ctx.fillRect(capX, gapY + gapH, capW, capH);

            ctx.fillStyle = C_TEAL;
            ctx.fillRect(capX + p, gapY - capH, capW - p * 2, p);
            ctx.fillRect(capX + p, gapY + gapH + capH - p, capW - p * 2, p);

            ctx.fillStyle = C_GOLD;
            ctx.fillRect(capX, gapY - capH, capW, p);
            ctx.fillRect(capX, gapY + gapH, capW, p);
            ctx.fillRect(capX, gapY - p, capW, p);
            ctx.fillRect(capX, gapY + gapH + capH - p, capW, p);
        }
    }

    function drawBird() {
        ctx.save();
        ctx.translate(bird.x + bird.w / 2, bird.y + bird.h / 2);
        ctx.rotate(bird.rotation);

        var bp = PX_BIRD;
        var palette = ['', '#1d746f', '#1d8a84', '#37c6c0', '#ffd93d', '#ffffff', '#222222', '#2aa39e'];
        var grid = [
            [0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0],
            [0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0],
            [0,0,0,0,0,7,1,1,1,1,1,1,0,0,0,0],
            [0,0,0,0,7,7,1,1,1,1,1,1,0,0,0,0],
            [0,0,0,0,0,1,1,1,3,3,3,0,0,0,0,0],
            [0,0,0,0,0,1,1,1,1,3,3,0,0,5,5,4],
            [0,0,0,0,0,1,1,1,1,1,3,0,5,6,5,4],
            [0,0,0,0,0,1,1,1,1,1,1,0,5,5,5,4],
            [0,0,0,0,0,0,1,1,1,1,0,0,0,0,4,0],
            [0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        ];
        var gw = grid[0].length;
        var gh = grid.length;
        for (var row = 0; row < gh; row++) {
            for (var col = 0; col < gw; col++) {
                var c = grid[row][col];
                if (c === 0) continue;
                var yOff = (c === 7 && bird.wingUp) ? -2 : 0;
                ctx.fillStyle = palette[c];
                ctx.fillRect(
                    (col - gw / 2) * bp,
                    (row - gh / 2 + yOff) * bp,
                    bp, bp
                );
            }
        }

        ctx.restore();
    }

    function drawParticles() {
        var pp = PX;
        for (var i = 0; i < particles.length; i++) {
            var p = particles[i];
            ctx.fillStyle = 'rgba(55,198,192,' + p.alpha + ')';
            ctx.fillRect(
                Math.floor(p.x / pp) * pp,
                Math.floor(p.y / pp) * pp,
                p.r, p.r
            );
        }
    }

    function drawPixelDigit(digit, x, y, dp) {
        var data = PIXEL_DIGITS[digit];
        for (var i = 0; i < DIGIT_H * DIGIT_W; i++) {
            if (data[i] === '1') {
                ctx.fillRect(
                    x + (i % DIGIT_W) * dp,
                    y + Math.floor(i / DIGIT_W) * dp,
                    dp, dp
                );
            }
        }
    }
    function drawHUD() {
        if (gameState === 'playing' || gameState === 'ready') {
            var dp = Math.round(8 / PX) * PX;
            var str = score.toString();
            var totalW = str.length * (DIGIT_W * dp) + (str.length - 1) * dp;
            var startX = Math.floor((canvas.width - totalW) / (dp * 2)) * (dp * 2);
            var y = Math.floor(18 / PX) * PX;
            ctx.fillStyle = C_GOLD;
            for (var i = 0; i < str.length; i++) {
                var d = parseInt(str[i], 10);
                drawPixelDigit(d, startX + i * (DIGIT_W * dp + dp), y, dp);
            }
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
            if (Date.now() < gameoverTimer) return;
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
        clearCountdown();
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
