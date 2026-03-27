// 贪吃蛇游戏 - 独立 JS 文件

(function() {
    function initSnakeGame() {
        console.log('初始化贪吃蛇游戏...');

        const canvas = document.getElementById('game-canvas');
        if (!canvas) {
            console.error('找不到 canvas 元素');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        const scoreSpan = document.getElementById('score');
        const restartBtn = document.getElementById('restart-btn');
        const startBtn = document.getElementById('start-btn');

        if (!ctx || !scoreSpan || !restartBtn || !startBtn) {
            console.error('游戏初始化失败：元素未就绪');
            return;
        }

        const gridSize = 20;
        const cellSize = 20;
        let snake = [
            {x: 10, y: 10},
            {x: 9, y: 10},
            {x: 8, y: 10}
        ];
        let direction = 'RIGHT';
        let nextDirection = 'RIGHT';
        let food = null;
        let score = 0;
        let gameOver = false;
        let timer = null;

        function randomFood() {
            for (let i = 0; i < 1000; i++) {
                const x = Math.floor(Math.random() * gridSize);
                const y = Math.floor(Math.random() * gridSize);
                if (!snake.some(seg => seg.x === x && seg.y === y)) {
                    return {x, y};
                }
            }
            return null;
        }

        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#000';
            ctx.strokeStyle = '#333';
            ctx.textAlign = 'left';

            ctx.strokeStyle = '#333';
            ctx.lineWidth = 0.5;
            for (let i = 0; i <= gridSize; i++) {
                ctx.beginPath();
                ctx.moveTo(i * cellSize, 0);
                ctx.lineTo(i * cellSize, canvas.height);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(0, i * cellSize);
                ctx.lineTo(canvas.width, i * cellSize);
                ctx.stroke();
            }

            snake.forEach((seg, idx) => {
                ctx.fillStyle = idx === 0 ? '#8bc34a' : '#4CAF50';
                ctx.fillRect(seg.x * cellSize + 1, seg.y * cellSize + 1, cellSize - 2, cellSize - 2);
                if (idx === 0) {
                    ctx.fillStyle = '#fff';
                    ctx.beginPath();
                    ctx.arc(seg.x * cellSize + 6, seg.y * cellSize + 6, 2, 0, 2 * Math.PI);
                    ctx.arc(seg.x * cellSize + 14, seg.y * cellSize + 6, 2, 0, 2 * Math.PI);
                    ctx.fill();
                }
            });

            if (food) {
                ctx.fillStyle = '#f44336';
                ctx.beginPath();
                ctx.arc(food.x * cellSize + cellSize / 2, food.y * cellSize + cellSize / 2, 8, 0, 2 * Math.PI);
                ctx.fill();
            }

            if (gameOver) {
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 20px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('游戏结束', canvas.width / 2, canvas.height / 2 - 15);
                ctx.font = '16px sans-serif';
                ctx.fillText('点击"新一局"', canvas.width / 2, canvas.height / 2 + 15);
            }
        }

        function move() {
            if (gameOver) return;

            const opposite = { 'UP': 'DOWN', 'DOWN': 'UP', 'LEFT': 'RIGHT', 'RIGHT': 'LEFT' };
            if (nextDirection && opposite[nextDirection] !== direction) {
                direction = nextDirection;
            }

            const head = snake[0];
            let newHead = { ...head };
            switch (direction) {
                case 'RIGHT': newHead.x++; break;
                case 'LEFT':  newHead.x--; break;
                case 'UP':    newHead.y--; break;
                case 'DOWN':  newHead.y++; break;
            }

            const isEating = food && newHead.x === food.x && newHead.y === food.y;
            let newSnake = [newHead, ...snake];
            if (!isEating) newSnake.pop();

            if (newHead.x < 0 || newHead.x >= gridSize || newHead.y < 0 || newHead.y >= gridSize) {
                gameOver = true;
                draw();
                if (timer) clearInterval(timer);
                timer = null;
                window._snakeTimer = null;
                return;
            }
            if (newSnake.slice(1).some(seg => seg.x === newHead.x && seg.y === newHead.y)) {
                gameOver = true;
                draw();
                if (timer) clearInterval(timer);
                timer = null;
                window._snakeTimer = null;
                return;
            }

            snake = newSnake;

            if (isEating) {
                score += 10;
                scoreSpan.textContent = score;
                food = randomFood();
                if (!food) {
                    gameOver = true;
                    draw();
                    if (timer) clearInterval(timer);
                    timer = null;
                    window._snakeTimer = null;
                    return;
                }
            }
            draw();
        }

        function reset() {
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
            window._snakeTimer = null;

            snake = [
                {x: 10, y: 10},
                {x: 9, y: 10},
                {x: 8, y: 10}
            ];
            direction = 'RIGHT';
            nextDirection = 'RIGHT';
            score = 0;
            gameOver = false;
            scoreSpan.textContent = '0';
            food = randomFood();
            draw();
            console.log('游戏已重置');
        }

        function start() {
            if (gameOver) return;
            if (timer) return;
            timer = setInterval(move, 150);
            window._snakeTimer = timer;
            console.log('游戏开始');
        }

        function handleKeydown(e) {
            if (e.key.startsWith('Arrow')) e.preventDefault();
            switch (e.key) {
                case 'ArrowUp': nextDirection = 'UP'; break;
                case 'ArrowDown': nextDirection = 'DOWN'; break;
                case 'ArrowLeft': nextDirection = 'LEFT'; break;
                case 'ArrowRight': nextDirection = 'RIGHT'; break;
            }
        }
        window._snakeKeyHandler = handleKeydown;

        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartTime = 0;

        const snakeTouchStart = function(e) {
            e.preventDefault();
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            touchStartTime = Date.now();
        };

        const snakeTouchEnd = function(e) {
            e.preventDefault();
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            const touchDuration = Date.now() - touchStartTime;
            
            const minSwipeDistance = 30;
            const maxTouchDuration = 500;
            
            if (touchDuration < maxTouchDuration) {
                const deltaX = touchEndX - touchStartX;
                const deltaY = touchEndY - touchStartY;
                
                if (Math.abs(deltaX) > minSwipeDistance || Math.abs(deltaY) > minSwipeDistance) {
                    if (Math.abs(deltaX) > Math.abs(deltaY)) {
                        nextDirection = deltaX > 0 ? 'RIGHT' : 'LEFT';
                    } else {
                        nextDirection = deltaY > 0 ? 'DOWN' : 'UP';
                    }
                }
            }
        };

        window._snakeTouchStart = snakeTouchStart;
        window._snakeTouchEnd = snakeTouchEnd;

        canvas.addEventListener('touchstart', snakeTouchStart, { passive: false });
        canvas.addEventListener('touchend', snakeTouchEnd, { passive: false });
        window.addEventListener('keydown', handleKeydown);

        restartBtn.onclick = reset;
        startBtn.onclick = start;

        reset();
    }

    function cleanupSnakeGame() {
        console.log('清理贪吃蛇游戏...');
        
        if (window._snakeTimer) {
            clearInterval(window._snakeTimer);
            window._snakeTimer = null;
        }

        const canvas = document.getElementById('game-canvas');
        if (canvas) {
            canvas.removeEventListener('touchstart', window._snakeTouchStart);
            canvas.removeEventListener('touchend', window._snakeTouchEnd);
        }
        window.removeEventListener('keydown', window._snakeKeyHandler);
    }

    if (window.GameManager) {
        window.GameManager.register('snake', {
            init: initSnakeGame,
            cleanup: cleanupSnakeGame,
            timerKey: '_snakeTimer'
        });
    }

})();
