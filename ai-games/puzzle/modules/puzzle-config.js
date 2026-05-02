'use strict';

(function() {
    if (window.PuzzleConfig) return;

    window.PuzzleConfig = {
        IMAGE_BASE_URL: 'https://picsum.photos',
        enableImageMode: true,

        DIFFICULTY: {
            1: { grid: 2, size: 4, hints: 6, rotation: true, time: 60 },
            2: { grid: 2, size: 4, hints: 6, rotation: true, time: 60 },
            3: { grid: 3, size: 9, hints: 5, rotation: true, time: 90 },
            4: { grid: 3, size: 9, hints: 5, rotation: true, time: 90 },
            5: { grid: 3, size: 9, hints: 4, rotation: true, time: 90 },
            6: { grid: 4, size: 16, hints: 5, rotation: true, time: 120 },
            7: { grid: 4, size: 16, hints: 4, rotation: true, time: 120 },
            8: { grid: 4, size: 16, hints: 3, rotation: true, time: 120 },
            9: { grid: 5, size: 25, hints: 4, rotation: true, time: 150 },
            10: { grid: 5, size: 25, hints: 4, rotation: true, time: 150 }
        },

        COLORS: {
            geometric: [
                '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
                '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
                '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1'
            ],
            abstract: [
                '#E74C3C', '#3498DB', '#2ECC71', '#F39C12',
                '#9B59B6', '#1ABC9C', '#E67E22', '#34495E',
                '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'
            ],
            background: '#1a1a2e',
            grid: '#4a6fa5',
            highlight: '#FFD700',
            success: '#00FF88'
        },

        ANIMATION: {
            rotateSpeed: 200,
            snapDistance: 30,
            particleCount: 20,
            completionDelay: 1500
        },

        AI: {
            cooldown: 3000,
            highlightDuration: 2000,
            animationSteps: 3
        },

        // 难度曲线配置 - 优先级2.3优化
        difficultyCurve: {
            timeGrowth: 'logarithmic',
            hintReduction: 'adaptive',
            timeCoefficient: 15,
            maxTime: 600
        },

        // 玩家表现数据 - 优先级2.3优化
        playerPerformance: {
            levels: {},
            recentWins: [],
            recentLosses: [],
            averageTime: 0,
            winStreak: 0,
            loseStreak: 0
        },

        getDifficulty(level) {
            const baseLevel = Math.min(Math.max(1, level), 10);
            const baseConfig = this.DIFFICULTY[baseLevel];
            
            if (level <= 10) {
                return baseConfig;
            }
            
            // 优先级2.3优化：对数增长的时间
            const config = this.getAdaptiveDifficulty(level, baseConfig);
            
            return config;
        },

        // 自适应难度计算 - 优先级2.3优化
        getAdaptiveDifficulty(level, baseConfig) {
            const curve = this.difficultyCurve;
            const perf = this.playerPerformance;
            
            // 对数增长的时间
            const logBase = Math.log(level - 9);
            const rawTimeBonus = logBase * curve.timeCoefficient;
            const timeBonus = Math.min(rawTimeBonus, curve.maxTime - baseConfig.time);
            
            // 基于玩家表现调整提示数量
            const hints = this.calculateAdaptiveHints(level, baseConfig);
            
            return {
                grid: baseConfig.grid,
                size: baseConfig.size,
                hints: hints,
                rotation: baseConfig.rotation,
                time: baseConfig.time + Math.floor(timeBonus)
            };
        },

        // 计算自适应提示数 - 优先级2.3优化
        calculateAdaptiveHints(level, baseConfig) {
            const perf = this.playerPerformance;
            const baseHints = baseConfig.hints;
            
            // 计算玩家技能水平
            const playerSkill = this.calculatePlayerSkill();
            
            let hintAdjustment = 0;
            
            if (playerSkill < 0.3) {
                hintAdjustment = Math.min(2, Math.floor((0.3 - playerSkill) * 10));
            } else if (playerSkill > 0.8) {
                hintAdjustment = -1;
            }
            
            // 基于连续胜率调整
            if (perf.winStreak >= 5) {
                hintAdjustment = Math.min(hintAdjustment, -1);
            } else if (perf.loseStreak >= 3) {
                hintAdjustment = Math.max(hintAdjustment, 1);
            }
            
            return Math.max(2, Math.min(8, baseHints + hintAdjustment));
        },

        // 计算玩家技能 - 优先级2.3优化
        calculatePlayerSkill() {
            const perf = this.playerPerformance;
            const { recentWins, recentLosses } = perf;
            
            const total = recentWins.length + recentLosses.length;
            if (total === 0) return 0.5;
            
            const winRate = recentWins.length / total;
            
            if (perf.averageTime === 0) return 0.5;
            
            const timeBonus = Math.min(1, perf.averageTime / 300);
            
            return winRate * 0.7 + timeBonus * 0.3;
        },

        // 记录关卡完成 - 优先级2.3优化
        recordLevelComplete(level, timeSeconds, success) {
            const perf = this.playerPerformance;
            
            if (success) {
                perf.recentWins.push({ level, time: timeSeconds, timestamp: Date.now() });
                perf.winStreak++;
                perf.loseStreak = 0;
                
                if (perf.recentWins.length > 20) {
                    perf.recentWins.shift();
                }
                
                if (perf.recentWins.length > 0) {
                    const sum = perf.recentWins.reduce((a, b) => a + b.time, 0);
                    perf.averageTime = sum / perf.recentWins.length;
                }
            } else {
                perf.recentLosses.push({ level, timestamp: Date.now() });
                perf.loseStreak++;
                perf.winStreak = 0;
                
                if (perf.recentLosses.length > 20) {
                    perf.recentLosses.shift();
                }
            }
        },

        // 获取当前难度信息 - 优先级2.3优化
        getDifficultyInfo(level) {
            const config = this.getDifficulty(level);
            const playerSkill = this.calculatePlayerSkill();
            
            return {
                level,
                ...config,
                playerSkill: playerSkill.toFixed(2),
                timeGrowth: 'logarithmic',
                averageTime: Math.round(this.playerPerformance.averageTime)
            };
        },

        // 保存玩家表现数据
        savePlayerPerformance() {
            try {
                localStorage.setItem('puzzle-player-performance', JSON.stringify(this.playerPerformance));
            } catch (e) {
                console.warn('[PuzzleConfig] 保存玩家表现失败');
            }
        },

        // 加载玩家表现数据
        loadPlayerPerformance() {
            try {
                const saved = localStorage.getItem('puzzle-player-performance');
                if (saved) {
                    const data = JSON.parse(saved);
                    Object.assign(this.playerPerformance, data);
                }
            } catch (e) {
                console.warn('[PuzzleConfig] 加载玩家表现失败');
            }
        },

        // 重置表现数据
        resetPerformance() {
            this.playerPerformance = {
                levels: {},
                recentWins: [],
                recentLosses: [],
                averageTime: 0,
                winStreak: 0,
                loseStreak: 0
            };
            this.savePlayerPerformance();
        },

        getColorPalette(isGeometric) {
            return isGeometric ? this.COLORS.geometric : this.COLORS.abstract;
        }
    };

    // 加载玩家表现数据
    window.PuzzleConfig.loadPlayerPerformance();

})();