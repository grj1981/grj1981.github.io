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

        getDifficulty(level) {
            const baseLevel = Math.min(Math.max(1, level), 10);
            const baseConfig = this.DIFFICULTY[baseLevel];
            
            if (level <= 10) {
                return baseConfig;
            }
            
            // 11+ 关卡：保持5×5网格，优化时间压力，合理减少提示
            const timeBonus = (level - 10) * 10; // 每关增加10秒（原15秒）
            const hintReduction = Math.floor((level - 10) / 10); // 每10关减少1个提示（原5关）
            
            return {
                grid: baseConfig.grid,
                size: baseConfig.size,
                hints: Math.max(2, baseConfig.hints - hintReduction),
                rotation: baseConfig.rotation,
                time: baseConfig.time + timeBonus
            };
        },

        getColorPalette(isGeometric) {
            return isGeometric ? this.COLORS.geometric : this.COLORS.abstract;
        }
    };

})();