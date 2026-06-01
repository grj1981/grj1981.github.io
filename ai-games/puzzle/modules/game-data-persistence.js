'use strict';

(function() {
    if (window.GameDataPersistence) return;

    window.GameDataPersistence = {
        STORAGE_KEY: 'puzzle-game-data',
        
        // 默认数据结构
        defaultData: {
            playerProfile: {
                id: null,
                name: 'Player',
                level: 1,
                totalGames: 0,
                totalWins: 0,
                totalLosses: 0,
                createdAt: Date.now()
            },
            gameStatistics: {
                totalPlayTime: 0,
                averageCompletionTime: 0,
                bestTime: null,
                averageHintsUsed: 0,
                rotationAccuracy: 0,
                totalHintsUsed: 0,
                totalRotations: 0
            },
            levelProgress: {
                completedLevels: [],
                currentBest: 0,
                levelStats: {}
            },
            achievements: {
                unlocked: [],
                progress: {}
            },
            preferences: {
                difficulty: 'normal',
                hintsEnabled: true,
                soundEnabled: true,
                theme: 'geometric'
            }
        },

        data: null,

        // 初始化
        init() {
            this.load();
            console.log('[GameDataPersistence] 已初始化');
        },

        // 加载数据
        load() {
            try {
                const saved = localStorage.getItem(this.STORAGE_KEY);
                if (saved) {
                    this.data = { ...this.defaultData, ...JSON.parse(saved) };
                } else {
                    this.data = { ...this.defaultData };
                    this.data.playerProfile.id = this.generatePlayerId();
                }
            } catch (e) {
                console.error('[GameDataPersistence] 加载失败:', e);
                this.data = { ...this.defaultData };
                this.data.playerProfile.id = this.generatePlayerId();
            }
        },

        // 保存数据
        save() {
            try {
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
            } catch (e) {
                console.error('[GameDataPersistence] 保存失败:', e);
            }
        },

        // 生成玩家ID
        generatePlayerId() {
            return 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        },

        // 更新游戏会话
        saveGameSession(session) {
            const { level, completed, timeUsed, hintsUsed, rotationCount, successfulRotations } = session;
            
            this.data.playerProfile.totalGames++;
            this.data.gameStatistics.totalPlayTime += (timeUsed || 0);
            
            if (completed) {
                this.data.playerProfile.totalWins++;
                this.updateLevelProgress(level, timeUsed, completed);
                this.unlockAchievement('first_win');
                
                if (!this.data.gameStatistics.bestTime || timeUsed < this.data.gameStatistics.bestTime) {
                    this.data.gameStatistics.bestTime = timeUsed;
                    this.unlockAchievement('speed_demon');
                }
            } else {
                this.data.playerProfile.totalLosses++;
            }
            
            if (hintsUsed !== undefined) {
                this.data.gameStatistics.totalHintsUsed += hintsUsed;
                this.data.gameStatistics.averageHintsUsed = this.data.gameStatistics.totalHintsUsed / 
                    Math.max(this.data.playerProfile.totalGames, 1);
            }
            
            if (rotationCount > 0) {
                this.data.gameStatistics.totalRotations += rotationCount;
                this.data.gameStatistics.rotationAccuracy = successfulRotations / rotationCount;
            }
            
            if (this.data.playerProfile.totalGames % 10 === 0) {
                this.unlockAchievement('veteran');
            }
            
            const avgTime = this.calculateAverageTime();
            this.data.gameStatistics.averageCompletionTime = avgTime;
            
            this.save();
        },

        // 更新关卡进度
        updateLevelProgress(level, timeUsed, completed) {
            const { completedLevels, levelStats, currentBest } = this.data.levelProgress;
            
            if (!completedLevels.includes(level)) {
                completedLevels.push(level);
                completedLevels.sort((a, b) => a - b);
            }
            
            if (!levelStats[level]) {
                levelStats[level] = {
                    attempts: 0,
                    wins: 0,
                    bestTime: null,
                    totalTime: 0
                };
            }
            
            const stats = levelStats[level];
            stats.attempts++;
            
            if (completed) {
                stats.wins++;
                
                if (!stats.bestTime || timeUsed < stats.bestTime) {
                    stats.bestTime = timeUsed;
                }
                
                stats.totalTime += timeUsed;
            }
            
            if (level > currentBest) {
                this.data.levelProgress.currentBest = level;
            }
        },

        // 计算平均完成时间
        calculateAverageTime() {
            const wins = Object.values(this.data.levelProgress.levelStats)
                .filter(s => s.wins > 0);
            
            if (wins.length === 0) return 0;
            
            const total = wins.reduce((sum, s) => sum + s.totalTime, 0);
            const winCount = wins.reduce((sum, s) => sum + s.wins, 0);
            
            return winCount > 0 ? Math.round(total / winCount) : 0;
        },

        // 解锁成就
        unlockAchievement(achievementId) {
            const { achievements } = this.data;
            
            if (!achievements.unlocked.includes(achievementId)) {
                achievements.unlocked.push(achievementId);
                console.log(`[GameDataPersistence] 解锁成就: ${achievementId}`);
                
                return true;
            }
            
            return false;
        },

        // 更新成就进度
        updateAchievementProgress(achievementId, progress) {
            this.data.achievements.progress[achievementId] = progress;
        },

        // 更新设置
        updatePreferences(preferences) {
            this.data.preferences = { ...this.data.preferences, ...preferences };
            this.save();
        },

        // 获取玩家资料
        getPlayerProfile() {
            return { ...this.data.playerProfile };
        },

        // 获取统计数据
        getStatistics() {
            const stats = { ...this.data.gameStatistics };
            stats.winRate = stats.totalGames > 0 
                ? Math.round(stats.totalWins / stats.totalGames * 100) 
                : 0;
            return stats;
        },

        // 获取关卡进度
        getLevelProgress() {
            return {
                ...this.data.levelProgress,
                totalCompleted: this.data.levelProgress.completedLevels.length
            };
        },

        // 获取成就列表
        getAchievements() {
            return {
                unlocked: [...this.data.achievements.unlocked],
                progress: { ...this.data.achievements.progress }
            };
        },

        // 获取设置
        getPreferences() {
            return { ...this.data.preferences };
        },

        // 获取完整数据（用于调试）
        getFullData() {
            return JSON.parse(JSON.stringify(this.data));
        },

        // 导出数据
        exportData() {
            const dataStr = JSON.stringify(this.data, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `puzzle-save-${Date.now()}.json`;
            a.click();
            
            URL.revokeObjectURL(url);
        },

        // 导入数据
        importData(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                
                reader.onload = (e) => {
                    try {
                        const imported = JSON.parse(e.target.result);
                        this.data = { ...this.defaultData, ...imported };
                        this.save();
                        resolve(true);
                    } catch (error) {
                        reject(error);
                    }
                };
                
                reader.onerror = reject;
                reader.readAsText(file);
            });
        },

        // 重置数据
        reset() {
            this.data = { ...this.defaultData };
            this.data.playerProfile.id = this.generatePlayerId();
            this.save();
            console.log('[GameDataPersistence] 数据已重置');
        },

        // 删除存档
        delete() {
            localStorage.removeItem(this.STORAGE_KEY);
            this.data = { ...this.defaultData };
            this.data.playerProfile.id = this.generatePlayerId();
            console.log('[GameDataPersistence] 存档已删除');
        }
    };

    // 自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.GameDataPersistence.init());
    } else {
        window.GameDataPersistence.init();
    }

})();