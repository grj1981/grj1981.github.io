// 贪吃蛇游戏 - 独立 JS 文件

// 将游戏初始化函数挂载到全局，以便 PJAX 完成后能重新调用
window.initSnakeGame = function() {
    console.log('初始化贪吃蛇游戏...');

    // 获取 DOM 元素
    const canvas = document.getElementById('game-canvas');
    if (!canvas) {
        console.error('找不到 canvas 元素');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    const scoreSpan = document.getElementById('score');
    const restartBtn = document.getElementById('restart-btn');
    const startBtn = document.getElementById('start-btn');

    // 防御性检查
    if (!ctx || !scoreSpan || !restartBtn || !startBtn) {
        console.error('游戏初始化失败：元素未就绪', {ctx, scoreSpan, restartBtn, startBtn});
        // 延迟重试
        setTimeout(window.initSnakeGame, 200);
        return;
    }

    // 清除可能存在的旧定时器（防止 PJAX 后残留）
    if (window._snakeTimer) {
        clearInterval(window._snakeTimer);
        window._snakeTimer = null;
    }

    // 游戏配置
    const gridSize = 20;      // 20x20 网格
    const cellSize = 20;      // 每个格子 20px
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
    let timer = null;   // 局部定时器，每次初始化都会重新创建

    // 生成随机食物（避开蛇身）
    function randomFood() {
        for (let i = 0; i < 1000; i++) {
            const x = Math.floor(Math.random() * gridSize);
            const y = Math.floor(Math.random() * gridSize);
            if (!snake.some(seg => seg.x === x && seg.y === y)) {
                return {x, y};
            }
        }
        // 理论上如果蛇占满格子，返回 null
        return null;
    }

    // 绘制游戏画面
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 绘制网格线
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

        // 绘制蛇身
        snake.forEach((seg, idx) => {
            ctx.fillStyle = idx === 0 ? '#8bc34a' : '#4CAF50';
            ctx.fillRect(seg.x * cellSize + 1, seg.y * cellSize + 1, cellSize - 2, cellSize - 2);
            // 蛇眼睛
            if (idx === 0) {
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(seg.x * cellSize + 6, seg.y * cellSize + 6, 2, 0, 2 * Math.PI);
                ctx.arc(seg.x * cellSize + 14, seg.y * cellSize + 6, 2, 0, 2 * Math.PI);
                ctx.fill();
            }
        });

        // 绘制食物
        if (food) {
            ctx.fillStyle = '#f44336';
            ctx.beginPath();
            ctx.arc(food.x * cellSize + cellSize / 2, food.y * cellSize + cellSize / 2, 8, 0, 2 * Math.PI);
            ctx.fill();
        }

        // 游戏结束遮罩
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

    // 移动蛇的核心逻辑
    function move() {
        if (gameOver) return;

        // 应用下次方向
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

        // 判断是否吃到食物
        const isEating = food && newHead.x === food.x && newHead.y === food.y;
        let newSnake = [newHead, ...snake];
        if (!isEating) newSnake.pop();

        // 碰撞检测
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
                // 胜利！蛇占满所有格子
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

    // 重置游戏状态
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

    // 开始游戏循环
    function start() {
        if (gameOver) return;
        if (timer) return;  // 已在运行
        timer = setInterval(move, 150);
        window._snakeTimer = timer;
        console.log('游戏开始');
    }

    // 键盘控制
    function handleKeydown(e) {
        if (e.key.startsWith('Arrow')) e.preventDefault();
        switch (e.key) {
            case 'ArrowUp': nextDirection = 'UP'; break;
            case 'ArrowDown': nextDirection = 'DOWN'; break;
            case 'ArrowLeft': nextDirection = 'LEFT'; break;
            case 'ArrowRight': nextDirection = 'RIGHT'; break;
        }
    }

    // ============================================
    // 以下为新增的触摸控制代码
    // ============================================

    // 触摸控制变量
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    // 触摸开始
    canvas.addEventListener('touchstart', function(e) {
        e.preventDefault();
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
    }, { passive: false });

    // 触摸结束 - 判断滑动方向
    canvas.addEventListener('touchend', function(e) {
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
    }, { passive: false });

    // 绑定事件（先移除旧的避免重复绑定，但由于 PJAX 会重建 DOM，旧监听器自动失效，这里直接绑定即可）
    window.removeEventListener('keydown', handleKeydown);
    window.addEventListener('keydown', handleKeydown);

    // 按钮事件
    restartBtn.onclick = reset;
    startBtn.onclick = start;

    // 初始绘制
    reset();  // reset 已经绘制了初始画面，并且生成了食物
};

// 页面加载时初始化 - 使用 requestAnimationFrame 确保 DOM 完全就绪
function initGameWhenReady() {
    const canvas = document.getElementById('game-canvas');
    const startBtn = document.getElementById('start-btn');
    const restartBtn = document.getElementById('restart-btn');
    
    if (!canvas || !startBtn || !restartBtn) {
        console.log('游戏元素未就绪，等待重试...');
        setTimeout(initGameWhenReady, 100);
        return;
    }
    
    try {
        window.initSnakeGame();
        console.log('贪吃蛇游戏初始化完成');
    } catch (e) {
        console.error('游戏初始化出错:', e);
        setTimeout(initGameWhenReady, 200);
    }
}

// 使用 requestAnimationFrame 确保页面完全渲染
function startInit() {
    if (document.readyState === 'complete') {
        setTimeout(initGameWhenReady, 50);
    } else {
        window.addEventListener('load', initGameWhenReady);
    }
}

startInit();

// PJAX 页面切换后重新初始化（仅当切换到游戏页面时）
document.addEventListener('pjax:success', function() {
    if (document.getElementById('game-canvas')) {
        console.log('PJAX 切换到游戏页，重新初始化');
        setTimeout(initGameWhenReady, 100);
    }
});