'use strict';

(function() {
    if (window.PuzzleRender) return;

    window.PuzzleRender = window.PuzzleRenderOptimized = {
        ctx: null,
        canvas: null,
        particles: [],
        particlePool: [],
        animationFrame: null,
        hints: [],
        lastTime: 0,

        // 分层渲染
        layers: {
            background: null,
            grid: null,
            pieces: [],
            particles: [],
            effects: []
        },

        // 静态缓存
        staticCache: new Map(),
        dirtyRegions: [],

        // 性能监控
        performance: {
            frameCount: 0,
            lastFrameTime: 0,
            currentFPS: 0,
            renderTimes: []
        },

        init(canvasId) {
            this.canvas = document.getElementById(canvasId);
            if (!this.canvas) {
                console.error('Canvas not found:', canvasId);
                return false;
            }
            
            this.ctx = this.canvas.getContext('2d');
            this.hintTarget = null;
            this.initParticlePool();
            this.resize();
            
            window.addEventListener('resize', () => this.debounceResize());
            return true;
        },

        debounceResize() {
            if (this._resizeTimer) clearTimeout(this._resizeTimer);
            this._resizeTimer = setTimeout(() => this.resize(), 150);
        },

        // 初始化粒子对象池
        initParticlePool() {
            this.particlePool = [];
            for (let i = 0; i < 50; i++) {
                this.particlePool.push(this.createParticle());
            }
        },

        // 创建粒子对象
        createParticle() {
            return {
                x: 0,
                y: 0,
                vx: 0,
                vy: 0,
                life: 1,
                color: null,
                size: 3,
                active: false,
                targetX: 0,
                targetY: 0
            };
        },

        // 从对象池获取粒子
        getParticle() {
            for (let particle of this.particlePool) {
                if (!particle.active) {
                    particle.active = true;
                    return particle;
                }
            }
            
            // 对象池已满，创建新粒子
            const newParticle = this.createParticle();
            newParticle.active = true;
            this.particlePool.push(newParticle);
            return newParticle;
        },

        // 回收粒子
        recycleParticle(particle) {
            particle.active = false;
            particle.x = 0;
            particle.y = 0;
            particle.vx = 0;
            particle.vy = 0;
            particle.life = 1;
        },

        // 更新对象池
        updateParticlePool() {
            this.particles = this.particlePool.filter(p => p.active);
        },

        resize() {
            if (!this.canvas) return;
            
            const oldWidth = this.canvas.width || 500;
            const oldHeight = this.canvas.height || 400;
            
            const containerW = this.canvas.parentElement.clientWidth - 40;
            const maxW = Math.min(containerW, 500);
            const newWidth = Math.min(maxW, window.innerWidth - 30);
            const newHeight = Math.round(newWidth * 0.8);
            
            const maxH = Math.min(window.innerHeight * 0.55, 500);
            const finalWidth = Math.min(newWidth, Math.round(maxH / 0.8));
            const finalHeight = Math.round(finalWidth * 0.8);
            
            if (finalWidth < 200) return;
            
            if (finalWidth === oldWidth && finalHeight === oldHeight) return;
            
            if (oldWidth > 0 && oldHeight > 0 && window.PuzzleCore && window.PuzzleCore.pieces) {
                const scaleX = finalWidth / oldWidth;
                const scaleY = finalHeight / oldHeight;
                
                window.PuzzleCore.pieces.forEach(p => {
                    p.width = Math.round(p.width * Math.min(scaleX, scaleY));
                    p.height = Math.round(p.height * Math.min(scaleX, scaleY));
                    if (!p.isLocked) {
                        p.currentX = Math.max(0, Math.min(finalWidth - p.width, p.currentX * scaleX));
                        p.currentY = Math.max(0, Math.min(finalHeight - p.height, p.currentY * scaleY));
                    }
                    p.targetX = Math.round(p.targetX * scaleX);
                    p.targetY = Math.round(p.targetY * scaleY);
                });
                
                if (window.PuzzleCore.gridOffsetX != null) {
                    window.PuzzleCore.gridOffsetX = Math.round(window.PuzzleCore.gridOffsetX * scaleX);
                    window.PuzzleCore.gridOffsetY = Math.round(window.PuzzleCore.gridOffsetY * scaleY);
                }
                
                window.PuzzleCore.canvasWidth = finalWidth;
                window.PuzzleCore.canvasHeight = finalHeight;
                if (window.PuzzleCore.cellSize) {
                    window.PuzzleCore.cellSize = Math.round(window.PuzzleCore.cellSize * Math.min(scaleX, scaleY));
                }
            }
            
            this.canvas.width = finalWidth;
            this.canvas.height = finalHeight;
            
            this.staticCache.clear();
        },

        // 只更新变化的区域（脏矩形渲染）
        renderDirtyRegions(state) {
            if (!this.ctx || !this.dirtyRegions.length) return;
            
            // 清除所有脏区域
            this.dirtyRegions.forEach(region => {
                this.updateRegion(region, state);
            });
            
            this.dirtyRegions = [];
            
            // 更新性能监控
            this.updatePerformance();
        },

        // 更新单个区域
        updateRegion(region, state) {
            const { x, y, width, height } = region;
            
            // 只清除这个区域
            this.ctx.clearRect(x, y, width, height);
            
            // 重新绘制这个区域的元素
            this.drawRegionContent(x, y, width, height, state);
        },

        // 绘制区域内容
        drawRegionContent(x, y, width, height, state) {
            const cellSize = state.cellSize || (window.PuzzleCore ? window.PuzzleCore.cellSize : null);
            
            // 绘制网格（如果重叠）
            if (cellSize && this.isRegionOverlappingGrid(x, y, width, height)) {
                this.drawTargetGridForRegion(x, y, width, height, state.gridSize, cellSize);
            }
            
            // 绘制碎片（如果重叠）
            if (state.pieces) {
                const overlappingPieces = this.getPiecesInRegion(state.pieces, x, y, width, height);
                if (overlappingPieces.length > 0) {
                    this.drawPiecesInRegion(overlappingPieces, x, y, width, height);
                }
            }
            
            // 绘制粒子（如果重叠）
            const overlappingParticles = this.getParticlesInRegion(x, y, width, height);
            if (overlappingParticles.length > 0) {
                this.drawParticlesInRegion(overlappingParticles);
            }
        },

        // 检查区域是否与网格重叠
        isRegionOverlappingGrid(x, y, width, height) {
            if (!window.PuzzleCore || !window.PuzzleCore.gridOffsetX) return false;
            
            const gridSize = window.PuzzleCore.gridSize * window.PuzzleCore.cellSize;
            const gridX = window.PuzzleCore.gridOffsetX;
            const gridY = window.PuzzleCore.gridOffsetY;
            
            return !(x > gridX + gridSize || x + width < gridX || 
                    y > gridY + gridSize || y + height < gridY);
        },

        // 为特定区域绘制网格
        drawTargetGridForRegion(x, y, width, height, gridSize, cellSize) {
            if (!this.ctx) return;
            
            const gridPixelSize = gridSize * cellSize;
            const actualCellSize = window.PuzzleCore ? window.PuzzleCore.cellSize : cellSize;
            
            this.ctx.strokeStyle = '#6699cc';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([8, 6]);
            
            // 只绘制在区域内的线条
            const startX = Math.max(0, Math.floor(x / actualCellSize));
            const endX = Math.min(gridSize, Math.ceil((x + width) / actualCellSize));
            const startY = Math.max(0, Math.floor(y / actualCellSize));
            const endY = Math.min(gridSize, Math.ceil((y + height) / actualCellSize));
            
            const offsetX = window.PuzzleCore ? window.PuzzleCore.gridOffsetX : (this.canvas.width - gridPixelSize) / 2;
            const offsetY = window.PuzzleCore ? window.PuzzleCore.gridOffsetY : (this.canvas.height - gridPixelSize) / 2;
            
            for (let i = startX; i <= endX; i++) {
                const lineX = offsetX + i * actualCellSize;
                if (lineX >= x && lineX <= x + width) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(lineX, Math.max(y, offsetY));
                    this.ctx.lineTo(lineX, Math.min(y + height, offsetY + gridPixelSize));
                    this.ctx.stroke();
                }
            }
            
            for (let i = startY; i <= endY; i++) {
                const lineY = offsetY + i * actualCellSize;
                if (lineY >= y && lineY <= y + height) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(Math.max(x, offsetX), lineY);
                    this.ctx.lineTo(Math.min(x + width, offsetX + gridPixelSize), lineY);
                    this.ctx.stroke();
                }
            }
            
            this.ctx.setLineDash([]);
        },

        // 获取区域内的碎片
        getPiecesInRegion(pieces, x, y, width, height) {
            return pieces.filter(piece => {
                const px = piece.displayX || piece.currentX;
                const py = piece.displayY || piece.currentY;
                return px + piece.width > x && px < x + width &&
                       py + piece.height > y && py < y + height;
            });
        },

        // 在区域内绘制碎片
        drawPiecesInRegion(pieces, x, y, width, height) {
            pieces.forEach(piece => {
                if (!piece.isLocked) {
                    this.drawPiece(piece);
                }
            });
        },

        // 获取区域内的粒子
        getParticlesInRegion(x, y, width, height) {
            return this.particles.filter(p => {
                return p.x >= x && p.x <= x + width &&
                       p.y >= y && p.y <= y + height;
            });
        },

        // 在区域内绘制粒子
        drawParticlesInRegion(particles) {
            particles.forEach(particle => {
                this.drawSingleParticle(particle);
            });
        },

        // 添加脏区域
        addDirtyRegion(x, y, width, height) {
            const margin = 5; // 添加边距确保完整绘制
            this.dirtyRegions.push({
                x: Math.max(0, x - margin),
                y: Math.max(0, y - margin),
                width: width + 2 * margin,
                height: height + 2 * margin
            });
            
            // 限制脏区域数量
            if (this.dirtyRegions.length > 10) {
                this.dirtyRegions = [];
                this.clear(); // 回退到全画布重绘
            }
        },

        // 清空画布
        clear() {
            if (!this.ctx) return;
            this.ctx.shadowColor = 'transparent';
            this.ctx.shadowBlur = 0;
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        },

        // 创建粒子效果 - 使用对象池
        createParticles(x, y, color) {
            const count = Math.min(20, window.PuzzleConfig.ANIMATION.particleCount);
            
            for (let i = 0; i < count; i++) {
                const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
                const speed = 2 + Math.random() * 4;
                
                const particle = this.getParticle();
                particle.x = x;
                particle.y = y;
                particle.vx = Math.cos(angle) * speed;
                particle.vy = Math.sin(angle) * speed;
                particle.life = 1;
                particle.color = color;
                particle.size = 3 + Math.random() * 4;
                particle.targetX = x;
                particle.targetY = y;
            }
        },

        // 更新粒子 - 使用空间分区优化
        updateParticles() {
            // 更新对象池
            this.updateParticlePool();
            
            this.particles = this.particles.filter(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.1;
                p.life -= 0.02;
                
                // 回收死亡的粒子
                if (p.life <= 0) {
                    this.recycleParticle(p);
                    return false;
                }
                
                return p.life > 0;
            });
        },

        // 绘制单个粒子
        drawSingleParticle(particle) {
            if (!this.ctx) return;
            
            this.ctx.globalAlpha = particle.life;
            this.ctx.fillStyle = particle.color;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size * particle.life, 0, Math.PI * 2);
            this.ctx.fill();
        },

        // 绘制所有粒子
        drawParticles() {
            this.particles.forEach(particle => {
                this.drawSingleParticle(particle);
            });
            this.ctx.globalAlpha = 1;
        },

        // 绘制单个碎片
        drawPiece(piece) {
            if (!this.ctx) return;
            
            this.ctx.save();
            
            const centerX = piece.displayX + piece.width / 2;
            const centerY = piece.displayY + piece.height / 2;
            
            this.ctx.translate(centerX, centerY);
            this.ctx.rotate((piece.rotation || 0) * Math.PI / 180);
            
            if (piece.isSelected) {
                const selSize = piece.width;
                this.ctx.lineWidth = 6;
                this.ctx.strokeStyle = window.PuzzleConfig.COLORS.highlight;
                this.ctx.globalAlpha = 0.2;
                this.ctx.beginPath();
                if (this.ctx.roundRect) {
                    this.ctx.roundRect(-selSize / 2, -selSize / 2, selSize, selSize, 8);
                } else {
                    this.ctx.rect(-selSize / 2, -selSize / 2, selSize, selSize);
                }
                this.ctx.stroke();
                this.ctx.globalAlpha = 0.5;
                this.ctx.lineWidth = 3;
                this.ctx.stroke();
                this.ctx.globalAlpha = 1;
                this.ctx.lineWidth = 2;
                this.ctx.strokeStyle = window.PuzzleConfig.COLORS.highlight;
                this.ctx.stroke();
            }
            
            if (piece.isHint) {
                this.ctx.shadowColor = window.PuzzleConfig.COLORS.highlight;
                this.ctx.shadowBlur = 25;
                this.ctx.globalAlpha = 0.9;
            }
            
            const size = piece.width;
            
            if (piece.color) {
                this.ctx.fillStyle = piece.color;
                this.ctx.beginPath();
                if (this.ctx.roundRect) {
                    this.ctx.roundRect(-size / 2, -size / 2, size, size, 8);
                } else {
                    this.ctx.rect(-size / 2, -size / 2, size, size);
                }
                this.ctx.fill();
            }
            
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
        },

        // 优化的渲染方法
        render(state) {
            if (!this.ctx) return;
            
            const startTime = performance.now();
            
            try {
                // 检查是否使用脏矩形渲染
                if (this.dirtyRegions.length > 0) {
                    this.renderDirtyRegions(state);
                } else {
                    // 全画布重绘
                    this.fullRender(state);
                }
                
                // 更新性能监控
                const endTime = performance.now();
                this.recordRenderTime(endTime - startTime);
            } catch (e) {
                console.error('Render error:', e);
                // 出错时回退到简单渲染
                this.fallbackRender(state);
            }
        },

        // 全画布渲染
        fullRender(state) {
            this.clear();
            // 确保 shadow 状态干净，防止跨帧泄漏
            this.ctx.shadowColor = 'transparent';
            this.ctx.shadowBlur = 0;
            
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
        },

        // 备用渲染方法
        fallbackRender(state) {
            this.clear();
            // 确保 shadow 状态干净
            this.ctx.shadowColor = 'transparent';
            this.ctx.shadowBlur = 0;
            
            const cellSize = state.cellSize || (window.PuzzleCore ? window.PuzzleCore.cellSize : null);
            if (cellSize) {
                this.drawTargetGrid(state.gridSize, cellSize);
            }
            
            if (state.pieces) {
                this.drawPieces(state.pieces);
            }
        },

        // 记录渲染时间
        recordRenderTime(time) {
            this.performance.renderTimes.push(time);
            if (this.performance.renderTimes.length > 60) {
                this.performance.renderTimes.shift();
            }
        },

        // 更新性能监控
        updatePerformance() {
            const now = performance.now();
            this.performance.frameCount++;
            
            if (now - this.performance.lastFrameTime >= 1000) {
                this.performance.currentFPS = this.performance.frameCount;
                this.performance.frameCount = 0;
                this.performance.lastFrameTime = now;
                console.log(`[PuzzleRender] FPS: ${this.performance.currentFPS}`);
            }
        },

        // 获取性能统计
        getPerformanceStats() {
            const avgTime = this.performance.renderTimes.reduce((a, b) => a + b, 0) / 
                          (this.performance.renderTimes.length || 1);
            return {
                fps: this.performance.currentFPS,
                avgRenderTime: avgTime,
                particleCount: this.particles.length,
                dirtyRegionCount: this.dirtyRegions.length
            };
        },

        // 启动动画循环
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

        // 停止动画
        stopAnimation() {
            if (this._resizeTimer) {
                clearTimeout(this._resizeTimer);
                this._resizeTimer = null;
            }
            if (this.animationFrame) {
                cancelAnimationFrame(this.animationFrame);
                this.animationFrame = null;
            }
            
            // 清空对象池
            this.particlePool.forEach(particle => {
                particle.active = false;
            });
            this.particles = [];
        },

        // 显示提示 - 使用脏矩形标记
        showHint(piece) {
            if (!piece) return;
            
            piece.isHint = true;
            this.hintTarget = piece;
            
            // 标记提示区域为脏区域
            this.addDirtyRegion(
                piece.targetX - 10,
                piece.targetY - 10,
                piece.width + 20,
                piece.height + 20
            );
            
            setTimeout(() => {
                piece.isHint = false;
                this.hintTarget = null;
                // 清除提示效果
                this.addDirtyRegion(
                    piece.targetX - 10,
                    piece.targetY - 10,
                    piece.width + 20,
                    piece.height + 20
                );
            }, window.PuzzleConfig.AI.highlightDuration);
        },

        // 绘制提示目标和连线
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
        },

        // 绘制完成效果
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

        // 绘制失败效果
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

        // 其他原有方法保持不变...
        drawPieces(pieces) {
            if (!this.ctx || !pieces) return;
            
            pieces.forEach(piece => {
                this.drawPiece(piece);
            });
        },

        drawTargetGrid(gridSize, cellSize) {
            if (!this.ctx) return;
            // 确保 shadow 干净
            this.ctx.shadowColor = 'transparent';
            this.ctx.shadowBlur = 0;
            
            const canvasWidth = this.canvas.width;
            const canvasHeight = this.canvas.height;
            const actualCellSize = window.PuzzleCore ? window.PuzzleCore.cellSize : Math.min(canvasWidth, canvasHeight) / (gridSize + 2);
            
            const gridPixelSize = gridSize * actualCellSize;
            const canvasCenterX = canvasWidth / 2;
            const canvasCenterY = canvasHeight / 2;
            const offsetX = window.PuzzleCore ? window.PuzzleCore.gridOffsetX : (canvasCenterX - gridPixelSize / 2);
            const offsetY = window.PuzzleCore ? window.PuzzleCore.gridOffsetY : (canvasCenterY - gridPixelSize / 2);
            
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
            // 确保 shadow 干净，防止继承外层状态
            this.ctx.shadowColor = 'transparent';
            this.ctx.shadowBlur = 0;
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
            // 确保 shadow 干净
            this.ctx.shadowColor = 'transparent';
            this.ctx.shadowBlur = 0;
            
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
                }
                
                if (piece.isSelected) {
                    this.ctx.lineWidth = 6;
                    this.ctx.strokeStyle = window.PuzzleConfig.COLORS.highlight;
                    this.ctx.globalAlpha = 0.2;
                    this.ctx.beginPath();
                    if (this.ctx.roundRect) {
                        this.ctx.roundRect(-piece.width / 2, -piece.height / 2, piece.width, piece.height, 8);
                    } else {
                        this.ctx.rect(-piece.width / 2, -piece.height / 2, piece.width, piece.height);
                    }
                    this.ctx.stroke();
                    this.ctx.globalAlpha = 0.5;
                    this.ctx.lineWidth = 3;
                    this.ctx.stroke();
                    this.ctx.globalAlpha = 1;
                    this.ctx.lineWidth = 2;
                    this.ctx.strokeStyle = window.PuzzleConfig.COLORS.highlight;
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
        }
    };

})();