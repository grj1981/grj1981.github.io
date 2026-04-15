// 五子棋主入口模块
// 负责模块整合、游戏流程控制

if (typeof window.GomokuGame === 'undefined') {
    window.GomokuGame = class GomokuGame {
    constructor(options = {}) {
        console.log('[gomoku] GomokuGame 构造函数开始');
        
        this.options = {
            canvasId: 'game-canvas',
            difficulty: 'normal',
            playerColor: 1, // 1: 黑棋(先手), 2: 白棋(后手)
            enableUndo: true,
            enableHint: false,
            enableSound: true,
            autoSave: true,
            ...options
        };
        
        console.log('[gomoku] 棋盘大小:', this.getBoardSize());
        
        // 初始化模块
        this.board = new GomokuBoard(this.getBoardSize());
        console.log('[gomoku] GomokuBoard 创建完成，棋盘尺寸:', this.board.size);
        
        this.ai = new GomokuAI(this.options.difficulty);
        this.ui = new GomokuUI(this.options.canvasId);
        this.utils = new GomokuUtils();
        
        // 游戏状态
        this.state = {
            isPlaying: false,
            isThinking: false,
            gameResult: null,
            moveHistory: [],
            stats: {
                gamesPlayed: 0,
                gamesWon: 0,
                gamesLost: 0,
                gamesDrawn: 0,
                totalMoves: 0,
                totalTime: 0
            }
        };
        
        // 事件处理器
        this.eventHandlers = {
            onMove: null,
            onGameStart: null,
            onGameEnd: null,
            onAIThink: null,
            onError: null
        };
        
        // 初始化
        this.init();
    }
    
    // 初始化游戏
    init() {
        try {
            // 如果 UI 已初始化，只重置游戏状态
            if (this.ui.isInitialized) {
                console.log('[gomoku] UI已初始化，重置棋盘');
                this.board.reset(this.board.getSize());
                this.state.isPlaying = true;
                this.state.isThinking = false;
                this.state.gameResult = null;
                this.state.moveHistory = [];
                this.ui.clearMessage();
                this.ui.drawBoard(this.board.getBoard());
                this.ui.updateTurnIndicator(this.board.currentPlayer, this.options.playerColor);
                
                if (this.options.playerColor === 2) {
                    this.makeAIMove();
                }
                return;
            }
            
            // 初始化UI
            this.ui.init(this.board.getSize());
            
            // 设置事件监听器
            this.setupEventListeners();
            
            // 绘制初始棋盘
            this.ui.drawBoard(this.board.getBoard());
            this.ui.updateTurnIndicator(this.board.currentPlayer, this.options.playerColor);
            
            // 触发游戏开始事件
            this.triggerEvent('onGameStart', {
                difficulty: this.options.difficulty,
                boardSize: this.board.getSize(),
                playerColor: this.options.playerColor
            });
            
            this.state.isPlaying = true;
            
            // 如果玩家执白，AI先手
            if (this.options.playerColor === 2) {
                this.makeAIMove();
            }
            
            console.log('[gomoku] 游戏初始化完成');
        } catch (error) {
            console.error('[gomoku] 游戏初始化失败:', error);
            this.triggerEvent('onError', error);
        }
    }
    
    // 获取棋盘大小（根据难度）
    getBoardSize() {
        return GomokuConfig.DIFFICULTY[this.options.difficulty]?.size || 15;
    }
    
    // 设置事件监听器
    setupEventListeners() {
        // 玩家落子
        this.ui.onClick((row, col) => {
            if (!this.state.isPlaying || this.state.isThinking) return;
            this.makePlayerMove(row, col);
        });
        
        // 触摸事件
        this.ui.onTouch((row, col) => {
            if (!this.state.isPlaying || this.state.isThinking) return;
            this.makePlayerMove(row, col);
        });
        
        // 窗口调整大小
        this.ui.onResize(() => {
            this.ui.drawBoard(this.board.getBoard());
        });
    }
    
    // 玩家落子
    makePlayerMove(row, col) {
        if (!this.state.isPlaying || this.state.isThinking) return;
        
        const success = this.board.makeMove(row, col, this.options.playerColor);
        if (!success) return;
        
        // 更新UI
        this.ui.drawBoard(this.board.getBoard());
        this.board.switchPlayer();
        this.ui.updateTurnIndicator(this.board.currentPlayer, this.options.playerColor);
        
        // 记录移动
        this.recordMove(row, col, this.options.playerColor, 'player');
        
        // 触发移动事件
        this.triggerEvent('onMove', {
            row,
            col,
            player: this.options.playerColor,
            type: 'player',
            boardState: this.board.getBoard()
        });
        
        // 检查游戏是否结束
        if (this.board.gameOver) {
            this.handleGameEnd();
            return;
        }
        
        // AI思考
        this.makeAIMove();
    }
    
    // AI落子
    async makeAIMove() {
        if (!this.state.isPlaying || this.board.gameOver) return;
        
        this.state.isThinking = true;
        this.ui.showThinkingIndicator(true);
        
        // 触发AI思考事件
        this.triggerEvent('onAIThink', { startTime: Date.now() });
        
        try {
            // 添加延迟，模拟思考过程
            await this.delay(this.options.difficulty === 'easy' ? 300 : 500);
            
            // 寻找最佳着法
            const aiColor = this.options.playerColor === 1 ? 2 : 1;
            const boardState = this.board.getBoard();
            const bestMove = this.ai.findBestMove(boardState, aiColor);
            
            if (bestMove) {
                // 执行AI落子
                const success = this.board.makeMove(bestMove.row, bestMove.col, aiColor);
                
                if (success) {
                    // 更新UI
                    this.ui.drawBoard(this.board.getBoard());
                    this.board.switchPlayer();
                    this.ui.updateTurnIndicator(this.board.currentPlayer, this.options.playerColor);
                    
                    // 记录移动
                    this.recordMove(bestMove.row, bestMove.col, aiColor, 'ai');
                    
                    // 触发移动事件
                    this.triggerEvent('onMove', {
                        row: bestMove.row,
                        col: bestMove.col,
                        player: aiColor,
                        type: 'ai',
                        boardState: this.board.getBoard(),
                        aiStats: this.ai.getSearchStats()
                    });
                    
                    // 检查游戏是否结束
                    if (this.board.gameOver) {
                        this.handleGameEnd();
                    }
                }
            }
        } catch (error) {
            console.error('AI思考出错:', error);
            this.triggerEvent('onError', error);
        } finally {
            this.state.isThinking = false;
            this.ui.showThinkingIndicator(false);
        }
    }
    
    // 记录移动
    recordMove(row, col, player, type) {
        const move = {
            row,
            col,
            player,
            type,
            timestamp: Date.now(),
            boardState: this.utils.deepClone(this.board.getBoard())
        };
        
        this.state.moveHistory.push(move);
        this.state.stats.totalMoves++;
        
        // 自动保存
        if (this.options.autoSave) {
            this.saveGame();
        }
    }
    
    // 处理游戏结束
    handleGameEnd() {
        this.state.isPlaying = false;
        
        const gameResult = {
            winner: this.board.winner,
            isDraw: this.board.winner === null,
            moveCount: this.state.moveHistory.length,
            boardSize: this.board.getSize(),
            difficulty: this.options.difficulty,
            endTime: Date.now()
        };
        
        this.state.gameResult = gameResult;
        
        // 更新统计
        this.state.stats.gamesPlayed++;
        if (gameResult.isDraw) {
            this.state.stats.gamesDrawn++;
        } else if (gameResult.winner === this.options.playerColor) {
            this.state.stats.gamesWon++;
        } else {
            this.state.stats.gamesLost++;
        }
        
        // 显示结果
        this.showGameResult(gameResult);
        
        // 触发游戏结束事件
        this.triggerEvent('onGameEnd', gameResult);
        
        // 保存统计
        this.saveStats();
    }
    
    // 显示游戏结果
    showGameResult(result) {
        let message = '';
        
        if (result.isDraw) {
            message = '平局！';
        } else if (result.winner === this.options.playerColor) {
            message = '恭喜！你赢了！';
        } else {
            message = 'AI获胜，再接再厉！';
        }
        
        this.ui.showMessage(message, result.isDraw ? 'info' : (result.winner === this.options.playerColor ? 'success' : 'warning'));
        
        // 在实际应用中，这里可以显示更详细的结果信息
        console.log('游戏结束:', {
            result: message,
            moves: result.moveCount,
            difficulty: result.difficulty,
            boardSize: result.boardSize
        });
    }
    
    // 悔棋
    undo() {
        if (!this.options.enableUndo || this.state.isThinking || this.state.moveHistory.length < 2) {
            return false;
        }
        
        // 撤销最后两步（玩家一步 + AI一步）
        let undone = 0;
        while (undone < 2 && this.state.moveHistory.length > 0) {
            if (this.board.undoMove()) {
                undone++;
                this.state.moveHistory.pop();
            } else {
                break;
            }
        }
        
        if (undone > 0) {
            this.ui.drawBoard(this.board.getBoard());
            this.state.isPlaying = true;
            return true;
        }
        
        return false;
    }
    
    // 重新开始
    restart(difficulty = null) {
        if (difficulty) {
            this.options.difficulty = difficulty;
        }
        
        const newSize = this.getBoardSize();
        
        // 重置棋盘
        this.board.reset(newSize);
        
        // 重置AI
        this.ai.setDifficulty(this.options.difficulty);
        
        // 重置UI
        this.ui.clearMessage();
        this.ui.updateBoardSize(newSize);
        this.ui.drawBoard(this.board.getBoard());
        this.ui.updateTurnIndicator(this.board.currentPlayer, this.options.playerColor);
        
        // 重置状态
        this.state.isPlaying = true;
        this.state.isThinking = false;
        this.state.gameResult = null;
        this.state.moveHistory = [];
        
        // 触发游戏开始事件
        this.triggerEvent('onGameStart', {
            difficulty: this.options.difficulty,
            boardSize: newSize,
            playerColor: this.options.playerColor
        });
        
        // 如果玩家执白，AI先手
        if (this.options.playerColor === 2) {
            this.makeAIMove();
        }
        
        return true;
    }
    
    // 切换难度
    changeDifficulty(difficulty) {
        if (!['easy', 'normal', 'hard'].includes(difficulty)) {
            return false;
        }
        
        this.options.difficulty = difficulty;
        this.ai.setDifficulty(difficulty);
        
        // 直接重新开始
        this.restart(difficulty);
        
        return true;
    }
    
    // 切换玩家颜色
    changePlayerColor(color) {
        if (color !== 1 && color !== 2) return false;
        
        this.options.playerColor = color;
        
        // 如果游戏正在进行，重新开始
        if (this.state.isPlaying && !this.board.gameOver) {
            this.restart();
        }
        
        return true;
    }
    
    // 获取提示（AI建议）
    getHint() {
        if (!this.options.enableHint || this.state.isThinking || !this.state.isPlaying) {
            return null;
        }
        
        const boardState = this.board.getBoard();
        const hintMove = this.ai.findBestMove(boardState, this.options.playerColor);
        
        if (hintMove) {
            // 高亮显示提示位置
            this.ui.highlightLastMove(hintMove.row, hintMove.col, this.options.playerColor);
            
            // 3秒后清除高亮
            setTimeout(() => {
                this.ui.drawBoard(this.board.getBoard());
            }, 3000);
            
            return hintMove;
        }
        
        return null;
    }
    
    // 保存游戏
    saveGame() {
        const gameState = {
            board: this.board.getBoard(),
            currentPlayer: this.board.getCurrentPlayer(),
            moveHistory: this.state.moveHistory,
            difficulty: this.options.difficulty,
            playerColor: this.options.playerColor,
            timestamp: Date.now()
        };
        
        return this.utils.saveGameState(gameState, 'gomoku_current_game');
    }
    
    // 加载游戏
    loadGame() {
        const gameState = this.utils.loadGameState('gomoku_current_game');
        
        if (!gameState) return false;
        
        // 恢复棋盘
        this.board.board = gameState.board;
        this.board.currentPlayer = gameState.currentPlayer;
        this.board.gameOver = false;
        this.board.winner = null;
        
        // 恢复状态
        this.state.moveHistory = gameState.moveHistory || [];
        this.state.isPlaying = true;
        this.state.isThinking = false;
        this.state.gameResult = null;
        
        // 更新选项
        this.options.difficulty = gameState.difficulty || 'normal';
        this.options.playerColor = gameState.playerColor || 1;
        
        // 更新AI难度
        this.ai.setDifficulty(this.options.difficulty);
        
        // 更新UI
        this.ui.updateBoardSize(this.board.getSize());
        this.ui.drawBoard(this.board.getBoard());
        
        return true;
    }
    
    // 保存统计
    saveStats() {
        const stats = {
            ...this.state.stats,
            lastUpdate: Date.now()
        };
        
        return this.utils.saveGameState(stats, 'gomoku_stats');
    }
    
    // 加载统计
    loadStats() {
        const savedStats = this.utils.loadGameState('gomoku_stats');
        
        if (savedStats) {
            this.state.stats = { ...this.state.stats, ...savedStats };
            return true;
        }
        
        return false;
    }
    
    // 获取游戏信息
    getGameInfo() {
        return {
            state: {
                isPlaying: this.state.isPlaying,
                isThinking: this.state.isThinking,
                gameResult: this.state.gameResult,
                moveCount: this.state.moveHistory.length
            },
            board: {
                size: this.board.getSize(),
                currentPlayer: this.board.getCurrentPlayer(),
                gameOver: this.board.gameOver,
                winner: this.board.winner,
                emptyCount: this.board.getEmptyCount()
            },
            options: { ...this.options },
            stats: { ...this.state.stats }
        };
    }
    
    // 获取AI统计
    getAIStats() {
        return this.ai.getSearchStats();
    }
    
    // 设置事件处理器
    on(event, handler) {
        if (this.eventHandlers.hasOwnProperty(event)) {
            this.eventHandlers[event] = handler;
        }
    }
    
    // 触发事件
    triggerEvent(event, data) {
        if (this.eventHandlers[event]) {
            try {
                this.eventHandlers[event](data);
            } catch (error) {
                console.error(`事件处理器错误 (${event}):`, error);
            }
        }
    }
    
    // 延迟函数
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // 清理资源
    destroy() {
        this.ui.cleanup();
        this.state.isPlaying = false;
        
        // 清除所有事件处理器
        this.eventHandlers = {
            onMove: null,
            onGameStart: null,
            onGameEnd: null,
            onAIThink: null,
            onError: null
        };
    }
};

// 全局初始化函数
if (typeof window.initGomokuGame === 'undefined') {
    window.initGomokuGame = function initGomokuGame() {
        console.log('[gomoku] initGomokuGame() 被调用');
        
        // 检查必需模块
        const requiredModules = ['GomokuConfig', 'GomokuUtils', 'GomokuBoard', 'GomokuAI', 'GomokuUI', 'GomokuGame'];
        for (const name of requiredModules) {
            if (typeof window[name] === 'undefined') {
                console.error('[gomoku] 模块未加载:', name);
                return null;
            }
        }
        
        // 如果游戏实例存在，检查 canvas 是否仍然有效
        if (window.gomokuGame) {
            const ui = window.gomokuGame.ui;
            if (ui && ui.canvas && document.contains(ui.canvas)) {
                console.log('[gomoku] 游戏实例有效，调用 init()');
                window.gomokuGame.init();
                return window.gomokuGame;
            }
            console.log('[gomoku] 游戏实例的canvas已失效，重建游戏');
            window.gomokuGame = null;
        }
        
        try {
            const activeBtn = document.querySelector('.diff-btn.active');
            const difficulty = activeBtn ? activeBtn.dataset.diff : 'normal';
            
            const game = new GomokuGame({
                canvasId: 'game-canvas',
                difficulty: difficulty,
                playerColor: 1,
                enableUndo: true,
                enableHint: false,
                autoSave: false
            });
            
            window.gomokuGame = game;
            
            // 设置按钮事件
            document.querySelectorAll('.diff-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    game.changeDifficulty(btn.dataset.diff);
                });
            });
            
            const restartBtn = document.getElementById('restart-btn');
            if (restartBtn) {
                restartBtn.addEventListener('click', () => {
                    const activeDiff = document.querySelector('.diff-btn.active');
                    game.restart(activeDiff ? activeDiff.dataset.diff : null);
                });
            }
            
            const undoBtn = document.getElementById('undo-btn');
            if (undoBtn) {
                undoBtn.addEventListener('click', () => game.undo());
            }
            
            const hintBtn = document.getElementById('hint-btn');
            if (hintBtn) {
                hintBtn.addEventListener('click', () => game.getHint());
            }
            
            console.log('[gomoku] 游戏启动成功');
            return game;
        } catch (error) {
            console.error('[gomoku] 游戏启动失败:', error);
            return null;
        }
    };
}

// 注册到GameManager（让GameManager统一管理游戏生命周期）
function gomokuCleanup() {
    console.log('[gomoku] 清理游戏资源...');
    
    if (window.gomokuGame) {
        console.log('[gomoku] 销毁旧游戏实例');
        window.gomokuGame.destroy();
        window.gomokuGame = null;
    }
    
    try {
        localStorage.removeItem('gomoku_current_game');
    } catch (e) {
        console.log('[gomoku] localStorage清理失败');
    }
    
    console.log('[gomoku] 清理完成');
}

if (window.GameManager) {
    window.GameManager.register('gomoku', {
        init: initGomokuGame,
        cleanup: gomokuCleanup,
        timerKey: '_gomokuTimer'
    });
}

// 兼容 Node.js 模块系统
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GomokuGame, initGomokuGame };
}
}
