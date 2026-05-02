// 五子棋工具模块
// 负责通用工具函数、辅助功能

if (typeof window.GomokuUtils === 'undefined') {
    window.GomokuUtils = class GomokuUtils {
        constructor() {
            this.openingBook = this.initOpeningBook();
            this.DIFFICULTY = GomokuConfig.DIFFICULTY;
        }
        
        initOpeningBook() {
            return new Map([
                ['empty_15', { moves: [[7, 7]], name: '天元开局' }],
                ['empty_13', { moves: [[6, 6]], name: '中心开局' }],
                ['empty_9', { moves: [[4, 4]], name: '中心开局' }],
                ['tianyuan_1', { moves: [[7, 7], [6, 7]], name: '天元-小目' }],
                ['tianyuan_2', { moves: [[7, 7], [7, 6]], name: '天元-星位' }],
                ['star_1', { moves: [[3, 3], [3, 11]], name: '双星开局' }],
                ['star_2', { moves: [[3, 3], [11, 3]], name: '对角星' }]
            ]);
        }
        
        lookupOpening(board, size) {
            const boardKey = this.generateBoardKey(board);
            return this.openingBook.get(boardKey);
        }
        
        generateBoardKey(board) {
            let key = '';
            for (let row = 0; row < board.length; row++) {
                for (let col = 0; col < board[row].length; col++) {
                    key += board[row][col];
                }
                key += '|';
            }
            return key;
        }
        
        getSuggestedOpening(size, moveCount) {
            const sizeKey = `empty_${size}`;
            const opening = this.openingBook.get(sizeKey);
            if (opening && moveCount < opening.moves.length) {
                return opening.moves[moveCount];
            }
            return null;
        }
        
        generateZobristTable(size) {
            const table = [];
            for (let r = 0; r < size; r++) {
                table[r] = [];
                for (let c = 0; c < size; c++) {
                    table[r][c] = [this.random32(), this.random32(), this.random32()];
                }
            }
            return table;
        }
        
        random32() {
            return Math.floor(Math.random() * 0xFFFFFFFF);
        }
        
        calculateZobristHash(board, zobristTable) {
            let hash = 0;
            for (let r = 0; r < board.length; r++) {
                for (let c = 0; c < board[r].length; c++) {
                    const piece = board[r][c];
                    hash ^= zobristTable[r][c][piece];
                }
            }
            return hash;
        }
        
        updateZobristHash(hash, row, col, oldPiece, newPiece, zobristTable) {
            hash ^= zobristTable[row][col][oldPiece];
            hash ^= zobristTable[row][col][newPiece];
            return hash;
        }
        
        deepClone(obj) {
            if (obj === null || typeof obj !== 'object') return obj;
            if (Array.isArray(obj)) {
                return obj.map(item => this.deepClone(item));
            }
            const cloned = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    cloned[key] = this.deepClone(obj[key]);
                }
            }
            return cloned;
        }
        
        debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }
        
        throttle(func, limit) {
            let inThrottle;
            return function executedFunction(...args) {
                if (!inThrottle) {
                    func(...args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        }
        
        formatTime(ms) {
            if (ms < 1000) return `${ms}ms`;
            if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
            return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
        }
        
        formatNodes(nodes) {
            if (nodes < 1000) return nodes.toString();
            if (nodes < 1000000) return `${(nodes / 1000).toFixed(1)}K`;
            if (nodes < 1000000000) return `${(nodes / 1000000).toFixed(1)}M`;
            return `${(nodes / 1000000000).toFixed(1)}B`;
        }
        
        calculateWinRate(score, maxScore = 100000) {
            const normalized = Math.min(Math.max(score / maxScore, -1), 1);
            return 50 + 50 * normalized;
        }
        
        generateId() {
            return 'gomoku_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }
        
        saveGameState(state, key = 'gomoku_game_state') {
            try {
                localStorage.setItem(key, JSON.stringify(state));
                return true;
            } catch (error) {
                console.error('保存游戏状态失败:', error);
                return false;
            }
        }
        
        loadGameState(key = 'gomoku_game_state') {
            try {
                const data = localStorage.getItem(key);
                return data ? JSON.parse(data) : null;
            } catch (error) {
                console.error('加载游戏状态失败:', error);
                return null;
            }
        }
        
        clearGameState(key = 'gomoku_game_state') {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (error) {
                console.error('清除游戏状态失败:', error);
                return false;
            }
        }
        
        checkBrowserSupport() {
            const features = {
                canvas: !!window.HTMLCanvasElement,
                localStorage: !!window.localStorage,
                requestAnimationFrame: !!window.requestAnimationFrame
            };
            const optionalFeatures = { touchEvents: 'ontouchstart' in window };
            const unsupported = Object.entries(features)
                .filter(([_, supported]) => !supported)
                .map(([feature]) => feature);
            return { supported: unsupported.length === 0, unsupportedFeatures: unsupported, features, optionalFeatures };
        }
        
        createPerformanceTimer(name) {
            const startTime = performance.now();
            return {
                stop: () => {
                    const endTime = performance.now();
                    const duration = endTime - startTime;
                    console.log(`[性能] ${name}: ${duration.toFixed(2)}ms`);
                    return duration;
                },
                getElapsed: () => performance.now() - startTime
            };
        }
        
        convertCoordinates(row, col) {
            const letters = 'ABCDEFGHIJKLMNO';
            if (row >= 0 && row < letters.length && col >= 0 && col < 15) {
                return `${letters[row]}${col + 1}`;
            }
            return `${row + 1},${col + 1}`;
        }
        
        parseCoordinates(coord) {
            if (!coord) return null;
            const match1 = coord.match(/^([A-O])(\d+)$/i);
            if (match1) {
                const letter = match1[1].toUpperCase();
                const row = letter.charCodeAt(0) - 'A'.charCodeAt(0);
                const col = parseInt(match1[2]) - 1;
                return { row, col };
            }
            const match2 = coord.match(/^(\d+),(\d+)$/);
            if (match2) {
                const row = parseInt(match2[1]) - 1;
                const col = parseInt(match2[2]) - 1;
                return { row, col };
            }
            return null;
        }
        
        generateTestBoard(size = 15, pattern = 'empty') {
            const board = Array(size).fill().map(() => Array(size).fill(0));
            switch (pattern) {
                case 'center':
                    board[Math.floor(size / 2)][Math.floor(size / 2)] = 1;
                    break;
                case 'cross':
                    const mid = Math.floor(size / 2);
                    for (let i = 0; i < size; i++) {
                        board[mid][i] = i % 2 + 1;
                        board[i][mid] = (i + 1) % 2 + 1;
                    }
                    break;
                case 'diagonal':
                    for (let i = 0; i < size; i++) {
                        board[i][i] = i % 2 + 1;
                        board[i][size - 1 - i] = (i + 1) % 2 + 1;
                    }
                    break;
            }
            return board;
        }
        
        validateBoard(board) {
            if (!Array.isArray(board)) return false;
            const size = board.length;
            if (size < 9 || size > 19) return false;
            let blackCount = 0, whiteCount = 0;
            for (let row = 0; row < size; row++) {
                if (!Array.isArray(board[row]) || board[row].length !== size) return false;
                for (let col = 0; col < size; col++) {
                    const piece = board[row][col];
                    if (piece !== 0 && piece !== 1 && piece !== 2) return false;
                    if (piece === 1) blackCount++;
                    if (piece === 2) whiteCount++;
                }
            }
            const diff = blackCount - whiteCount;
            return diff === 0 || diff === 1;
        }
    };
}
