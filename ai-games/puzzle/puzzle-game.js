'use strict';

(function() {
    let canvas = null;
    let gameState = null;
    
    function initPuzzleGame() {
        // 每次都重新获取canvas确保是最新DOM
        canvas = document.getElementById('game-canvas');
        if (!canvas) {
            console.error('找不到 canvas 元素');
            return;
        }

        const requiredModules = ['PuzzleConfig', 'PuzzleCore', 'PuzzleRender', 'PuzzleAI'];
        const missing = requiredModules.filter(m => !window[m]);
        
        if (missing.length > 0) {
            console.log('等待模块加载:', missing.join(', '));
            setTimeout(initPuzzleGame, 50);
            return;
        }

        gameState = null;

        const levelSpan = document.getElementById('level');
        const hintsSpan = document.getElementById('hints');
        const hintBtn = document.getElementById('hint-btn');
        const restartBtn = document.getElementById('restart-btn');
        const startBtn = document.getElementById('start-btn');
        const bestLevelSpan = document.getElementById('best-level');
        const timerSpan = document.getElementById('timer');
        let nextBtn = null;

        gameState = {
            isPlaying: false,
            isComplete: false,
            level: 1,
            currentPiece: null,
            dragOffset: { x: 0, y: 0 },
            selectedPiece: null,
            dragStartX: 0,
            dragStartY: 0,
            bestLevel: parseInt(localStorage.getItem('puzzle-best-level')) || 0,
            timeRemaining: 60,
            timerInterval: null,
            isFailed: false,
            imageSeed: 0,
            moveHistory: [],
            maxHistorySize: 50
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
            const rect = canvas.getBoundingClientRect();
            const w = rect.width > 0 ? rect.width : (canvas.width || 500);
            const h = rect.height > 0 ? rect.height : (canvas.height || 400);
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
            
            // 先尝试异步加载，15秒超时后使用同步模式
            const loadPromise = window.PuzzleCore.init(1, size.width, size.height, gameState.imageSeed);
            
            let initData = null;
            try {
                initData = await Promise.race([
                    loadPromise,
                    new Promise((resolve) => setTimeout(() => resolve(null), 15000))
                ]);
            } catch (e) {
                console.warn('图片加载失败');
            }
            
            // 如果超时或失败，使用同步模式
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
            
            if (gameState.level > gameState.bestLevel) {
                gameState.bestLevel = gameState.level;
                localStorage.setItem('puzzle-best-level', gameState.bestLevel);
                if (bestLevelSpan) {
                    bestLevelSpan.textContent = gameState.bestLevel;
                }
            }
            
            const config = window.PuzzleConfig.getDifficulty(gameState.level);

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
            
            // 图片加载超时处理
            const loadPromise = window.PuzzleCore.init(gameState.level, size.width, size.height, gameState.imageSeed);
            
            let initData = null;
            try {
                initData = await Promise.race([
                    loadPromise,
                    new Promise((resolve) => setTimeout(() => resolve(null), 15000))
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

        function getCanvasCoords(e) {
            const rect = canvas.getBoundingClientRect();
            if (e.touches && e.touches.length > 0) {
                return {
                    x: e.touches[0].clientX - rect.left,
                    y: e.touches[0].clientY - rect.top
                };
            }
            return {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        }

        function handleCanvasMouseDown(e) {
            if (!gameState.isPlaying || gameState.isComplete) return;

            const coords = getCanvasCoords(e);
            const piece = window.PuzzleCore.getPieceAt(coords.x, coords.y);

            if (piece && !piece.isLocked) {
                // 只选中，不开始拖拽
                gameState.selectedPiece = piece;
                gameState.dragStartX = coords.x;
                gameState.dragStartY = coords.y;
                window.PuzzleCore.selectPiece(piece.id);
                
                if (navigator.vibrate && e.type === 'touchstart') {
                    navigator.vibrate(10);
                }
            } else if (piece && piece.isLocked) {
                window.PuzzleCore.clearSelection();
                gameState.selectedPiece = null;
            }
        }

        function handleCanvasMouseMove(e) {
            const pieceToMove = gameState.currentPiece || gameState.selectedPiece;
            if (!pieceToMove || gameState.isComplete) return;

            const coords = getCanvasCoords(e);
            
            // 如果还没有开始拖拽，检查是否移动超过阈值
            if (!gameState.currentPiece && gameState.selectedPiece) {
                const dx = coords.x - gameState.dragStartX;
                const dy = coords.y - gameState.dragStartY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // 只有移动超过15px才开始拖拽（给双击留出空间）
                if (distance > 15) {
                    // 开始拖拽
                    gameState.currentPiece = gameState.selectedPiece;
                    gameState.dragOffset = {
                        x: coords.x - gameState.selectedPiece.currentX,
                        y: coords.y - gameState.selectedPiece.currentY
                    };
                    canvas.style.cursor = 'grabbing';
                }
            }
            
            // 如果已经开始拖拽
            if (gameState.currentPiece) {
                if (e.cancelable && e.type === 'touchmove') {
                    e.preventDefault();
                }

                window.PuzzleCore.movePiece(
                    gameState.currentPiece.id,
                    coords.x - gameState.dragOffset.x,
                    coords.y - gameState.dragOffset.y
                );
            }
        }

        function handleCanvasMouseUp(e) {
            // 处理拖拽结束
            if (gameState.currentPiece) {
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

                    if (result.isComplete) {
                        handleGameComplete();
                    }
                }

                gameState.currentPiece = null;
                gameState.selectedPiece = null;
                canvas.style.cursor = 'default';
            }
        }

        window._puzzleMouseDown = handleCanvasMouseDown;
        window._puzzleMouseMove = handleCanvasMouseMove;
        window._puzzleMouseUp = handleCanvasMouseUp;
        window._puzzleClick = handleCanvasClick;
        window._puzzleTouchStart = handleCanvasMouseDown;
        window._puzzleTouchMove = handleCanvasMouseMove;
        window._puzzleTouchEnd = handleCanvasMouseUp;

        canvas.addEventListener('mousedown', window._puzzleMouseDown);
        canvas.addEventListener('mousemove', window._puzzleMouseMove);
        canvas.addEventListener('mouseup', window._puzzleMouseUp);
        canvas.addEventListener('mouseleave', window._puzzleMouseUp);

        function handleCanvasClick(e) {
            if (!gameState.isPlaying || gameState.isComplete) return;

            const coords = getCanvasCoords(e);
            const piece = window.PuzzleCore.getPieceAt(coords.x, coords.y);

            if (piece && !piece.isLocked) {
                // 如果点击的是当前选中的碎片，则旋转
                if (gameState.selectedPiece && gameState.selectedPiece.id === piece.id) {
                    if (window.PuzzleCore.enableRotation) {
                        window.PuzzleCore.rotatePiece(piece.id, true);
                        if (navigator.vibrate) {
                            navigator.vibrate(5);
                        }
                    }
                } else {
                    // 否则选中该碎片
                    gameState.selectedPiece = piece;
                    window.PuzzleCore.selectPiece(piece.id);
                    if (navigator.vibrate) {
                        navigator.vibrate(10);
                    }
                }
            } else {
                // 点击空白区域或已锁定碎片，取消选中
                window.PuzzleCore.clearSelection();
                gameState.selectedPiece = null;
            }
        }

        canvas.addEventListener('dblclick', window._puzzleClick);

        canvas.addEventListener('touchstart', window._puzzleTouchStart, { passive: false });
        canvas.addEventListener('touchmove', window._puzzleTouchMove, { passive: false });
        canvas.addEventListener('touchend', window._puzzleTouchEnd);

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
        }
        
        // 清除选中状态
        if (window.PuzzleCore) {
            window.PuzzleCore.clearSelection();
        }
        
        // 重置游戏状态
        if (gameState) {
            gameState.isPlaying = false;
            gameState.isComplete = false;
            gameState.isFailed = false;
            gameState.currentPiece = null;
            gameState.selectedPiece = null;
            gameState.moveHistory = [];
            if (gameState.timerInterval) {
                clearInterval(gameState.timerInterval);
                gameState.timerInterval = null;
            }
        }
        
        // 清除 window 定时器
        if (window._puzzleTimer) {
            clearInterval(window._puzzleTimer);
            window._puzzleTimer = null;
        }
        
        // 移除事件监听
        const canvas = document.getElementById('game-canvas');
        if (canvas) {
            canvas.removeEventListener('mousedown', window._puzzleMouseDown);
            canvas.removeEventListener('mousemove', window._puzzleMouseMove);
            canvas.removeEventListener('mouseup', window._puzzleMouseUp);
            canvas.removeEventListener('mouseleave', window._puzzleMouseUp);
            canvas.removeEventListener('dblclick', window._puzzleClick);
            canvas.removeEventListener('touchstart', window._puzzleTouchStart);
            canvas.removeEventListener('touchmove', window._puzzleTouchMove);
            canvas.removeEventListener('touchend', window._puzzleTouchEnd);
        }
        
        // 清除 window 变量引用
        window._puzzleMouseDown = null;
        window._puzzleMouseMove = null;
        window._puzzleMouseUp = null;
        window._puzzleClick = null;
        window._puzzleTouchStart = null;
        window._puzzleTouchMove = null;
        window._puzzleTouchEnd = null;
        
        // 重新获取canvas并清除内容
        const currentCanvas = document.getElementById('game-canvas');
        if (currentCanvas) {
            const ctx = currentCanvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, currentCanvas.width, currentCanvas.height);
            }
        }
        
        // 允许重新初始化
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