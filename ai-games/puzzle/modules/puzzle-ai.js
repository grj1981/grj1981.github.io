'use strict';

(function() {
    if (window.PuzzleAI) return;

    window.PuzzleAI = {
        hintCooldown: false,

        init() {
            this.hintCooldown = false;
        },

        canUseHint(core) {
            if (this.hintCooldown) return false;
            if (core.hintsRemaining <= 0) return false;
            return true;
        },

        getBestHint(core) {
            if (!this.canUseHint(core)) return null;
            
            const unlockedPieces = core.pieces.filter(p => !p.isLocked);
            if (unlockedPieces.length === 0) return null;
            
            let bestPiece = null;
            let minScore = Infinity;
            
            unlockedPieces.forEach(piece => {
                const distance = Math.sqrt(
                    Math.pow(piece.currentX - piece.targetX, 2) +
                    Math.pow(piece.currentY - piece.targetY, 2)
                );
                
                let rotationPenalty = 0;
                if (core.enableRotation && piece.rotation !== piece.targetRotation) {
                    rotationPenalty = 50;
                }
                
                const score = distance + rotationPenalty;
                
                if (score < minScore) {
                    minScore = score;
                    bestPiece = piece;
                }
            });
            
            return bestPiece;
        },

        useHint(core, render) {
            const piece = this.getBestHint(core);
            
            if (!piece) return null;
            
            core.hintsRemaining--;
            
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

        startCooldown() {
            this.hintCooldown = true;
            const cooldown = window.PuzzleConfig.AI.cooldown;
            
            setTimeout(() => {
                this.hintCooldown = false;
            }, cooldown);
        }
    };

})();