// 五子棋核心游戏逻辑模块
// 负责棋盘状态管理、游戏规则、胜负判定

if (typeof window.GomokuBoard === 'undefined') {
    window.GomokuBoard = class GomokuBoard {
    constructor(size = 15) {
        console.log('[gomoku-board] GomokuBoard 构造函数, size:', size);
        
        // 棋子常量（必须在 createEmptyBoard 之前定义）
        this.BLACK = 1;
        this.WHITE = 2;
        this.EMPTY = 0;
        
        this.size = size;
        this.board = this.createEmptyBoard(size);
        
        // 验证棋盘是否为空
        let nonEmptyCount = 0;
        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                if (this.board[i][j] !== 0) nonEmptyCount++;
            }
        }
        console.log('[gomoku-board] 初始棋盘非空格子数:', nonEmptyCount);
        
        this.currentPlayer = 1; // 1: 黑棋, 2: 白棋
        this.gameOver = false;
        this.moveHistory = [];
    }
    
    createEmptyBoard(size) {
        const board = [];
        for (let i = 0; i < size; i++) {
            board[i] = [];
            for (let j = 0; j < size; j++) {
                board[i][j] = this.EMPTY;
            }
        }
        return board;
    }
    
    // 获取棋盘大小
    getSize() {
        return this.size;
    }
    
    // 获取当前玩家
    getCurrentPlayer() {
        return this.currentPlayer;
    }
    
    // 切换玩家
    switchPlayer() {
        this.currentPlayer = this.currentPlayer === this.BLACK ? this.WHITE : this.BLACK;
    }
    
    // 设置玩家
    setPlayer(player) {
        this.currentPlayer = player;
    }
    
    // 检查位置是否有效
    isValidMove(row, col) {
        return row >= 0 && row < this.size && 
               col >= 0 && col < this.size && 
               this.board[row][col] === this.EMPTY;
    }
    
    // 落子
    makeMove(row, col, player = null) {
        if (this.gameOver) return false;
        
        const movePlayer = player || this.currentPlayer;
        if (!this.isValidMove(row, col)) return false;
        
        this.board[row][col] = movePlayer;
        // 只存储位置，不存储完整棋盘，节省内存
        this.moveHistory.push({ row, col, player: movePlayer });
        
        // 检查是否获胜
        if (this.checkWin(row, col, movePlayer)) {
            this.gameOver = true;
            this.winner = movePlayer;
        } else if (this.isBoardFull()) {
            this.gameOver = true;
            this.winner = null; // 平局
        } else {
            // 切换玩家（如果未指定玩家）
            if (!player) {
                this.switchPlayer();
            }
        }
        
        return true;
    }
    
    // 悔棋 - 根据步数恢复棋盘
    undoMove(steps = 1) {
        if (this.moveHistory.length === 0) return false;
        
        // 限制最大撤销步数
        const undoCount = Math.min(steps, this.moveHistory.length);
        
        // 移除最后 N 步
        for (let i = 0; i < undoCount; i++) {
            if (this.moveHistory.length === 0) break;
            const lastMove = this.moveHistory.pop();
            this.board[lastMove.row][lastMove.col] = this.EMPTY;
        }
        
        // 恢复当前玩家
        if (this.moveHistory.length > 0) {
            const lastMove = this.moveHistory[this.moveHistory.length - 1];
            this.currentPlayer = lastMove.player === this.BLACK ? this.WHITE : this.BLACK;
        } else {
            this.currentPlayer = this.BLACK;
        }
        
        this.gameOver = false;
        this.winner = null;
        return true;
    }
    
    // 获取棋盘状态
    getBoard() {
        return this.board;
    }
    
    // 克隆棋盘（用于AI搜索）
    cloneBoard() {
        const newBoard = [];
        for (let i = 0; i < this.size; i++) {
            newBoard[i] = [...this.board[i]];
        }
        return newBoard;
    }
    
    // 检查棋盘是否已满
    isBoardFull() {
        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                if (this.board[i][j] === this.EMPTY) {
                    return false;
                }
            }
        }
        return true;
    }
    
    // 检查是否获胜
    checkWin(row, col, player) {
        const directions = [
            [[0, 1], [0, -1]],   // 水平
            [[1, 0], [-1, 0]],   // 垂直
            [[1, 1], [-1, -1]],  // 主对角线
            [[1, -1], [-1, 1]]   // 副对角线
        ];
        
        for (const [dir1, dir2] of directions) {
            let count = 1;
            
            // 正向检查
            let r = row + dir1[0];
            let c = col + dir1[1];
            while (r >= 0 && r < this.size && c >= 0 && c < this.size && 
                   this.board[r][c] === player) {
                count++;
                r += dir1[0];
                c += dir1[1];
            }
            
            // 反向检查
            r = row + dir2[0];
            c = col + dir2[1];
            while (r >= 0 && r < this.size && c >= 0 && c < this.size && 
                   this.board[r][c] === player) {
                count++;
                r += dir2[0];
                c += dir2[1];
            }
            
            if (count >= 5) return true;
        }
        
        return false;
    }
    
    // 获取游戏状态
    getGameState() {
        return {
            board: this.board,
            currentPlayer: this.currentPlayer,
            gameOver: this.gameOver,
            winner: this.winner,
            moveCount: this.moveHistory.length
        };
    }
    
    // 重置游戏
    reset(size = null) {
        if (size) this.size = size;
        this.board = this.createEmptyBoard(this.size);
        this.currentPlayer = this.BLACK;
        this.gameOver = false;
        this.winner = null;
        this.moveHistory = [];
    }
    
    // 获取空位数量
    getEmptyCount() {
        let count = 0;
        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                if (this.board[i][j] === this.EMPTY) count++;
            }
        }
        return count;
    }
    
    // 获取候选位置（用于AI搜索）
    getCandidateMoves(radius = 2, maxCount = 25) {
        const candidates = new Set();
        
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (this.board[r][c] !== this.EMPTY) {
                    // 在已有棋子周围搜索候选位置
                    for (let dr = -radius; dr <= radius; dr++) {
                        for (let dc = -radius; dc <= radius; dc++) {
                            const nr = r + dr;
                            const nc = c + dc;
                            if (nr >= 0 && nr < this.size && nc >= 0 && nc < this.size && 
                                this.board[nr][nc] === this.EMPTY) {
                                candidates.add(`${nr},${nc}`);
                            }
                        }
                    }
                }
            }
        }
        
        // 如果没有候选位置，返回中心点
        if (candidates.size === 0) {
            const center = Math.floor(this.size / 2);
            return [{ row: center, col: center }];
        }
        
        // 转换为数组并限制数量
        const moves = Array.from(candidates).map(key => {
            const [r, c] = key.split(',').map(Number);
            return { row: r, col: c };
        });
        
        return moves.slice(0, maxCount);
    }
}

} // 结束 GomokuBoard 定义