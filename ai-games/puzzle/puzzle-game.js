'use strict';

(function() {
    let canvas = null;
    let gameState = null;
    let touchManager = null;
    
    function initPuzzleGame() {
        // 每次都重新获取canvas确保是最新DOM
        canvas = document.getElementById('game-canvas');
        if (!canvas) {
            console.error('找不到 canvas 元素');
            return;
        }

        // 模块存在则防御性重置，确保重新进入时状态干净
        if (window.PuzzleCore) {
            window.PuzzleCore.clearSelection();
            window.PuzzleCore.reset();
        }
        if (window.PuzzleRender) {
            window.PuzzleRender.stopAnimation();
            window.PuzzleRender.hintTarget = null;
            window.PuzzleRender.dirtyRegions = [];
            window.PuzzleRender.particles = [];
            window.PuzzleRender.staticCache = new Map();
        }
        if (window.PuzzleAI) {
            window.PuzzleAI.init();
        }
        if (window.GameStateManager) {
            window.GameStateManager.cleanup();
        }
        if (window.ImageLoadManager && window.ImageLoadManager.cleanup) {
            window.ImageLoadManager.cleanup();
        }
        
        // TouchManager是可选模块，不阻塞游戏启动
        if (window.TouchManager) {
            touchManager = window.TouchManager;
            try {
                touchManager.cleanup();
                touchManager.init(canvas);
                
                // 配置触摸事件
                touchManager.on('tap', handleTap);
                touchManager.on('doubletap', handleDoubleTap);
                touchManager.on('dragstart', handleDragStart);
                touchManager.on('dragmove', handleDragMove);
                touchManager.on('dragend', handleDragEnd);
                touchManager.on('longpress', handleLongPress);
                console.log('[PuzzleGame] TouchManager 已初始化');
            } catch (e) {
                console.warn('[PuzzleGame] TouchManager 初始化失败:', e);
            }
        }

        const levelSpan = document.getElementById('level');
        const hintsSpan = document.getElementById('hints');
        const hintBtn = document.getElementById('hint-btn');
        const restartBtn = document.getElementById('restart-btn');
        const startBtn = document.getElementById('start-btn');
        const bestLevelSpan = document.getElementById('best-level');
        const timerSpan = document.getElementById('timer');
        let nextBtn = null;

        // 初始化统一状态管理
        const gsm = window.GameStateManager;
        gsm.init();
        // 兼容旧代码，通过代理桥接到 GameStateManager
        gameState = {
            get isPlaying() { return gsm.get('game.isPlaying'); },
            set isPlaying(v) { gsm.set('game.isPlaying', v); },
            get isComplete() { return gsm.get('game.isComplete'); },
            set isComplete(v) { gsm.set('game.isComplete', v); },
            get level() { return gsm.get('game.level'); },
            set level(v) { gsm.set('game.level', v); },
            get bestLevel() { return gsm.get('game.bestLevel'); },
            set bestLevel(v) { if (v > gsm.get('game.bestLevel')) gsm.set('game.bestLevel', v); },
            get timeRemaining() { return gsm.get('game.timeRemaining'); },
            set timeRemaining(v) { gsm.set('game.timeRemaining', v); },
            get isFailed() { return gsm.get('game.isFailed'); },
            set isFailed(v) { gsm.set('game.isFailed', v); },
            get imageSeed() { return gsm.get('game.imageSeed'); },
            set imageSeed(v) { gsm.set('game.imageSeed', v); },
            get moveHistory() { return gsm.get('game.moveHistory') || []; },
            set moveHistory(v) { gsm.set('game.moveHistory', v); },
            get maxHistorySize() { return gsm.get('game.maxHistorySize') || 50; },
            currentPiece: null,
            selectedPiece: null,
            dragOffset: { x: 0, y: 0 },
            dragStartX: 0,
            dragStartY: 0,
            timerInterval: null,
            perfInterval: null
        };

        if (bestLevelSpan) {
            bestLevelSpan.textContent = gameState.bestLevel > 0 ? gameState.bestLevel : '-';
        }

        if (startBtn) {
            startBtn.addEventListener('click', () => {
                if (!gameState.isPlaying) {
                    startGame();
                    startBtn.style.display = 'none';
                }
            });
        }

        if (hintBtn) {
            hintBtn.addEventListener('click', () => {
                if (!gameState.isPlaying || gameState.isComplete) return;
                
                const result = window.PuzzleAI.useHint(window.PuzzleCore, window.PuzzleRender);
                if (result && hintsSpan) {
                    hintsSpan.textContent = result.hintsRemaining;
                }
            });
        }

        if (restartBtn) {
            restartBtn.addEventListener('click', () => {
                startGame();
            });
        }

        window.PuzzleRender.init('game-canvas');
        window.PuzzleAI.init();
        
        // 初始化ImageLoadManager（图片加载优化）
        if (window.ImageLoadManager) {
            window.ImageLoadManager.init();
            console.log('[PuzzleGame] ImageLoadManager 已初始化');
        }
        
        // 打印性能信息
        if (window.PuzzleRender.getPerformanceStats) {
            gameState.perfInterval = setInterval(() => {
                const stats = window.PuzzleRender.getPerformanceStats();
                console.log(`[PuzzleGame] 性能: FPS=${stats.fps}, 渲染时间=${stats.avgRenderTime.toFixed(2)}ms, 粒子数=${stats.particleCount}`);
            }, 5000);
        }
        
        // 触摸事件处理器
        function handleTap(data) {
            // 处理点击选中
            const rect = canvas.getBoundingClientRect();
            const coords = { x: data.x - rect.left, y: data.y - rect.top };
            const piece = window.PuzzleCore.getPieceAt(coords.x, coords.y);
            
            if (piece && !piece.isLocked) {
                gameState.selectedPiece = piece;
                window.PuzzleCore.selectPiece(piece.id);
            }
        }
        
        function handleDoubleTap(data) {
            const rect = canvas.getBoundingClientRect();
            const coords = { x: data.x - rect.left, y: data.y - rect.top };
            const piece = window.PuzzleCore.getPieceAt(coords.x, coords.y);
            
            if (piece && gameState.selectedPiece && gameState.selectedPiece.id === piece.id) {
                if (window.PuzzleCore.enableRotation) {
                    window.PuzzleCore.rotatePiece(piece.id, true);
                    if (navigator.vibrate) {
                        navigator.vibrate(5);
                    }
                }
                window.PuzzleAI.recordRotationResult(true);
            }
        }
        
        function handleDragStart(data) {
            if (!gameState.isPlaying || gameState.isComplete) return;
            
            const rect = canvas.getBoundingClientRect();
            const coords = { x: data.x - rect.left, y: data.y - rect.top };
            const piece = window.PuzzleCore.getPieceAt(coords.x, coords.y);
            
            if (piece && !piece.isLocked) {
                gameState.selectedPiece = piece;
                gameState.currentPiece = piece;
                gameState.dragStartX = coords.x;
                gameState.dragStartY = coords.y;
                gameState.dragOffset = {
                    x: coords.x - piece.currentX,
                    y: coords.y - piece.currentY
                };
                window.PuzzleCore.selectPiece(piece.id);
                
                if (navigator.vibrate) {
                    navigator.vibrate(10);
                }
            }
        }
        
        function handleDragMove(data) {
            if (!gameState.currentPiece) return;
            
            const rect = canvas.getBoundingClientRect();
            const coords = { x: data.x - rect.left, y: data.y - rect.top };
            
            window.PuzzleCore.movePiece(
                gameState.currentPiece.id,
                coords.x - gameState.dragOffset.x,
                coords.y - gameState.dragOffset.y
            );
        }
        
        function handleDragEnd(data) {
            if (!gameState.currentPiece) return;
            
            const piece = gameState.currentPiece;
            const pieceId = piece.id;
            const oldX = piece.currentX;
            const oldY = piece.currentY;
            
            const result = window.PuzzleCore.checkSnap(pieceId);
            
            if (result.snapped) {
                if (!piece.isLocked) {
                    if (navigator.vibrate) {
                        navigator.vibrate([10, 50, 10]);
                    }
                    gameState.moveHistory.push({
                        pieceId: pieceId,
                        oldX: oldX,
                        oldY: oldY,
                        timestamp: Date.now()
                    });
                    if (gameState.moveHistory.length > gameState.maxHistorySize) {
                        gameState.moveHistory.shift();
                    }
                    applyTimeBonus();
                }
                console.log('碎片吸附成功:', pieceId);
                
                const progress = window.PuzzleCore.getProgress();
                if (hintsSpan) hintsSpan.textContent = progress.hints;
                
                window.PuzzleCore.clearSelection();
                
                if (result.isComplete) {
                    handleGameComplete();
                }
            }
            
            gameState.currentPiece = null;
            gameState.selectedPiece = null;
        }
        
        function handleLongPress(data) {
            // 长按显示提示
            if (gameState.isPlaying && !gameState.isComplete) {
                if (!window.PuzzleAI.canUseHint(window.PuzzleCore)) return;

                const result = window.PuzzleAI.useHint(window.PuzzleCore, window.PuzzleRender);
                if (result && hintsSpan) {
                    hintsSpan.textContent = result.hintsRemaining;
                    // 视觉反馈：闪烁提示数字
                    hintsSpan.style.transition = 'color 0.3s, transform 0.3s';
                    hintsSpan.style.color = '#ff4444';
                    hintsSpan.style.transform = 'scale(1.3)';
                    setTimeout(() => {
                        hintsSpan.style.color = '';
                        hintsSpan.style.transform = '';
                    }, 600);
                    // 闪烁提示按钮
                    if (hintBtn) {
                        hintBtn.style.transition = 'background-color 0.3s';
                        hintBtn.style.backgroundColor = '#ff6666';
                        setTimeout(() => {
                            hintBtn.style.backgroundColor = '';
                        }, 600);
                    }
                }
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
            }
        }

        function showLoading() {
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            
            ctx.fillStyle = '#f5f5f5';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.fillStyle = '#666';
            ctx.font = '18px "Microsoft YaHei", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('加载图片中...', canvas.width / 2, canvas.height / 2);
        }

        function hideLoading() {
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        function getCanvasSize() {
            const w = canvas && canvas.width > 0 ? canvas.width : 500;
            const h = canvas && canvas.height > 0 ? canvas.height : 400;
            return { width: w, height: h };
        }

        function startTimer() {
            stopTimer();
            const config = window.PuzzleConfig.getDifficulty(gameState.level);
            gameState.timeRemaining = config.time;
            if (timerSpan) timerSpan.textContent = gameState.timeRemaining;

            gameState.timerInterval = setInterval(() => {
                gameState.timeRemaining--;
                if (timerSpan) timerSpan.textContent = gameState.timeRemaining;

                if (gameState.timeRemaining <= 0) {
                    stopTimer();
                    gameState.isFailed = true;
                    gameState.isPlaying = false;
                    showFailedMessage();
                }
            }, 1000);
            window._puzzleTimer = gameState.timerInterval;
        }

        function stopTimer() {
            if (gameState.timerInterval) {
                clearInterval(gameState.timerInterval);
                gameState.timerInterval = null;
            }
        }

        function applyTimeBonus() {
            const config = window.PuzzleConfig.getDifficulty(gameState.level);
            if (gameState.timeRemaining < config.time * 0.5) {
                gameState.timeRemaining += 2;
                if (timerSpan) timerSpan.textContent = gameState.timeRemaining;
            }
        }

        function showFailedMessage() {
            gameState.isPlaying = false;
            
            const config = window.PuzzleConfig.getDifficulty(gameState.level);
            const timeUsed = config.time;
            
            // 更新持久化数据
            if (window.GameDataPersistence) {
                window.GameDataPersistence.saveGameSession({
                    level: gameState.level,
                    completed: false,
                    timeUsed: timeUsed,
                    hintsUsed: config.hints - window.PuzzleCore.hintsRemaining
                });
            }
            
            // 反馈闭环：记录失败
            window.PuzzleConfig.recordLevelComplete(gameState.level, timeUsed, false);
            window.PuzzleConfig.savePlayerPerformance();
            
            if (startBtn) {
                startBtn.textContent = '⏰ 时间到！重新开始';
                startBtn.style.display = 'inline-block';
            }
            if (nextBtn) nextBtn.style.display = 'none';
            if (restartBtn) restartBtn.style.display = 'inline-block';
            console.log('游戏失败！时间到');
        }

        async function startGame() {
            showLoading();
            
            // 清除之前的选中状态
            if (window.PuzzleCore) {
                window.PuzzleCore.clearSelection();
            }
            gameState.currentPiece = null;
            gameState.selectedPiece = null;
            
            gameState.isPlaying = true;
            gameState.isComplete = false;
            gameState.isFailed = false;
            gameState.level = 1;
            gameState.imageSeed = Date.now();
            gameState.moveHistory = [];

            if (nextBtn) nextBtn.style.display = 'none';
            if (restartBtn) restartBtn.style.display = 'none';
            
            // 隐藏开始按钮
            if (startBtn) startBtn.style.display = 'none';

            const size = getCanvasSize();
            
            let loadAborted = false;
            const loadPromise = window.PuzzleCore.init(1, size.width, size.height, gameState.imageSeed);
            
            let initData = null;
            try {
                initData = await Promise.race([
                    loadPromise.then(data => { if (loadAborted) return null; return data; }),
                    new Promise((resolve) => setTimeout(() => { loadAborted = true; resolve(null); }, 15000))
                ]);
            } catch (e) {
                console.warn('图片加载失败');
            }
            
            if (!initData || !initData.pieces) {
                console.log('使用纯色模式');
                initData = window.PuzzleCore.initSync(1, size.width, size.height);
            }
            
            updateUI(initData);
            hideLoading();
            startTimer();
            startRender();

            console.log('游戏开始，等级:', gameState.level);
        }

        function updateUI(data) {
            if (levelSpan) levelSpan.textContent = data.level;
            if (hintsSpan) hintsSpan.textContent = data.hints;
        }

        function startRender() {
            window.PuzzleRender.startAnimation(function(delta) {
                window.PuzzleCore.updateRotations(delta);

                const pieces = window.PuzzleCore.getPiecesForRender();
                const core = window.PuzzleCore;

                window.PuzzleRender.render({
                    pieces: pieces,
                    gridSize: core.gridSize,
                    cellSize: core.cellSize,
                    isComplete: gameState.isComplete,
                    isFailed: gameState.isFailed
                });
            });
        }

        function handleGameComplete() {
            gameState.isComplete = true;
            gameState.isPlaying = false;
            stopTimer();
            
            const config = window.PuzzleConfig.getDifficulty(gameState.level);
            const timeUsed = config.time - gameState.timeRemaining;
            
            // 更新持久化数据
            if (window.GameDataPersistence) {
                window.GameDataPersistence.saveGameSession({
                    level: gameState.level,
                    completed: true,
                    timeUsed: timeUsed,
                    hintsUsed: config.hints - window.PuzzleCore.hintsRemaining,
                    rotationCount: window.PuzzleAI.playerBehavior.rotationAttempts,
                    successfulRotations: window.PuzzleAI.playerBehavior.successfulRotations
                });
            }
            
            if (gameState.level > gameState.bestLevel) {
                gameState.bestLevel = gameState.level;
                localStorage.setItem('puzzle-best-level', gameState.bestLevel);
                if (bestLevelSpan) {
                    bestLevelSpan.textContent = gameState.bestLevel;
                }
            }
            
            // 反馈闭环：记录难度和AI行为
            window.PuzzleConfig.recordLevelComplete(gameState.level, timeUsed, true);
            window.PuzzleAI.recordCompletionTime(timeUsed);
            window.PuzzleConfig.savePlayerPerformance();

            // 始终显示下一关按钮（无限关卡）
            if (!nextBtn) {
                nextBtn = document.createElement('button');
                nextBtn.id = 'next-btn';
                nextBtn.className = 'game-btn';
                nextBtn.textContent = '下一关 ➡';
                document.querySelector('.button-group').appendChild(nextBtn);
                nextBtn.addEventListener('click', goToNextLevel);
            }
            nextBtn.style.display = 'inline-block';
            
            if (startBtn) {
                startBtn.textContent = '🎉 通关! 再来一次';
                startBtn.style.display = 'inline-block';
            }
            
            console.log('游戏完成! 达到关卡:', gameState.level);
        }

        async function goToNextLevel() {
            showLoading();
            
            if (nextBtn) nextBtn.style.display = 'none';
            if (startBtn) startBtn.style.display = 'none';
            
            gameState.isPlaying = true;
            gameState.isComplete = false;
            gameState.isFailed = false;
            gameState.level++;
            gameState.imageSeed = Date.now();
            
            const size = getCanvasSize();
            
            let loadAborted = false;
            const loadPromise = window.PuzzleCore.init(gameState.level, size.width, size.height, gameState.imageSeed);
            
            let initData = null;
            try {
                initData = await Promise.race([
                    loadPromise.then(data => { if (loadAborted) return null; return data; }),
                    new Promise((resolve) => setTimeout(() => { loadAborted = true; resolve(null); }, 15000))
                ]);
            } catch (e) {
                console.warn('图片加载失败');
            }
            
            if (!initData || !initData.pieces) {
                initData = window.PuzzleCore.initSync(gameState.level, size.width, size.height);
            }
            
            updateUI(initData);
            hideLoading();
            startTimer();
            
            console.log('进入下一关，关卡:', gameState.level);
        }

        // 桌面端双击旋转通过 TouchManager 的 doubletap 事件处理

        canvas.style.cursor = 'pointer';

        showEmptyState();

        console.log('光影拼图游戏初始化完成');
    }

    function showEmptyState() {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#999';
        ctx.font = '16px "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('点击"开始游戏"按钮开始', canvas.width / 2, canvas.height / 2);
    }

function cleanupPuzzleGame() {
        // 停止动画渲染
        if (window.PuzzleRender) {
            window.PuzzleRender.stopAnimation();
            window.PuzzleRender.hintTarget = null;
            window.PuzzleRender.staticCache = new Map();
            window.PuzzleRender.dirtyRegions = [];
            window.PuzzleRender.particles = [];
            window.PuzzleRender.particlePool.forEach(p => { p.active = false; });
            window.PuzzleRender.hints = [];
        }
        
        // 重置 PuzzleCore 完整状态
        if (window.PuzzleCore) {
            window.PuzzleCore.clearSelection();
            window.PuzzleCore.reset();
        }
        
        // 重置 PuzzleAI
        if (window.PuzzleAI) {
            window.PuzzleAI.init();
        }
        
        // 清理 GameStateManager
        if (window.GameStateManager) {
            window.GameStateManager.cleanup();
        }
        
        // 清理 ImageLoadManager
        if (window.ImageLoadManager && window.ImageLoadManager.cleanup) {
            window.ImageLoadManager.cleanup();
        }
        
        // 清理 TouchManager
        if (window.TouchManager) {
            window.TouchManager.cleanup();
        }
        
        // 重置游戏状态
        if (gameState) {
            gameState.isPlaying = false;
            gameState.isComplete = false;
            gameState.isFailed = false;
            gameState.currentPiece = null;
            gameState.selectedPiece = null;
            gameState.moveHistory = [];
            gameState.level = 1;
            if (gameState.timerInterval) {
                clearInterval(gameState.timerInterval);
                gameState.timerInterval = null;
            }
            if (gameState.perfInterval) {
                clearInterval(gameState.perfInterval);
                gameState.perfInterval = null;
            }
        }
        
        // 清除 window 定时器
        if (window._puzzleTimer) {
            clearInterval(window._puzzleTimer);
            window._puzzleTimer = null;
        }
        
        // 清除 canvas 内容
        const currentCanvas = document.getElementById('game-canvas');
        if (currentCanvas) {
            const ctx = currentCanvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, currentCanvas.width, currentCanvas.height);
            }
        }
        
        console.log('光影拼图游戏已清理');
    }

    if (window.GameManager) {
        window.GameManager.register('puzzle', {
            init: initPuzzleGame,
            cleanup: cleanupPuzzleGame,
            timerKey: '_puzzleTimer'
        });
    }

})();