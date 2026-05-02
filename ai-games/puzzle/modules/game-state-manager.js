'use strict';

(function() {
    if (window.GameStateManager) return;

    window.GameStateManager = {
        // 统一状态存储
        state: {
            game: {
                isPlaying: false,
                isComplete: false,
                isFailed: false,
                level: 1,
                currentPiece: null,
                selectedPiece: null,
                dragOffset: { x: 0, y: 0 },
                dragStartX: 0,
                dragStartY: 0,
                bestLevel: 0,
                timeRemaining: 60,
                timerInterval: null,
                imageSeed: 0,
                moveHistory: [],
                maxHistorySize: 50
            },
            core: {
                pieces: [],
                completedPieces: 0,
                hintsRemaining: 0,
                gridSize: 2,
                enableRotation: false,
                selectedPieceId: null
            },
            ui: {
                timer: 60,
                bestLevel: 0,
                hints: 6
            }
        },

        // 观察者模式
        observers: new Map(),
        actionHistory: [],

        // 初始化
        init() {
            this.state.game.bestLevel = parseInt(localStorage.getItem('puzzle-best-level')) || 0;
            this.state.ui.bestLevel = this.state.game.bestLevel;
            console.log('[GameStateManager] 已初始化');
        },

        // 获取嵌套值
        getNestedValue(obj, path) {
            return path.split('.').reduce((acc, part) => acc && acc[part], obj);
        },

        // 设置嵌套值
        setNestedValue(obj, path, value) {
            const parts = path.split('.');
            const lastKey = parts.pop();
            const target = parts.reduce((acc, part) => {
                if (!acc[part]) acc[part] = {};
                return acc[part];
            }, obj);
            target[lastKey] = value;
        },

        // 状态获取
        get(path) {
            return this.getNestedValue(this.state, path);
        },

        // 状态设置
        set(path, value, options = {}) {
            const { action = 'UPDATE',silent = false } = options;
            const oldValue = this.get(path);
            this.setNestedValue(this.state, path, value);
            
            if (!silent) {
                this.notifyObservers(path, value, oldValue);
            }
            
            this.actionHistory.push({
                action,
                path,
                oldValue,
                newValue: value,
                timestamp: Date.now()
            });
            
            if (this.actionHistory.length > 200) {
                this.actionHistory.shift();
            }
        },

        // 批量设置状态
        setMulti(updates, options = {}) {
            Object.entries(updates).forEach(([path, value]) => {
                this.set(path, value, { ...options, silent: true });
            });
            this.notifyAllObservers();
        },

        // 订阅状态变化
        subscribe(path, callback) {
            if (!this.observers.has(path)) {
                this.observers.set(path, new Set());
            }
            this.observers.get(path).add(callback);
            
            return () => this.unsubscribe(path, callback);
        },

        // 取消订阅
        unsubscribe(path, callback) {
            const pathObservers = this.observers.get(path);
            if (pathObservers) {
                pathObservers.delete(callback);
            }
        },

        // 通知观察者
        notifyObservers(path, value, oldValue) {
            const pathObservers = this.observers.get(path);
            if (pathObservers) {
                pathObservers.forEach(callback => {
                    try {
                        callback(value, oldValue, path);
                    } catch (error) {
                        console.error(`[GameStateManager] 观察者错误: ${path}`, error);
                    }
                });
            }
            
            const wildcardObservers = this.observers.get('*');
            if (wildcardObservers) {
                wildcardObservers.forEach(callback => {
                    try {
                        callback(value, oldValue, path);
                    } catch (error) {
                        console.error('[GameStateManager] 通配符观察者错误:', error);
                    }
                });
            }
        },

        // 通知所有观察者
        notifyAllObservers() {
            this.observers.forEach((callbacks, path) => {
                if (path !== '*') {
                    const value = this.get(path);
                    callbacks.forEach(callback => {
                        try {
                            callback(value, undefined, path);
                        } catch (error) {
                            console.error(`[GameStateManager] 通知错误: ${path}`, error);
                        }
                    });
                }
            });
        },

        // 游戏状态快捷方法
        startGame(level = 1) {
            this.set('game.isPlaying', true);
            this.set('game.isComplete', false);
            this.set('game.isFailed', false);
            this.set('game.level', level);
            this.set('game.imageSeed', Date.now());
            this.set('game.moveHistory', []);
        },

        pauseGame() {
            this.set('game.isPlaying', false);
        },

        resumeGame() {
            if (!this.get('game.isComplete') && !this.get('game.isFailed')) {
                this.set('game.isPlaying', true);
            }
        },

        completeGame() {
            this.set('game.isPlaying', false);
            this.set('game.isComplete', true);
            
            const currentLevel = this.get('game.level');
            const bestLevel = this.get('game.bestLevel');
            
            if (currentLevel > bestLevel) {
                this.set('game.bestLevel', currentLevel);
                localStorage.setItem('puzzle-best-level', currentLevel);
                this.set('ui.bestLevel', currentLevel);
            }
        },

        failGame() {
            this.set('game.isPlaying', false);
            this.set('game.isFailed', true);
        },

        // 选择碎片
        selectPiece(pieceId) {
            this.set('game.selectedPiece', pieceId);
            this.set('core.selectedPieceId', pieceId);
        },

        clearSelection() {
            this.set('game.selectedPiece', null);
            this.set('core.selectedPieceId', null);
        },

        // 开始拖拽
        startDrag(pieceId, offsetX, offsetY) {
            this.set('game.currentPiece', pieceId);
            this.set('game.dragOffset', { x: offsetX, y: offsetY });
        },

        // 结束拖拽
        endDrag() {
            this.set('game.currentPiece', null);
            this.set('game.selectedPiece', null);
        },

        // 更新时间
        updateTimer(time) {
            this.set('game.timeRemaining', time);
            this.set('ui.timer', time);
        },

        // 更新提示数
        updateHints(count) {
            this.set('core.hintsRemaining', count);
            this.set('ui.hints', count);
        },

        // 添加移动历史
        addMoveHistory(pieceId, oldX, oldY) {
            const history = this.get('game.moveHistory') || [];
            history.push({
                pieceId,
                oldX,
                oldY,
                timestamp: Date.now()
            });
            
            const maxSize = this.get('game.maxHistorySize') || 50;
            if (history.length > maxSize) {
                history.shift();
            }
            
            this.set('game.moveHistory', history);
        },

        // 进度更新
        updateCoreProgress(completed, total, hints) {
            this.set('core.completedPieces', completed);
            this.set('core.hintsRemaining', hints);
        },

        // 获取游戏状态快照
        getSnapshot() {
            return {
                ...this.state,
                actionHistory: this.actionHistory.slice(-20)
            };
        },

        // 获取历史记录
        getHistory(count = 10) {
            return this.actionHistory.slice(-count);
        },

        // 导出状态（调试用）
        exportState() {
            return JSON.stringify(this.state, null, 2);
        },

        // 导入状态（调试用）
        importState(jsonString) {
            try {
                const imported = JSON.parse(jsonString);
                this.state = { ...this.state, ...imported };
                this.notifyAllObservers();
                return true;
            } catch (error) {
                console.error('[GameStateManager] 导入失败:', error);
                return false;
            }
        },

        // 重置状态
        reset() {
            this.state = {
                game: {
                    isPlaying: false,
                    isComplete: false,
                    isFailed: false,
                    level: 1,
                    currentPiece: null,
                    selectedPiece: null,
                    dragOffset: { x: 0, y: 0 },
                    dragStartX: 0,
                    dragStartY: 0,
                    bestLevel: this.state.game.bestLevel,
                    timeRemaining: 60,
                    timerInterval: null,
                    imageSeed: 0,
                    moveHistory: [],
                    maxHistorySize: 50
                },
                core: {
                    pieces: [],
                    completedPieces: 0,
                    hintsRemaining: 0,
                    gridSize: 2,
                    enableRotation: false,
                    selectedPieceId: null
                },
                ui: {
                    timer: 60,
                    bestLevel: this.state.ui.bestLevel,
                    hints: 6
                }
            };
            
            this.notifyAllObservers();
        },

        // 清理
        cleanup() {
            if (this.state.game.timerInterval) {
                clearInterval(this.state.game.timerInterval);
            }
            this.observers.clear();
            this.actionHistory = [];
        }
    };

    // 自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.GameStateManager.init());
    } else {
        window.GameStateManager.init();
    }

})();