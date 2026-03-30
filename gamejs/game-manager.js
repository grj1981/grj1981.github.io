// 游戏管理器 - 统一管理多个游戏的生命周期
// 解决游戏切换时的定时器残留、事件堆积问题

const GameManager = {
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
        
        if (path.includes('/snake/')) {
            this.initGame('snake');
        } else if (path.includes('/tetris/')) {
            this.initGame('tetris');
        }
    },

    init() {
        if (this.initialized) return;
        this.initialized = true;

        const self = this;
        let retryCount = 0;
        const maxRetries = 50;

        function initGameWhenReady() {
            const canvas = document.getElementById('game-canvas');
            const startBtn = document.getElementById('start-btn');
            const restartBtn = document.getElementById('restart-btn');
            
            if (!canvas || !startBtn || !restartBtn) {
                if (retryCount < maxRetries) {
                    retryCount++;
                    setTimeout(initGameWhenReady, 100);
                }
                return;
            }
            
            self.detectGame();
        }

        function tryInit() {
            if (document.getElementById('game-canvas')) {
                initGameWhenReady();
            } else if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(tryInit, 100);
            }
        }

        if (document.readyState === 'complete') {
            setTimeout(tryInit, 50);
        } else {
            window.addEventListener('load', tryInit);
        }

        document.addEventListener('pjax:success', function() {
            retryCount = 0;
            setTimeout(function() {
                if (document.getElementById('game-canvas')) {
                    self.detectGame();
                }
            }, 100);
        });
    }
};

window.GameManager = GameManager;

document.addEventListener('pjax:before', function() {
    GameManager.cleanupAll();
});

GameManager.init();
