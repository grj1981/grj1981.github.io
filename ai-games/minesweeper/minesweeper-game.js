'use strict';

(function() {
    const DIFFICULTY = {
        easy: { cols: 9, rows: 9, mines: 10 },
        normal: { cols: 16, rows: 16, mines: 40 },
        hard: { cols: 30, rows: 16, mines: 99 }
    };
    
    const CELL_SIZE = 24;
    const COLORS = [
        '', '#0000ff', '#008000', '#ff0000', '#000080', '#800000', 
        '#008080', '#000000', '#808080'
    ];

    let currentDifficulty = 'easy';
    let COLS, ROWS, MINES;

    function initMinesweeperGame() {
        console.log('初始化扫雷游戏...');

        const canvas = document.getElementById('game-canvas');
        if (!canvas) {
            console.error('找不到 canvas 元素');
            return;
        }

        const ctx = canvas.getContext('2d');
        const scoreSpan = document.getElementById('score');
        const scoreTextSpan = document.getElementById('score-text');
        const timerSpan = document.getElementById('timer');
        const difficultySelect = document.getElementById('difficulty');
        const faceBtn = document.getElementById('face-btn');

        if (!ctx || !scoreSpan) {
            console.error('游戏初始化失败：元素未就绪');
            return;
        }

        if (difficultySelect) {
            difficultySelect.addEventListener('change', function() {
                currentDifficulty = this.value;
                startNewGame();
            });
        }

        function applyDifficulty() {
            const config = DIFFICULTY[currentDifficulty];
            COLS = config.cols;
            ROWS = config.rows;
            MINES = config.mines;
            canvas.width = COLS * CELL_SIZE;
            canvas.height = ROWS * CELL_SIZE;
        }

        applyDifficulty();

        let board = [];
        let revealed = [];
        let flagged = [];
        let minePos = [];
        let firstClick = true;
        let gameOver = false;
        let win = false;
        let mineCount = MINES;
        let revealCount = 0;
        let selectedCell = { x: -1, y: -1 };
        let timer = null;
        let timeElapsed = 0;

        function initBoard() {
            board = [];
            revealed = [];
            flagged = [];
            minePos = [];
            firstClick = true;
            gameOver = false;
            win = false;
            mineCount = MINES;
            revealCount = 0;
            selectedCell = { x: -1, y: -1 };
            timeElapsed = 0;

            for (let y = 0; y < ROWS; y++) {
                board[y] = [];
                revealed[y] = [];
                flagged[y] = [];
                for (let x = 0; x < COLS; x++) {
                    board[y][x] = 0;
                    revealed[y][x] = false;
                    flagged[y][x] = false;
                }
            }
        }

        function placeMines(excludeX, excludeY) {
            let placed = 0;
            let attempts = 0;
            const maxAttempts = COLS * ROWS * 10;
            
            while (placed < MINES && attempts < maxAttempts) {
                attempts++;
                const x = Math.floor(Math.random() * COLS);
                const y = Math.floor(Math.random() * ROWS);
                
                if (board[y][x] !== -1 && !(Math.abs(x - excludeX) <= 1 && Math.abs(y - excludeY) <= 1)) {
                    board[y][x] = -1;
                    minePos.push({ x, y });
                    placed++;
                }
            }

            for (let y = 0; y < ROWS; y++) {
                for (let x = 0; x < COLS; x++) {
                    if (board[y][x] !== -1) {
                        let count = 0;
                        for (let dy = -1; dy <= 1; dy++) {
                            for (let dx = -1; dx <= 1; dx++) {
                                if (dy === 0 && dx === 0) continue;
                                const ny = y + dy;
                                const nx = x + dx;
                                if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS && board[ny][nx] === -1) {
                                    count++;
                                }
                            }
                        }
                        board[y][x] = count;
                    }
                }
            }
        }

        function reveal(x, y) {
            if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return;
            if (revealed[y][x] || flagged[y][x]) return;

            revealed[y][x] = true;
            revealCount++;

            if (board[y][x] === -1) {
                gameOver = true;
                stopTimer();
                showAllMines(x, y);
                draw();
                updateFace('dead');
                return;
            }

            if (board[y][x] === 0) {
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dy !== 0 || dx !== 0) {
                            reveal(x + dx, y + dy);
                        }
                    }
                }
            }

            if (revealCount === COLS * ROWS - MINES) {
                win = true;
                gameOver = true;
                mineCount = 0;
                stopTimer();
                flagAllMines();
                draw();
                updateFace('win');
                return;
            }

            draw();
        }

        function showAllMines(clickedX, clickedY) {
            minePos.forEach(pos => {
                revealed[pos.y][pos.x] = true;
            });
        }

        function flagAllMines() {
            minePos.forEach(pos => {
                flagged[pos.y][pos.x] = true;
            });
        }

        function toggleFlag(x, y) {
            if (gameOver || revealed[y][x]) return;
            flagged[y][x] = !flagged[y][x];
            mineCount += flagged[y][x] ? -1 : 1;
            draw();
            updateScore();
        }

        function quickReveal(x, y) {
            if (!revealed[y][x] || board[y][x] <= 0) return;
            
            let flagCount = 0;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const ny = y + dy;
                    const nx = x + dx;
                    if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS && flagged[ny][nx]) {
                        flagCount++;
                    }
                }
            }

            if (flagCount === board[y][x]) {
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const ny = y + dy;
                        const nx = x + dx;
                        if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS && !revealed[ny][nx] && !flagged[ny][nx]) {
                            reveal(nx, ny);
                        }
                    }
                }
            }
        }

        function draw() {
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            for (let y = 0; y < ROWS; y++) {
                for (let x = 0; x < COLS; x++) {
                    const px = x * CELL_SIZE;
                    const py = y * CELL_SIZE;

                    if (revealed[y][x]) {
                        ctx.fillStyle = '#2d2d2d';
                        ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
                        ctx.strokeStyle = '#444';
                        ctx.strokeRect(px, py, CELL_SIZE, CELL_SIZE);

                        if (board[y][x] === -1) {
                            if (x === selectedCell.x && y === selectedCell.y) {
                                ctx.fillStyle = '#ff0000';
                                ctx.fillRect(px + 2, py + 2, CELL_SIZE - 4, CELL_SIZE - 4);
                            }
                            ctx.font = '14px Arial';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillText('💣', px + CELL_SIZE / 2, py + CELL_SIZE / 2 + 1);
                        } else if (board[y][x] > 0) {
                            ctx.fillStyle = COLORS[board[y][x]];
                            ctx.font = 'bold 12px Arial';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(board[y][x].toString(), px + CELL_SIZE / 2, py + CELL_SIZE / 2 + 1);
                        }
                    } else {
                        ctx.fillStyle = '#4a4a4a';
                        ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
                        
                        ctx.fillStyle = '#666';
                        ctx.fillRect(px, py, CELL_SIZE, 2);
                        ctx.fillRect(px, py, 2, CELL_SIZE);
                        ctx.fillStyle = '#333';
                        ctx.fillRect(px + CELL_SIZE - 2, py, 2, CELL_SIZE);
                        ctx.fillRect(px, py + CELL_SIZE - 2, CELL_SIZE, 2);

                        if (flagged[y][x]) {
                            ctx.font = '12px Arial';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillText('🚩', px + CELL_SIZE / 2, py + CELL_SIZE / 2 + 1);
                        }
                    }

                    if (x === selectedCell.x && y === selectedCell.y && !revealed[y][x] && !gameOver) {
                        ctx.strokeStyle = '#ff9800';
                        ctx.lineWidth = 2;
                        ctx.strokeRect(px + 1, py + 1, CELL_SIZE - 2, CELL_SIZE - 2);
                        ctx.lineWidth = 1;
                    }
                }
            }

            if (gameOver && win) {
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        }

        function updateScore() {
            scoreSpan.textContent = mineCount;
            if (scoreTextSpan) {
                scoreTextSpan.textContent = mineCount;
            }
        }

        function updateFace(state) {
            if (faceBtn) {
                if (state === 'win') {
                    faceBtn.textContent = '😊';
                } else if (state === 'dead') {
                    faceBtn.textContent = '😵';
                } else if (state === 'press') {
                    faceBtn.textContent = '😮';
                } else {
                    faceBtn.textContent = '😀';
                }
            }
        }

        function startTimer() {
            stopTimer();
            timeElapsed = 0;
            updateTimer();
            timer = setInterval(() => {
                timeElapsed++;
                if (timeElapsed > 999) timeElapsed = 999;
                updateTimer();
            }, 1000);
            window._minesweeperTimer = timer;
        }

        function stopTimer() {
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
            window._minesweeperTimer = null;
        }

        function updateTimer() {
            if (timerSpan) {
                timerSpan.textContent = timeElapsed.toString().padStart(3, '0');
            }
        }

        function startNewGame() {
            stopTimer();
            applyDifficulty();
            initBoard();
            updateScore();
            updateFace('normal');
            draw();
            console.log('新游戏, 难度: ' + currentDifficulty);
        }

        function handleClick(e) {
            if (gameOver) return;
            
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const x = Math.floor((e.clientX - rect.left) * scaleX / CELL_SIZE);
            const y = Math.floor((e.clientY - rect.top) * scaleY / CELL_SIZE);

            if (x >= 0 && x < COLS && y >= 0 && y < ROWS) {
                selectedCell = { x, y };
                
                if (firstClick) {
                    placeMines(x, y);
                    firstClick = false;
                    startTimer();
                }
                
                reveal(x, y);
            }
        }

        function handleRightClick(e) {
            if (gameOver) return;
            
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const x = Math.floor((e.clientX - rect.left) * scaleX / CELL_SIZE);
            const y = Math.floor((e.clientY - rect.top) * scaleY / CELL_SIZE);

            if (x >= 0 && x < COLS && y >= 0 && y < ROWS) {
                toggleFlag(x, y);
            }
        }

        function handleDblClick(e) {
            if (gameOver) return;
            
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const x = Math.floor((e.clientX - rect.left) * scaleX / CELL_SIZE);
            const y = Math.floor((e.clientY - rect.top) * scaleY / CELL_SIZE);

            if (x >= 0 && x < COLS && y >= 0 && y < ROWS) {
                quickReveal(x, y);
            }
        }

        function handleMouseDown(e) {
            if (gameOver || e.button !== 0) return;
            
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const x = Math.floor((e.clientX - rect.left) * scaleX / CELL_SIZE);
            const y = Math.floor((e.clientY - rect.top) * scaleY / CELL_SIZE);

            if (x >= 0 && x < COLS && y >= 0 && y < ROWS && !revealed[y][x]) {
                updateFace('press');
            }
        }

        function handleMouseUp(e) {
            if (gameOver) return;
            updateFace('normal');
        }

        function handleMouseLeave() {
            if (!gameOver) {
                selectedCell = { x: -1, y: -1 };
                draw();
            }
        }

        function handleMouseMove(e) {
            if (gameOver) return;
            
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const x = Math.floor((e.clientX - rect.left) * scaleX / CELL_SIZE);
            const y = Math.floor((e.clientY - rect.top) * scaleY / CELL_SIZE);

            if (x >= 0 && x < COLS && y >= 0 && y < ROWS && !revealed[y][x]) {
                if (selectedCell.x !== x || selectedCell.y !== y) {
                    selectedCell = { x, y };
                    draw();
                }
            } else if (selectedCell.x !== -1) {
                selectedCell = { x: -1, y: -1 };
                draw();
            }
        }

        let touchStartTime = 0;
        let touchStartPos = null;
        let lastTapCell = null;
        let lastTapTime = 0;

        function handleTouchStart(e) {
            if (gameOver) return;
            
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const touch = e.touches[0];
            const x = Math.floor((touch.clientX - rect.left) * scaleX / CELL_SIZE);
            const y = Math.floor((touch.clientY - rect.top) * scaleY / CELL_SIZE);

            if (x >= 0 && x < COLS && y >= 0 && y < ROWS) {
                touchStartTime = Date.now();
                touchStartPos = { x, y };
                selectedCell = { x, y };
                draw();
            }
        }

        function handleTouchMove(e) {
            if (gameOver || !touchStartPos) return;
            
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const touch = e.touches[0];
            const x = Math.floor((touch.clientX - rect.left) * scaleX / CELL_SIZE);
            const y = Math.floor((touch.clientY - rect.top) * scaleY / CELL_SIZE);

            if (x >= 0 && x < COLS && y >= 0 && y < ROWS) {
                if (selectedCell.x !== x || selectedCell.y !== y) {
                    selectedCell = { x, y };
                    draw();
                }
            }
        }

        function handleTouchEnd(e) {
            if (gameOver) return;
            
            e.preventDefault();
            if (!touchStartPos) return;

            const touchDuration = Date.now() - touchStartTime;
            const x = touchStartPos.x;
            const y = touchStartPos.y;
            
            if (touchDuration > 500) {
                toggleFlag(x, y);
            } else {
                const now = Date.now();
                if (lastTapCell && lastTapCell.x === x && lastTapCell.y === y && now - lastTapTime < 300) {
                    quickReveal(x, y);
                    lastTapCell = null;
                } else {
                    if (firstClick) {
                        placeMines(x, y);
                        firstClick = false;
                        startTimer();
                    }
                    reveal(x, y);
                    lastTapCell = { x, y };
                    lastTapTime = now;
                }
            }
            touchStartPos = null;
        }

        window._minesweeperTouchStart = handleTouchStart;
        window._minesweeperTouchMove = handleTouchMove;
        window._minesweeperTouchEnd = handleTouchEnd;
        window._minesweeperClick = handleClick;
        window._minesweeperDblClick = handleDblClick;
        window._minesweeperRightClick = handleRightClick;
        window._minesweeperMouseDown = handleMouseDown;
        window._minesweeperMouseUp = handleMouseUp;
        window._minesweeperMouseMove = handleMouseMove;
        window._minesweeperMouseLeave = handleMouseLeave;

        canvas.addEventListener('click', handleClick);
        canvas.addEventListener('dblclick', handleDblClick);
        canvas.addEventListener('contextmenu', handleRightClick);
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseleave', handleMouseLeave);
        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
        canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

        if (faceBtn) {
            faceBtn.onclick = startNewGame;
        }

        initBoard();
        updateScore();
        draw();
    }

    function cleanupMinesweeperGame() {
        console.log('清理扫雷游戏...');
        
        if (window._minesweeperTimer) {
            clearInterval(window._minesweeperTimer);
            window._minesweeperTimer = null;
        }

        const canvas = document.getElementById('game-canvas');
        if (canvas) {
            canvas.removeEventListener('click', window._minesweeperClick);
            canvas.removeEventListener('dblclick', window._minesweeperDblClick);
            canvas.removeEventListener('contextmenu', window._minesweeperRightClick);
            canvas.removeEventListener('mousedown', window._minesweeperMouseDown);
            canvas.removeEventListener('mouseup', window._minesweeperMouseUp);
            canvas.removeEventListener('mousemove', window._minesweeperMouseMove);
            canvas.removeEventListener('mouseleave', window._minesweeperMouseLeave);
            canvas.removeEventListener('touchstart', window._minesweeperTouchStart);
            canvas.removeEventListener('touchmove', window._minesweeperTouchMove);
            canvas.removeEventListener('touchend', window._minesweeperTouchEnd);
        }
    }

    if (window.GameManager) {
        window.GameManager.register('minesweeper', {
            init: initMinesweeperGame,
            cleanup: cleanupMinesweeperGame,
            timerKey: '_minesweeperTimer'
        });
    }

})();
