// 俄罗斯方块游戏

(function() {
    function initTetrisGame() {
        console.log('初始化俄罗斯方块游戏...');

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

        const COLS = 12;
        const ROWS = 20;
        const CELL_SIZE = 20;
        const EMPTY = 0;
        
        const SHAPES = {
            I: { matrix: [[1,1,1,1]], color: '#00f5ff' },
            O: { matrix: [[1,1],[1,1]], color: '#ffeb3b' },
            T: { matrix: [[0,1,0],[1,1,1]], color: '#bf5af2' },
            S: { matrix: [[0,1,1],[1,1,0]], color: '#30d158' },
            Z: { matrix: [[1,1,0],[0,1,1]], color: '#ff375f' },
            J: { matrix: [[1,0,0],[1,1,1]], color: '#0a84ff' },
            L: { matrix: [[0,0,1],[1,1,1]], color: '#ff9f0a' }
        };
        const SHAPE_KEYS = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

        let board = [];
        let currentPiece = null;
        let currentX = 0;
        let currentY = 0;
        let score = 0;
        let gameOver = false;
        let timer = null;
        let dropInterval = 800;
        let speedTimer = null;

        function initBoard() {
            board = [];
            for (let r = 0; r < ROWS; r++) {
                board[r] = [];
                for (let c = 0; c < COLS; c++) {
                    board[r][c] = EMPTY;
                }
            }
        }

        function randomPiece() {
            const key = SHAPE_KEYS[Math.floor(Math.random() * SHAPE_KEYS.length)];
            const shape = SHAPES[key];
            return {
                matrix: shape.matrix.map(row => [...row]),
                color: shape.color
            };
        }

        function newPiece() {
            currentPiece = randomPiece();
            currentX = Math.floor((COLS - currentPiece.matrix[0].length) / 2);
            currentY = 0;

            if (checkCollision(currentPiece.matrix, currentX, currentY)) {
                gameOver = true;
                draw();
                if (timer) clearInterval(timer);
                timer = null;
                window._tetrisTimer = null;
            }
        }

        function checkCollision(matrix, x, y) {
            for (let r = 0; r < matrix.length; r++) {
                for (let c = 0; c < matrix[r].length; c++) {
                    if (matrix[r][c]) {
                        const newX = x + c;
                        const newY = y + r;
                        if (newX < 0 || newX >= COLS || newY >= ROWS) return true;
                        if (newY >= 0 && board[newY][newX]) return true;
                    }
                }
            }
            return false;
        }

        function rotate(matrix) {
            const rows = matrix.length;
            const cols = matrix[0].length;
            const rotated = [];
            for (let c = 0; c < cols; c++) {
                rotated[c] = [];
                for (let r = rows - 1; r >= 0; r--) {
                    rotated[c].push(matrix[r][c]);
                }
            }
            return rotated;
        }

        function moveRotate() {
            if (!currentPiece || gameOver) return;
            const rotated = rotate(currentPiece.matrix);
            if (!checkCollision(rotated, currentX, currentY)) {
                currentPiece.matrix = rotated;
                draw();
            }
        }

        function move(dx, dy) {
            if (!currentPiece || gameOver) return;
            if (!checkCollision(currentPiece.matrix, currentX + dx, currentY + dy)) {
                currentX += dx;
                currentY += dy;
                return true;
            }
            return false;
        }

        function lockPiece() {
            for (let r = 0; r < currentPiece.matrix.length; r++) {
                for (let c = 0; c < currentPiece.matrix[r].length; c++) {
                    if (currentPiece.matrix[r][c]) {
                        const y = currentY + r;
                        const x = currentX + c;
                        if (y >= 0 && y < ROWS && x >= 0 && x < COLS) {
                            board[y][x] = currentPiece.color;
                        }
                    }
                }
            }
            clearLines();
            newPiece();
        }

        function clearLines() {
            let linesCleared = 0;
            for (let r = ROWS - 1; r >= 0; r--) {
                let full = true;
                for (let c = 0; c < COLS; c++) {
                    if (!board[r][c]) {
                        full = false;
                        break;
                    }
                }
                if (full) {
                    board.splice(r, 1);
                    board.unshift(new Array(COLS).fill(EMPTY));
                    linesCleared++;
                    r++;
                }
            }
            if (linesCleared > 0) {
                score += linesCleared * 100 * linesCleared;
                scoreSpan.textContent = score;
                dropInterval = Math.max(100, 800 - Math.floor(score / 500) * 80);
            }
        }

        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#000';
            ctx.strokeStyle = '#222';
            ctx.textAlign = 'left';

            ctx.strokeStyle = '#222';
            ctx.lineWidth = 0.5;
            for (let i = 0; i <= COLS; i++) {
                ctx.beginPath();
                ctx.moveTo(i * CELL_SIZE, 0);
                ctx.lineTo(i * CELL_SIZE, canvas.height);
                ctx.stroke();
            }
            for (let i = 0; i <= ROWS; i++) {
                ctx.beginPath();
                ctx.moveTo(0, i * CELL_SIZE);
                ctx.lineTo(canvas.width, i * CELL_SIZE);
                ctx.stroke();
            }

            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    if (board[r][c]) {
                        ctx.fillStyle = board[r][c];
                        ctx.fillRect(c * CELL_SIZE + 1, r * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
                    }
                }
            }

            if (currentPiece && !gameOver) {
                for (let r = 0; r < currentPiece.matrix.length; r++) {
                    for (let c = 0; c < currentPiece.matrix[r].length; c++) {
                        if (currentPiece.matrix[r][c]) {
                            const y = currentY + r;
                            const x = currentX + c;
                            if (y >= 0) {
                                ctx.fillStyle = currentPiece.color;
                                ctx.fillRect(x * CELL_SIZE + 1, y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
                            }
                        }
                    }
                }
            }

            if (gameOver) {
                ctx.fillStyle = 'rgba(0,0,0,0.7)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 20px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('游戏结束', canvas.width / 2, canvas.height / 2 - 15);
                ctx.font = '16px sans-serif';
                ctx.fillText(`最终得分: ${score}`, canvas.width / 2, canvas.height / 2 + 15);
                ctx.fillText('点击"新一局"', canvas.width / 2, canvas.height / 2 + 45);
            }
        }

        function drop() {
            if (gameOver) return;
            if (!move(0, 1)) {
                lockPiece();
            }
            draw();
        }

        function reset() {
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
            if (speedTimer) {
                clearInterval(speedTimer);
                speedTimer = null;
            }
            window._tetrisTimer = null;
            gameStarted = false;

            initBoard();
            score = 0;
            gameOver = false;
            dropInterval = 800;
            scoreSpan.textContent = '0';
            newPiece();
            draw();
            console.log('游戏已重置');
        }

        function start() {
            if (gameOver) return;
            if (timer) return;
            gameStarted = true;
            timer = setInterval(drop, dropInterval);
            window._tetrisTimer = timer;
            
            let lastScore = 0;
            speedTimer = setInterval(() => {
                if (score !== lastScore) {
                    if (timer) {
                        clearInterval(timer);
                        timer = setInterval(drop, dropInterval);
                        window._tetrisTimer = timer;
                    }
                    lastScore = score;
                }
            }, 100);
            
            console.log('游戏开始');
        }

        function handleKeydown(e) {
            if (e.key.startsWith('Arrow')) e.preventDefault();
            if (gameOver) return;
            if (!timer) return;
            
            switch (e.key) {
                case 'ArrowUp': moveRotate(); break;
                case 'ArrowLeft': move(-1, 0); draw(); break;
                case 'ArrowRight': move(1, 0); draw(); break;
                case 'ArrowDown': 
                    if (timer) {
                        while (move(0, 1)) {} 
                        lockPiece();
                        draw();
                    }
                    break;
            }
        }
        window._tetrisKeyHandler = handleKeydown;

        let touchStartX = 0;
        let touchStartY = 0;

        let gameStarted = false;

        const tetrisTouchStart = function(e) {
            if (!gameStarted) return;
            e.preventDefault();
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        };

        const tetrisTouchEnd = function(e) {
            if (!gameStarted) return;
            e.preventDefault();
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            
            const deltaX = touchEndX - touchStartX;
            const deltaY = touchEndY - touchStartY;
            const minSwipe = 30;
            
            if (Math.abs(deltaX) > minSwipe || Math.abs(deltaY) > minSwipe) {
                if (Math.abs(deltaX) > Math.abs(deltaY)) {
                    if (deltaX > 0) move(1, 0);
                    else move(-1, 0);
                } else {
                    if (deltaY > 0) {
                        while (move(0, 1)) {}
                        lockPiece();
                    } else {
                        moveRotate();
                    }
                }
                draw();
            }
        };

        window._tetrisTouchStart = tetrisTouchStart;
        window._tetrisTouchEnd = tetrisTouchEnd;

        canvas.addEventListener('touchstart', tetrisTouchStart, { passive: false });
        canvas.addEventListener('touchend', tetrisTouchEnd, { passive: false });
        window.addEventListener('keydown', handleKeydown);

        restartBtn.onclick = reset;
        startBtn.onclick = start;

        reset();
    }

    function cleanupTetrisGame() {
        console.log('清理俄罗斯方块游戏...');
        
        if (window._tetrisTimer) {
            clearInterval(window._tetrisTimer);
            window._tetrisTimer = null;
        }
        
        gameStarted = false;

        const canvas = document.getElementById('game-canvas');
        if (canvas) {
            canvas.removeEventListener('touchstart', window._tetrisTouchStart);
            canvas.removeEventListener('touchend', window._tetrisTouchEnd);
        }
        window.removeEventListener('keydown', window._tetrisKeyHandler);
    }

    if (window.GameManager) {
        window.GameManager.register('tetris', {
            init: initTetrisGame,
            cleanup: cleanupTetrisGame,
            timerKey: '_tetrisTimer'
        });
    }

})();
