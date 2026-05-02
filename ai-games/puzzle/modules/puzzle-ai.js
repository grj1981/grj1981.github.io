'use strict';

(function() {
    if (window.PuzzleAI) return;

    window.PuzzleAI = {
        hintCooldown: false,
        
        // 玩家行为分析 - 优先级2.2优化
        playerBehavior: {
            totalHintsUsed: 0,
            successfulHints: 0,
            averageCompletionTime: 0,
            completionTimes: [],
            rotationAccuracy: 0,
            rotationAttempts: 0,
            successfulRotations: 0
        },
        
        // 评分权重 - 优先级2.2优化
        scoringWeights: {
            distance: 0.4,
            rotation: 0.3,
            position: 0.2,
            playerSkill: 0.1
        },

        init() {
            this.hintCooldown = false;
            this.loadPlayerBehavior();
        },

        // 加载玩家行为数据
        loadPlayerBehavior() {
            try {
                const saved = localStorage.getItem('puzzle-player-behavior');
                if (saved) {
                    const data = JSON.parse(saved);
                    Object.assign(this.playerBehavior, data);
                }
            } catch (e) {
                console.warn('[PuzzleAI] 加载玩家行为失败');
            }
        },

        // 保存玩家行为数据
        savePlayerBehavior() {
            try {
                localStorage.setItem('puzzle-player-behavior', JSON.stringify(this.playerBehavior));
            } catch (e) {
                console.warn('[PuzzleAI] 保存玩家行为失败');
            }
        },

        // 计算玩家技能水平 - 优先级2.2优化
        calculatePlayerSkill() {
            const { totalHintsUsed, successfulHints, averageCompletionTime } = this.playerBehavior;
            
            if (totalHintsUsed === 0) return 0.5;
            
            const hintSuccessRate = successfulHints / Math.max(totalHintsUsed, 1);
            const timeBonus = averageCompletionTime > 0 ? Math.max(0, 1 - averageCompletionTime / 300) : 0;
            
            return (hintSuccessRate * 0.6 + timeBonus * 0.4);
        },

        // 动态调整权重 - 优先级2.2优化
        adjustWeightsBasedOnPlayer() {
            const skill = this.calculatePlayerSkill();
            
            const weights = { ...this.scoringWeights };
            
            if (skill < 0.3) {
                weights.distance = 0.5;
                weights.rotation = 0.2;
                weights.playerSkill = 0.2;
            } else if (skill > 0.7) {
                weights.distance = 0.3;
                weights.rotation = 0.4;
                weights.playerSkill = 0.05;
            }
            
            return weights;
        },

        canUseHint(core) {
            if (this.hintCooldown) return false;
            if (core.hintsRemaining <= 0) return false;
            return true;
        },

        // 计算标准化距离 - 优先级2.2优化
        calculateNormalizedDistance(piece, core) {
            const canvasWidth = core.canvasWidth || 500;
            const canvasHeight = core.canvasHeight || 400;
            
            const distance = Math.sqrt(
                Math.pow(piece.currentX - piece.targetX, 2) +
                Math.pow(piece.currentY - piece.targetY, 2)
            );
            
            const maxDistance = Math.sqrt(canvasWidth * canvasWidth + canvasHeight * canvasHeight);
            
            return (distance / maxDistance) * 100;
        },

        // 计算旋转难度 - 优先级2.2优化
        calculateRotationDifficulty(piece, core) {
            if (!core.enableRotation || piece.rotation === piece.targetRotation) {
                return 0;
            }
            
            const rotationDiff = Math.abs(piece.rotation - piece.targetRotation);
            return rotationDiff / 90 * 50;
        },

        // 计算位置重要性 - 优先级2.2优化
        calculatePositionImportance(piece) {
            if (!piece.correctIndex && piece.correctIndex !== 0) {
                return 0;
            }
            
            const gridPositions = [
                [0, 0], [1, 0], [2, 0], [3, 0], [4, 0],
                [0, 1], [1, 1], [2, 1], [3, 1], [4, 1],
                [0, 2], [1, 2], [2, 2], [3, 2], [4, 2],
                [0, 3], [1, 3], [2, 3], [3, 3], [4, 3],
                [0, 4], [1, 4], [2, 4], [3, 4], [4, 4]
            ];
            
            const [row, col] = [Math.floor(piece.correctIndex / 5), piece.correctIndex % 5];
            const centerDist = Math.sqrt(Math.pow(row - 2, 2) + Math.pow(col - 2, 2));
            
            return centerDist * 5;
        },

        // 多因素评分 - 优先级2.2优化
        getBestHint(core) {
            if (!this.canUseHint(core)) return null;
            
            const unlockedPieces = core.pieces.filter(p => !p.isLocked);
            if (unlockedPieces.length === 0) return null;
            
            const weights = this.adjustWeightsBasedOnPlayer();
            
            let bestPiece = null;
            let bestScore = Infinity;
            
            unlockedPieces.forEach(piece => {
                const normalizedDistance = this.calculateNormalizedDistance(piece, core);
                const rotationDifficulty = this.calculateRotationDifficulty(piece, core);
                const positionScore = this.calculatePositionImportance(piece);
                
                let distanceScore = normalizedDistance * weights.distance;
                let rotationScore = rotationDifficulty * weights.rotation;
                let positionScoreWeighted = positionScore * weights.position;
                
                const totalScore = distanceScore + rotationScore + positionScoreWeighted;
                
                if (totalScore < bestScore) {
                    bestScore = totalScore;
                    bestPiece = piece;
                }
            });
            
            return bestPiece;
        },

        useHint(core, render) {
            const piece = this.getBestHint(core);
            
            if (!piece) return null;
            
            core.hintsRemaining--;
            
            this.playerBehavior.totalHintsUsed++;
            this.savePlayerBehavior();
            
            this.startCooldown();
            
            if (render && render.showHint) {
                render.showHint(piece);
            }
            
            return {
                piece: piece,
                hintsRemaining: core.hintsRemaining,
                targetX: piece.targetX,
                targetY: piece.targetY
            };
        },

        // 记录提示使用结果 - 优先级2.2优化
        recordHintResult(successful) {
            if (successful) {
                this.playerBehavior.successfulHints++;
            }
            this.savePlayerBehavior();
        },

        // 记录完成时间 - 优先级2.2优化
        recordCompletionTime(timeSeconds) {
            this.playerBehavior.completionTimes.push(timeSeconds);
            
            if (this.playerBehavior.completionTimes.length > 50) {
                this.playerBehavior.completionTimes.shift();
            }
            
            const sum = this.playerBehavior.completionTimes.reduce((a, b) => a + b, 0);
            this.playerBehavior.averageCompletionTime = sum / this.playerBehavior.completionTimes.length;
            
            this.savePlayerBehavior();
        },

        // 记录旋转结果 - 优先级2.2优化
        recordRotationResult(successful) {
            this.playerBehavior.rotationAttempts++;
            if (successful) {
                this.playerBehavior.successfulRotations++;
            }
            this.playerBehavior.rotationAccuracy = this.playerBehavior.successfulRotations / 
                Math.max(this.playerBehavior.rotationAttempts, 1);
            
            this.savePlayerBehavior();
        },

        // 获取玩家统计 - 优先级2.2优化
        getPlayerStats() {
            return {
                ...this.playerBehavior,
                skillLevel: this.calculatePlayerSkill(),
                averageCompletionTime: Math.round(this.playerBehavior.averageCompletionTime)
            };
        },

        // 重置统计数据
        resetStats() {
            this.playerBehavior = {
                totalHintsUsed: 0,
                successfulHints: 0,
                averageCompletionTime: 0,
                completionTimes: [],
                rotationAccuracy: 0,
                rotationAttempts: 0,
                successfulRotations: 0
            };
            this.savePlayerBehavior();
        },

        startCooldown() {
            this.hintCooldown = true;
            const cooldown = window.PuzzleConfig.AI.cooldown;
            
            setTimeout(() => {
                this.hintCooldown = false;
            }, cooldown);
        }
    };

})();