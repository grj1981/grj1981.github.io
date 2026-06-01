// 五子棋UI模块
// 负责界面绘制、事件处理、用户交互

if (typeof window.GomokuUI === 'undefined') {
    window.GomokuUI = class GomokuUI {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            throw new Error(`找不到Canvas元素: ${canvasId}`);
        }
        
        this.ctx = this.canvas.getContext('2d');
        
        // 使用统一配置，合并自定义选项
        const defaultOptions = GomokuConfig.UI_CONFIG || {};
        this.options = {
            cellSize: defaultOptions.CELL_SIZE || 40,
            margin: defaultOptions.MARGIN || 20,
            mobileThreshold: defaultOptions.MOBILE_THRESHOLD || 500,
            canvasMaxSize: defaultOptions.CANVAS_MAX_SIZE || 300,
            windowPadding: defaultOptions.WINDOW_PADDING || 40,
            maxCanvasWidth: defaultOptions.MAX_CANVAS_WIDTH || 450,
            aiThinkingDelay: defaultOptions.AI_THINKING_DELAY || 50,
            ...options
        };
        
        // 引用统一配置
        this.colors = GomokuConfig.COLORS;
        this.boardConfig = GomokuConfig.BOARD_CONFIG;
        
        this.clickHandlers = [];
        this.resizeHandlers = [];
        this.isInitialized = false;
    }
    
    // 初始化UI
    init(boardSize = 15) {
        this.boardSize = boardSize;
        this.resizeCanvas();
        this.drawEmptyBoard();
        this.setupEventListeners();
        this.isInitialized = true;
    }
    
    // 调整画布大小
    resizeCanvas() {
        const maxSize = Math.min(
            window.innerWidth - this.options.windowPadding, 
            this.options.maxCanvasWidth
        );
        
        if (window.innerWidth <= this.options.mobileThreshold) {
            this.options.cellSize = Math.floor(
                (maxSize - this.options.margin * 2) / (this.boardSize - 1)
            );
        }
        
        const canvasSize = this.options.cellSize * (this.boardSize - 1) + this.options.margin * 2;
        this.canvas.width = canvasSize;
        this.canvas.height = canvasSize;
        this.canvas.style.width = Math.min(canvasSize, this.options.canvasMaxSize) + 'px';
        this.canvas.style.height = Math.min(canvasSize, this.options.canvasMaxSize) + 'px';
        
        // 触发调整大小事件
        this.triggerResize();
    }
    
    // 绘制空棋盘
    drawEmptyBoard() {
        this.ctx.fillStyle = this.colors.BOARD_BG;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.strokeStyle = this.colors.BOARD_LINE;
        this.ctx.lineWidth = 1;
        
        // 绘制网格线
        for (let i = 0; i < this.boardSize; i++) {
            // 水平线
            this.ctx.beginPath();
            this.ctx.moveTo(
                this.options.margin, 
                this.options.margin + i * this.options.cellSize
            );
            this.ctx.lineTo(
                this.options.margin + (this.boardSize - 1) * this.options.cellSize,
                this.options.margin + i * this.options.cellSize
            );
            this.ctx.stroke();
            
            // 垂直线
            this.ctx.beginPath();
            this.ctx.moveTo(
                this.options.margin + i * this.options.cellSize,
                this.options.margin
            );
            this.ctx.lineTo(
                this.options.margin + i * this.options.cellSize,
                this.options.margin + (this.boardSize - 1) * this.options.cellSize
            );
            this.ctx.stroke();
        }
        
        // 绘制星位点
        this.drawStarPoints();
    }
    
    // 绘制星位点
    drawStarPoints() {
        this.ctx.fillStyle = this.colors.BOARD_LINE;
        
        let starPoints = [];
        if (this.boardSize === 15) {
            starPoints = this.boardConfig.STAR_POINTS_15;
        } else if (this.boardSize === 13) {
            starPoints = this.boardConfig.STAR_POINTS_13;
        } else if (this.boardSize === 9) {
            starPoints = this.boardConfig.STAR_POINTS_9;
        }
        
        starPoints.forEach(([x, y]) => {
            this.ctx.beginPath();
            this.ctx.arc(
                this.options.margin + x * this.options.cellSize,
                this.options.margin + y * this.options.cellSize,
                this.boardConfig.STAR_POINT_RADIUS,
                0, Math.PI * 2
            );
            this.ctx.fill();
        });
    }
    
    // 绘制棋子
    drawPiece(row, col, player) {
        const cx = this.options.margin + col * this.options.cellSize;
        const cy = this.options.margin + row * this.options.cellSize;
        const radius = this.options.cellSize * this.boardConfig.PIECE_RADIUS_RATIO;
        
        // 创建渐变
        const gradient = this.ctx.createRadialGradient(
            cx - radius * this.boardConfig.GRADIENT_OFFSET_RATIO,
            cy - radius * this.boardConfig.GRADIENT_OFFSET_RATIO,
            radius * this.boardConfig.GRADIENT_INNER_RATIO,
            cx, cy, radius
        );
        
        if (player === 1) { // 黑棋
            gradient.addColorStop(0, this.colors.BLACK_PIECE_LIGHT);
            gradient.addColorStop(1, this.colors.BLACK_PIECE_DARK);
        } else { // 白棋
            gradient.addColorStop(0, this.colors.WHITE_PIECE_LIGHT);
            gradient.addColorStop(1, this.colors.WHITE_PIECE_DARK);
        }
        
        // 绘制棋子
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        this.ctx.fillStyle = gradient;
        this.ctx.fill();
        
        // 绘制边框
        this.ctx.strokeStyle = player === 1 ? this.colors.BLACK_STROKE : this.colors.WHITE_STROKE;
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
    }
    
    // 绘制整个棋盘状态
    drawBoard(board) {
        this.drawEmptyBoard();
        
        for (let row = 0; row < board.length; row++) {
            for (let col = 0; col < board[row].length; col++) {
                if (board[row][col] !== 0) {
                    this.drawPiece(row, col, board[row][col]);
                }
            }
        }
    }
    
    // 高亮显示最后一步
    highlightLastMove(row, col, player) {
        const cx = this.options.margin + col * this.options.cellSize;
        const cy = this.options.margin + row * this.options.cellSize;
        const radius = this.options.cellSize * 0.2;
        
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        this.ctx.fillStyle = player === 1 ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)';
        this.ctx.fill();
    }
    
    // 显示胜利连线
    showWinLine(startRow, startCol, endRow, endCol) {
        const startX = this.options.margin + startCol * this.options.cellSize;
        const startY = this.options.margin + startRow * this.options.cellSize;
        const endX = this.options.margin + endCol * this.options.cellSize;
        const endY = this.options.margin + endRow * this.options.cellSize;
        
        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(endX, endY);
        this.ctx.strokeStyle = 'rgba(255, 215, 0, 0.8)';
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
        this.ctx.lineWidth = 1;
    }
    
    // 获取棋盘位置（从屏幕坐标转换）
    getBoardPos(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;
        
        const col = Math.round((x - this.options.margin) / this.options.cellSize);
        const row = Math.round((y - this.options.margin) / this.options.cellSize);
        
        if (col >= 0 && col < this.boardSize && row >= 0 && row < this.boardSize) {
            return { row, col };
        }
        
        return null;
    }
    
    // 设置点击事件处理器
    onClick(handler) {
        const clickHandler = (e) => {
            const pos = this.getBoardPos(e.clientX, e.clientY);
            if (pos) {
                handler(pos.row, pos.col, e);
            }
        };
        
        this.canvas.addEventListener('click', clickHandler);
        this.clickHandlers.push(clickHandler);
    }
    
    // 设置触摸事件处理器
    onTouch(handler) {
        const touchHandler = (e) => {
            e.preventDefault();
            if (e.touches.length > 0) {
                const touch = e.touches[0];
                const pos = this.getBoardPos(touch.clientX, touch.clientY);
                if (pos) {
                    handler(pos.row, pos.col, e);
                }
            }
        };
        
        this.canvas.addEventListener('touchstart', touchHandler, { passive: false });
        this.clickHandlers.push(touchHandler);
    }
    
    // 设置调整大小事件处理器
    onResize(handler) {
        this.resizeHandlers.push(handler);
        
        const resizeHandler = () => {
            if (this.isInitialized) {
                this.resizeCanvas();
                handler();
            }
        };
        
        window.addEventListener('resize', resizeHandler);
    }
    
    // 触发调整大小事件
    triggerResize() {
        this.resizeHandlers.forEach(handler => handler());
    }
    
    // 设置事件监听器
    setupEventListeners() {
        // 阻止画布上的默认触摸行为
        this.canvas.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
        this.canvas.addEventListener('touchend', e => e.preventDefault(), { passive: false });
    }
    
    // 清理事件监听器
    cleanup() {
        this.clickHandlers.forEach(handler => {
            this.canvas.removeEventListener('click', handler);
            this.canvas.removeEventListener('touchstart', handler);
        });
        
        this.clickHandlers = [];
        this.resizeHandlers = [];
        this.isInitialized = false;
        
        // 清空画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    // 显示消息
    showMessage(message, type = 'info') {
        const display = document.getElementById('result-display');
        if (!display) return;
        
        display.textContent = message;
        display.className = '';
        
        if (type === 'success') {
            display.classList.add('win-text');
        } else if (type === 'warning') {
            display.classList.add('lose-text');
        } else if (type === 'info') {
            display.style.color = '#aaa';
        }
    }
    
    // 清除消息
    clearMessage() {
        const display = document.getElementById('result-display');
        if (!display) return;
        
        display.textContent = '';
        display.className = '';
        display.style.color = '';
    }
    
    // 更新回合指示器
    updateTurnIndicator(currentPlayer, playerColor) {
        const turnDot = document.getElementById('turn-dot');
        const turnText = document.getElementById('turn-text');
        if (!turnDot || !turnText) return;
        
        const isPlayerTurn = currentPlayer === playerColor;
        
        if (currentPlayer === 1) {
            turnDot.className = 'turn-dot black';
            turnText.textContent = isPlayerTurn ? '轮到: 黑方 (你)' : '轮到: 黑方 (AI)';
        } else {
            turnDot.className = 'turn-dot white';
            turnText.textContent = isPlayerTurn ? '轮到: 白方 (你)' : '轮到: 白方 (AI)';
        }
    }
    
    // 显示思考指示器
    showThinkingIndicator(show) {
        // 在实际应用中，这里可以显示加载动画
        if (show) {
            this.canvas.style.cursor = 'wait';
        } else {
            this.canvas.style.cursor = 'default';
        }
    }
    
    // 获取画布尺寸
    getCanvasSize() {
        return {
            width: this.canvas.width,
            height: this.canvas.height,
            cellSize: this.options.cellSize,
            margin: this.options.margin
        };
    }
    
    // 更新棋盘大小
    updateBoardSize(size) {
        this.boardSize = size;
        this.resizeCanvas();
        this.drawEmptyBoard();
    }
    
    // 设置颜色主题
    setColorTheme(theme) {
        const themes = {
            classic: {
                BOARD_BG: '#8B4513',
                BOARD_LINE: '#3d2314',
                BLACK_PIECE_LIGHT: '#555',
                BLACK_PIECE_DARK: '#111',
                WHITE_PIECE_LIGHT: '#fff',
                WHITE_PIECE_DARK: '#ddd',
                BLACK_STROKE: '#333',
                WHITE_STROKE: '#bbb'
            },
            modern: {
                BOARD_BG: '#E8D8B8',
                BOARD_LINE: '#5D4037',
                BLACK_PIECE_LIGHT: '#212121',
                BLACK_PIECE_DARK: '#000000',
                WHITE_PIECE_LIGHT: '#FAFAFA',
                WHITE_PIECE_DARK: '#E0E0E0',
                BLACK_STROKE: '#424242',
                WHITE_STROKE: '#9E9E9E'
            },
            dark: {
                BOARD_BG: '#2C3E50',
                BOARD_LINE: '#1A252F',
                BLACK_PIECE_LIGHT: '#34495E',
                BLACK_PIECE_DARK: '#2C3E50',
                WHITE_PIECE_LIGHT: '#ECF0F1',
                WHITE_PIECE_DARK: '#BDC3C7',
                BLACK_STROKE: '#7F8C8D',
                WHITE_STROKE: '#95A5A6'
            }
        };
        
        this.colors = themes[theme] || themes.classic;
        
        if (this.isInitialized) {
            this.drawEmptyBoard();
        }
    }
}

} // 结束 GomokuUI 定义