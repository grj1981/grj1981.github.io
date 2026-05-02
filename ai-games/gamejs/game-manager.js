// 游戏管理器 - 统一管理多个游戏的生命周期
// 解决游戏切换时的定时器残留、事件堆积问题

if (typeof window.GameManager === 'undefined') {
    window.GameManager = {
    currentGame: null,
    games: {},
    initialized: false,

    register(name, options) {
        const { init, cleanup, timerKey } = options;
        this.games[name] = {
            init,
            cleanup: cleanup || (() => {}),
            timerKey: timerKey || `_${name}Timer`
        };
    },

    initGame(name) {
        const game = this.games[name];
        if (!game) {
            console.error(`游戏 "${name}" 未注册`);
            return;
        }

        if (this.currentGame && this.currentGame !== name) {
            this.cleanupGame(this.currentGame);
        }

        this.currentGame = name;
        game.init();
        console.log(`游戏 "${name}" 已初始化`);
    },

    cleanupGame(name) {
        const game = this.games[name];
        if (!game) return;

        game.cleanup();

        if (window[game.timerKey]) {
            clearInterval(window[game.timerKey]);
            window[game.timerKey] = null;
        }

        this.removeAllGameEvents(name);
    },

    removeAllGameEvents(excludeGame) {
        const gameNames = Object.keys(this.games).filter(n => n !== excludeGame);

        gameNames.forEach(name => {
            const keyHandler = window[`_${name}KeyHandler`];
            const touchStart = window[`_${name}TouchStart`];
            const touchEnd = window[`_${name}TouchEnd`];
            const clickHandler = window[`_${name}Click`];
            const rightClickHandler = window[`_${name}RightClick`];

            if (keyHandler) {
                window.removeEventListener('keydown', keyHandler);
            }
            if (touchStart || touchEnd) {
                const canvas = document.getElementById('game-canvas');
                if (canvas) {
                    if (touchStart) canvas.removeEventListener('touchstart', touchStart);
                    if (touchEnd) canvas.removeEventListener('touchend', touchEnd);
                }
            }
            if (clickHandler || rightClickHandler) {
                const canvas = document.getElementById('game-canvas');
                if (canvas) {
                    if (clickHandler) canvas.removeEventListener('click', clickHandler);
                    if (rightClickHandler) canvas.removeEventListener('contextmenu', rightClickHandler);
                }
            }
        });
    },

    cleanupAll() {
        if (this.currentGame) {
            this.cleanupGame(this.currentGame);
            this.currentGame = null;
        }
    },

    detectGame() {
        const path = window.location.pathname;
        const canvas = document.getElementById('game-canvas');
        if (!canvas) return null;
        
        let gameName = null;
        if (path.includes('/snake/')) {
            gameName = 'snake';
        } else if (path.includes('/tetris/')) {
            gameName = 'tetris';
        } else if (path.includes('/minesweeper/')) {
            gameName = 'minesweeper';
        } else if (path.includes('/gomoku/')) {
            gameName = 'gomoku';
        } else if (path.includes('/puzzle/')) {
            gameName = 'puzzle';
        }
        
        return gameName;
    },

    init() {
        const self = this;
        
        function detectAndInit() {
            const gameName = self.detectGame();
            
            // 如果检测不到游戏但当前有游戏在运行，清理它
            if (!gameName && self.currentGame) {
                console.log('[GameManager] 离开游戏页面，清理游戏');
                self.cleanupAll();
                return;
            }
            
            if (!gameName) {
                return;
            }
            
            if (!self.games[gameName]) {
                // 游戏未注册，持续轮询等待，改为更长的间隔减少资源消耗
                setTimeout(detectAndInit, 200);
                return;
            }
            
            console.log('[GameManager] 初始化游戏:', gameName);
            self.initialized = true;
            self.initGame(gameName);
        }
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                setTimeout(detectAndInit, 50);
            });
        } else {
            setTimeout(detectAndInit, 50);
        }
        
        document.addEventListener('pjax:success', function() {
            self.initialized = false;
            setTimeout(detectAndInit, 100);
        });
    }
};

console.log('[game-manager] 脚本已加载');

document.addEventListener('pjax:before', function() {
    GameManager.cleanupAll();
});

GameManager.init();
}
