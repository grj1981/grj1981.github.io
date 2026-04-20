'use strict';

(function() {
    if (window.PuzzleRender) return;

    window.PuzzleRender = {
        ctx: null,
        canvas: null,
        particles: [],
        animationFrame: null,
        hints: [],
        lastTime: 0,

        init(canvasId) {
            this.canvas = document.getElementById(canvasId);
            if (!this.canvas) {
                console.error('Canvas not found:', canvasId);
                return false;
            }
            
            this.ctx = this.canvas.getContext('2d');
            this.hintTarget = null;
            this.resize();
            
            window.addEventListener('resize', () => this.resize());
            return true;
        },

        resize() {
            if (!this.canvas) return;
            
            const container = this.canvas.parentElement;
            const oldWidth = this.canvas.width || 500;
            const oldHeight = this.canvas.height || 400;
            const newWidth = Math.min(600, container.clientWidth - 40);
            const newHeight = Math.min(500, window.innerHeight * 0.6);
            
            if (oldWidth > 0 && oldHeight > 0 && window.PuzzleCore && window.PuzzleCore.pieces) {
                const scaleX = newWidth / oldWidth;
                const scaleY = newHeight / oldHeight;
                
                window.PuzzleCore.pieces.forEach(p => {
                    if (!p.isLocked) {
                        p.currentX *= scaleX;
                        p.currentY *= scaleY;
                        p.currentX = Math.max(0, Math.min(newWidth - p.width, p.currentX));
                        p.currentY = Math.max(0, Math.min(newHeight - p.height, p.currentY));
                    }
                    p.targetX *= scaleX;
                    p.targetY *= scaleY;
                });
                
                if (window.PuzzleCore.gridOffsetX) {
                    window.PuzzleCore.gridOffsetX *= scaleX;
                    window.PuzzleCore.gridOffsetY *= scaleY;
                }
                
                window.PuzzleCore.canvasWidth = newWidth;
                window.PuzzleCore.canvasHeight = newHeight;
            }
            
            this.canvas.width = newWidth;
            this.canvas.height = newHeight;
        },

        clear() {
            if (!this.ctx) return;
            
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        },

        drawPieces(pieces) {
            if (!this.ctx || !pieces) return;
            
            pieces.forEach(piece => {
                this.ctx.save();
                
                const centerX = piece.displayX + piece.width / 2;
                const centerY = piece.displayY + piece.height / 2;
                
                this.ctx.translate(centerX, centerY);
                this.ctx.rotate((piece.rotation || 0) * Math.PI / 180);
                
                if (piece.isLocked) {
                    this.ctx.shadowColor = window.PuzzleConfig.COLORS.success;
                    this.ctx.shadowBlur = 15;
                }
                
                if (piece.isSelected) {
                    const selSize = piece.width;
                    this.ctx.shadowColor = window.PuzzleConfig.COLORS.highlight;
                    this.ctx.shadowBlur = 20;
                    this.ctx.lineWidth = 3;
                    this.ctx.strokeStyle = window.PuzzleConfig.COLORS.highlight;
                    if (piece.shape === 'circle') {
                        this.ctx.stroke();
                    } else {
                        if (this.ctx.roundRect) {
                            this.ctx.roundRect(-selSize / 2, -selSize / 2, selSize, selSize, 8);
                        } else {
                            this.ctx.rect(-selSize / 2, -selSize / 2, selSize, selSize);
                        }
                        this.ctx.stroke();
                    }
                }
                
                if (piece.isHint) {
                    this.ctx.shadowColor = window.PuzzleConfig.COLORS.highlight;
                    this.ctx.shadowBlur = 25;
                    this.ctx.globalAlpha = 0.9;
                }
                
                const size = piece.width;
                this.ctx.fillStyle = piece.color;
                this.ctx.beginPath();
                
                if (piece.shape === 'circle') {
                    this.ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
                } else {
                    if (this.ctx.roundRect) {
                        this.ctx.roundRect(-size / 2, -size / 2, size, size, 8);
                    } else {
                        this.ctx.rect(-size / 2, -size / 2, size, size);
                    }
                }
                
                this.ctx.fill();
                
                this.ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
                
                this.ctx.restore();
            });
        },

        drawTargetGrid(gridSize, cellSize) {
            if (!this.ctx) return;
            
            const canvasWidth = this.canvas.width;
            const canvasHeight = this.canvas.height;
            const actualCellSize = window.PuzzleCore ? window.PuzzleCore.cellSize : Math.min(canvasWidth, canvasHeight) / (gridSize + 2);
            
            const canvasCenterX = canvasWidth / 2;
            const canvasCenterY = canvasHeight / 2;
            const gridPixelSize = gridSize * actualCellSize;
            const offsetX = canvasCenterX - gridPixelSize / 2;
            const offsetY = canvasCenterY - gridPixelSize / 2;
            
            this.ctx.strokeStyle = '#6699cc';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([8, 6]);
            
            for (let i = 0; i <= gridSize; i++) {
                const pos = i * actualCellSize;
                
                this.ctx.beginPath();
                this.ctx.moveTo(offsetX + pos, offsetY);
                this.ctx.lineTo(offsetX + pos, offsetY + gridPixelSize);
                this.ctx.stroke();
                
                this.ctx.beginPath();
                this.ctx.moveTo(offsetX, offsetY + pos);
                this.ctx.lineTo(offsetX + gridPixelSize, offsetY + pos);
                this.ctx.stroke();
            }
            
            this.ctx.setLineDash([]);
        },

        createParticles(x, y, color) {
            const count = window.PuzzleConfig.ANIMATION.particleCount;
            
            for (let i = 0; i < count; i++) {
                const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
                const speed = 2 + Math.random() * 4;
                
                this.particles.push({
                    x: x,
                    y: y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life: 1,
                    color: color,
                    size: 3 + Math.random() * 4
                });
            }
        },

        updateParticles() {
            this.particles = this.particles.filter(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.1;
                p.life -= 0.02;
                return p.life > 0;
            });
        },

        drawParticles() {
            if (!this.ctx) return;
            
            this.particles.forEach(p => {
                this.ctx.globalAlpha = p.life;
                this.ctx.fillStyle = p.color;
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
                this.ctx.fill();
            });
            
            this.ctx.globalAlpha = 1;
        },

        drawCompletionEffect() {
            const time = Date.now();
            const centerX = this.canvas.width / 2;
            const centerY = this.canvas.height / 2;
            
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.ctx.font = 'bold 48px "Microsoft YaHei", sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillStyle = '#FFD700';
            this.ctx.shadowColor = '#FF6B6B';
            this.ctx.shadowBlur = 20;
            this.ctx.fillText('🎉 恭喜通关!', centerX, centerY - 30);
            this.ctx.shadowBlur = 0;
            
            this.ctx.font = '24px "Microsoft YaHei", sans-serif';
            this.ctx.fillStyle = '#fff';
            this.ctx.fillText('点击"开始游戏"重新挑战', centerX, centerY + 30);
            
            for (let i = 0; i < 8; i++) {
                const angle = (time / 15 + i * 45) * Math.PI / 180;
                const radius = 100 + Math.sin(time / 200 + i) * 10;
                
                const x = centerX + Math.cos(angle) * radius;
                const y = centerY + Math.sin(angle) * radius;
                
                const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFD700', '#96CEB4'];
                this.ctx.fillStyle = colors[i % colors.length];
                this.ctx.globalAlpha = 0.8;
                this.ctx.beginPath();
                this.ctx.arc(x, y, 6, 0, Math.PI * 2);
                this.ctx.fill();
            }
            
            this.ctx.globalAlpha = 1;
        },

        drawFailedEffect() {
            const time = Date.now();
            const centerX = this.canvas.width / 2;
            const centerY = this.canvas.height / 2;
            
            this.ctx.fillStyle = 'rgba(20, 0, 0, 0.6)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.ctx.font = 'bold 48px "Microsoft YaHei", sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillStyle = '#FF4444';
            this.ctx.shadowColor = '#FF0000';
            this.ctx.shadowBlur = 20;
            this.ctx.fillText('⏰ 时间到!', centerX, centerY - 30);
            this.ctx.shadowBlur = 0;
            
            this.ctx.font = '24px "Microsoft YaHei", sans-serif';
            this.ctx.fillStyle = '#ccc';
            this.ctx.fillText('点击"重新开始"再试一次', centerX, centerY + 30);
            
            for (let i = 0; i < 6; i++) {
                const x = centerX - 120 + i * 50;
                const y = centerY - 80 + Math.sin(time / 300 + i) * 10;
                
                this.ctx.fillStyle = '#FF4444';
                this.ctx.globalAlpha = 0.6;
                this.ctx.beginPath();
                this.ctx.arc(x, y, 8, 0, Math.PI * 2);
                this.ctx.fill();
            }
            
            this.ctx.globalAlpha = 1;
        },

        drawBackgroundImage(gridSize, cellSize) {
            if (!this.ctx || !this.canvas) return;
            
            const core = window.PuzzleCore;
            if (!core || !core.hasImage()) return;
            
            const image = core.getImage();
            if (!image) return;
            
            const actualCellSize = core.cellSize;
            const gridPixelSize = gridSize * actualCellSize;
            const offsetX = core.gridOffsetX;
            const offsetY = core.gridOffsetY;
            
            this.ctx.save();
            this.ctx.globalAlpha = 0.3;
            this.ctx.drawImage(
                image,
                0, 0, image.width, image.height,
                offsetX, offsetY, gridPixelSize, gridPixelSize
            );
            this.ctx.restore();
        },

        drawLightedAreas(pieces, gridSize, cellSize) {
            if (!this.ctx || !pieces) return;
            
            const core = window.PuzzleCore;
            if (!core || !core.hasImage()) return;
            
            const image = core.getImage();
            if (!image) return;
            
            const lockedPieces = pieces.filter(p => p.isLocked);
            if (lockedPieces.length === 0) return;
            
            const actualCellSize = core.cellSize;
            
            this.ctx.save();
            
            lockedPieces.forEach(piece => {
                const size = piece.width;
                
                this.ctx.drawImage(
                    image,
                    piece.imageData.sx, piece.imageData.sy, piece.imageData.sw, piece.imageData.sh,
                    piece.displayX, piece.displayY, size, size
                );
            });
            
            this.ctx.restore();
        },

        drawPiecesWithImage(pieces) {
            if (!this.ctx || !pieces) return;
            
            const core = window.PuzzleCore;
            const hasImage = core && core.hasImage();
            
            pieces.forEach(piece => {
                this.ctx.save();
                
                const centerX = piece.displayX + piece.width / 2;
                const centerY = piece.displayY + piece.height / 2;
                
                this.ctx.translate(centerX, centerY);
                this.ctx.rotate((piece.rotation || 0) * Math.PI / 180);
                
                if (piece.isLocked) {
                    this.ctx.shadowColor = window.PuzzleConfig.COLORS.success;
                    this.ctx.shadowBlur = 15;
                }
                
                if (piece.isSelected) {
                    this.ctx.shadowColor = window.PuzzleConfig.COLORS.highlight;
                    this.ctx.shadowBlur = 20;
                    this.ctx.lineWidth = 3;
                    this.ctx.strokeStyle = window.PuzzleConfig.COLORS.highlight;
                    if (this.ctx.roundRect) {
                        this.ctx.roundRect(-piece.width / 2, -piece.height / 2, piece.width, piece.height, 8);
                    } else {
                        this.ctx.rect(-piece.width / 2, -piece.height / 2, piece.width, piece.height);
                    }
                    this.ctx.stroke();
                }
                
                if (piece.isHint) {
                    this.ctx.shadowColor = window.PuzzleConfig.COLORS.highlight;
                    this.ctx.shadowBlur = 25;
                    this.ctx.globalAlpha = 0.9;
                }
                
                const size = piece.width;
                
                if (hasImage && piece.imageData) {
                    this.ctx.drawImage(
                        core.getImage(),
                        piece.imageData.sx, piece.imageData.sy, piece.imageData.sw, piece.imageData.sh,
                        -size / 2, -size / 2, size, size
                    );
                } else {
                    this.ctx.fillStyle = piece.color;
                    this.ctx.beginPath();
                    if (this.ctx.roundRect) {
                        this.ctx.roundRect(-size / 2, -size / 2, size, size, 8);
                    } else {
                        this.ctx.rect(-size / 2, -size / 2, size, size);
                    }
                    this.ctx.fill();
                }
                
                // 旋转图标 - 画在图片/颜色之后，逆向旋转让图标保持正向
                if (piece.isSelected) {
                    this.ctx.save();
                    this.ctx.rotate(-(piece.rotation || 0) * Math.PI / 180);
                    this.ctx.fillStyle = '#ffffff';
                    this.ctx.font = 'bold 24px sans-serif';
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'middle';
                    this.ctx.shadowColor = '#000000';
                    this.ctx.shadowBlur = 4;
                    this.ctx.fillText('↻', 0, 0);
                    this.ctx.restore();
                }
                
                this.ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
                
                this.ctx.restore();
            });
        },

        render(state) {
            if (!this.ctx) return;
            
            try {
                this.clear();
                
                const cellSize = state.cellSize || (window.PuzzleCore ? window.PuzzleCore.cellSize : null);
                if (cellSize) {
                    const core = window.PuzzleCore;
                    if (core && core.hasImage()) {
                        this.drawBackgroundImage(state.gridSize, cellSize);
                    }
                    this.drawTargetGrid(state.gridSize, cellSize);
                }
                
                if (state.pieces) {
                    const core = window.PuzzleCore;
                    if (core && core.hasImage()) {
                        this.drawLightedAreas(state.pieces, state.gridSize, cellSize);
                        this.drawPiecesWithImage(state.pieces);
                    } else {
                        this.drawPieces(state.pieces);
                    }
                }
                
                this.updateParticles();
                this.drawParticles();
                this.drawHintTargetAndLine();
                
                if (state.isComplete) {
                    this.drawCompletionEffect();
                }
                
                if (state.isFailed) {
                    this.drawFailedEffect();
                }
            } catch (e) {
                console.error('Render error:', e);
            }
        },

        startAnimation(renderCallback) {
            const animate = (timestamp) => {
                const delta = timestamp - this.lastTime;
                this.lastTime = timestamp;
                
                if (renderCallback) {
                    renderCallback(delta);
                }
                
                this.animationFrame = requestAnimationFrame(animate);
            };
            
            this.lastTime = performance.now();
            this.animationFrame = requestAnimationFrame(animate);
        },

        stopAnimation() {
            if (this.animationFrame) {
                cancelAnimationFrame(this.animationFrame);
                this.animationFrame = null;
            }
            this.particles = [];
        },

        showHint(piece) {
            if (!piece) return;
            
            piece.isHint = true;
            this.hintTarget = piece;
            
            setTimeout(() => {
                piece.isHint = false;
                this.hintTarget = null;
            }, window.PuzzleConfig.AI.highlightDuration);
        },

        drawHintTargetAndLine() {
            if (!this.ctx || !this.hintTarget) return;
            
            const piece = this.hintTarget;
            const config = window.PuzzleConfig.COLORS;
            
            this.ctx.save();
            
            this.ctx.strokeStyle = config.highlight;
            this.ctx.lineWidth = 3;
            this.ctx.setLineDash([5, 5]);
            this.ctx.strokeRect(
                piece.targetX - 5,
                piece.targetY - 5,
                piece.width + 10,
                piece.height + 10
            );
            
            const startX = piece.currentX + piece.width / 2;
            const startY = piece.currentY + piece.height / 2;
            const endX = piece.targetX + piece.width / 2;
            const endY = piece.targetY + piece.height / 2;
            
            this.ctx.strokeStyle = config.highlight;
            this.ctx.globalAlpha = 0.6;
            this.ctx.setLineDash([10, 5]);
            this.ctx.beginPath();
            this.ctx.moveTo(startX, startY);
            this.ctx.lineTo(endX, endY);
            this.ctx.stroke();
            
            this.ctx.globalAlpha = 1;
            this.ctx.setLineDash([]);
            this.ctx.restore();
        }
    };

})();