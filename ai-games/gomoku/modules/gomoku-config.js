// 五子棋统一配置模块
// 集中管理所有常量配置，消除重复定义

if (!window.GomokuConfig) {
    window.GomokuConfig = {
        // ============= 难度配置 =============
        DIFFICULTY: {
            easy: { 
                name: '简单', 
                depth: 3, 
                timeLimit: 3000, 
                skill: 1,
                useIterativeDeepening: false,
                useKillerHeuristic: false,
                useHistoryHeuristic: false
            },
            normal: { 
                name: '普通', 
                depth: 6, 
                timeLimit: 4000, 
                skill: 2,
                useIterativeDeepening: false,
                useKillerHeuristic: true,
                useHistoryHeuristic: true
            },
            hard: { 
                name: '困难', 
                depth: 12, 
                timeLimit: 8000, 
                skill: 3,
                useIterativeDeepening: true,
                useKillerHeuristic: true,
                useHistoryHeuristic: true
            }
        },

        // ============= 棋盘大小配置 =============
        BOARD_SIZES: [9, 13, 15],

        // ============= 游戏常量 =============
        DEFAULT_BOARD_SIZE: 15,

        // ============= 分数常量 =============
        SCORE: {
            FIVE: 1000000,
            OPEN_FOUR: 100000,
            FOUR: 50000,
            OPEN_THREE: 10000,
            SLEEP_THREE: 1000,
            OPEN_TWO: 500,
            SLEEP_TWO: 100,
            ONE: 10,
            ZERO: 0
        },

        // ============= 搜索配置 =============
        SEARCH_CONFIG: {
            CANDIDATE_LIMITS: {
                EASY: { maxCandidates: 15, searchCandidates: 10 },
                NORMAL: { maxCandidates: 25, searchCandidates: 16 },
                HARD: { maxCandidates: 35, searchCandidates: 25 }
            },
            DEFENSE_MULTIPLIERS: {
                EASY: 1.0,
                NORMAL: 0.7,
                HARD: 0.6
            },
            ATTACK_MULTIPLIERS: {
                EASY: 1.2,
                NORMAL: 1.2,
                HARD: 1.1
            },
            THREAT_SCORES: {
                IMMEDIATE_WIN: 2.0,
                BLOCK_THREAT: 1.8,
                ATTACK_THREAT: 1.5
            },
            NEIGHBOR_RANGE: {
                EASY: 2,
                NORMAL: 3,
                HARD: 4
            },
            CENTER_DISTANCE_PENALTY: 0.1
        },

        // ============= 置换表配置 =============
        TRANSPOSITION_CONFIG: {
            TABLE_SIZE: 500000,
            HASH_PRIME: 31,
            MAX_SIZE: 100000,
            FLAGS: {
                EXACT: 'EXACT',
                LOWER: 'LOWER',
                UPPER: 'UPPER'
            }
        },

        // ============= 模式匹配配置 =============
        PATTERN_CONFIG: {
            LINE_LENGTH: 9,
            PATTERN_TABLE_SIZE: 1 << 9
        },

        // ============= UI配置 =============
        UI_CONFIG: {
            CELL_SIZE: 40,
            MARGIN: 20,
            MOBILE_THRESHOLD: 500,
            WINDOW_PADDING: 40,
            MAX_CANVAS_WIDTH: 450,
            AI_THINKING_DELAY: 50
        },

        // ============= 颜色配置 =============
        COLORS: {
            BOARD_BG: '#8B4513',
            BOARD_LINE: '#3d2314',
            BLACK_PIECE_LIGHT: '#555',
            BLACK_PIECE_DARK: '#111',
            WHITE_PIECE_LIGHT: '#fff',
            WHITE_PIECE_DARK: '#ddd',
            BLACK_STROKE: '#333',
            WHITE_STROKE: '#bbb'
        },

        // ============= 棋盘配置 =============
        BOARD_CONFIG: {
            STAR_POINTS_15: [[3, 3], [3, 11], [7, 7], [11, 3], [11, 11]],
            STAR_POINTS_13: [[3, 3], [3, 9], [6, 6], [9, 3], [9, 9]],
            STAR_POINTS_9: [[2, 2], [2, 6], [4, 4], [6, 2], [6, 6]],
            STAR_POINT_RADIUS: 4,
            PIECE_RADIUS_RATIO: 0.4,
            GRADIENT_OFFSET_RATIO: 0.3,
            GRADIENT_INNER_RATIO: 0.1
        },

        // ============= 游戏常量 =============
        GAME: {
            BLACK: 1,
            WHITE: 2,
            EMPTY: 0
        },

        // ============= 辅助方法 =============
        
        // 根据难度级别获取配置
        getDifficulty(level) {
            return this.DIFFICULTY[level] || this.DIFFICULTY.normal;
        },

        // 获取分数常量
        getScore() {
            return { ...this.SCORE };
        },

        // 根据技能等级获取搜索配置
        getSearchConfig(skillLevel) {
            const levels = ['EASY', 'NORMAL', 'HARD'];
            const key = levels[skillLevel - 1] || levels[1];
            return {
                candidateLimits: this.SEARCH_CONFIG.CANDIDATE_LIMITS[key],
                defenseMultiplier: this.SEARCH_CONFIG.DEFENSE_MULTIPLIERS[key],
                threatScores: this.SEARCH_CONFIG.THREAT_SCORES
            };
        },

        // 获取防御乘数
        getDefenseMultiplier(skillLevel) {
            const levels = ['EASY', 'NORMAL', 'HARD'];
            const key = levels[skillLevel - 1] || levels[1];
            return this.SEARCH_CONFIG.DEFENSE_MULTIPLIERS[key];
        }
    };
}

// 兼容 Node.js 模块系统
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.GomokuConfig;
}
