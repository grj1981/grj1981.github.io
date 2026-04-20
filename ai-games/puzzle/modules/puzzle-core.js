'use strict';

(function() {
    if (window.PuzzleCore) return;

    window.PuzzleCore = {
        pieces: [],
        targetGrid: [],
        currentLevel: 1,
        completedPieces: 0,
        hintsRemaining: 0,
        enableRotation: false,
        canvasWidth: 500,
        canvasHeight: 400,
        gridSize: 2,
        selectedPieceId: null,
        puzzleImage: null,
        imageLoaded: false,

        init(level, canvasWidth = 500, canvasHeight = 400, imageSeed = null) {
            this.currentLevel = level;
            this.canvasWidth = canvasWidth;
            this.canvasHeight = canvasHeight;
            
            const config = window.PuzzleConfig.getDifficulty(level);
            this.hintsRemaining = config.hints;
            this.enableRotation = config.rotation;
            this.gridSize = config.grid;
            
            const seed = imageSeed || Date.now();
            const imageUrl = `${window.PuzzleConfig.IMAGE_BASE_URL}/${canvasWidth}/${canvasHeight}?random=${seed}`;
            this.puzzleImage = new Image();
            this.puzzleImage.crossOrigin = 'anonymous';
            
            return new Promise((resolve) => {
                this.puzzleImage.onload = () => {
                    this.imageLoaded = true;
                    this.generatePuzzle(config, canvasWidth, canvasHeight);
                    this.completedPieces = 0;
                    
                    resolve({
                        pieces: this.pieces,
                        gridSize: this.gridSize,
                        hints: this.hintsRemaining,
                        level: level,
                        cellSize: this.cellSize
                    });
                };
                
                this.puzzleImage.onerror = () => {
                    this.imageLoaded = false;
                    console.warn('图片加载失败，使用纯色模式');
                    this.generatePuzzle(config, canvasWidth, canvasHeight);
                    this.completedPieces = 0;
                    
                    resolve({
                        pieces: this.pieces,
                        gridSize: this.gridSize,
                        hints: this.hintsRemaining,
                        level: level,
                        cellSize: this.cellSize
                    });
                };
                
                this.puzzleImage.src = imageUrl;
            });
        },

        initSync(level, canvasWidth = 500, canvasHeight = 400) {
            this.currentLevel = level;
            this.canvasWidth = canvasWidth;
            this.canvasHeight = canvasHeight;
            
            const config = window.PuzzleConfig.getDifficulty(level);
            this.hintsRemaining = config.hints;
            this.enableRotation = config.rotation;
            this.gridSize = config.grid;
            
            this.generatePuzzle(config, canvasWidth, canvasHeight);
            this.completedPieces = 0;
            
            return {
                pieces: this.pieces,
                gridSize: this.gridSize,
                hints: this.hintsRemaining,
                level: level,
                cellSize: this.cellSize
            };
        },

        generatePuzzle(config, canvasWidth, canvasHeight) {
            this.pieces = [];
            this.targetGrid = [];
            
            const gridSize = config.grid;
            const cellSize = Math.min(canvasWidth, canvasHeight) / (gridSize + 2);
            
            this.cellSize = cellSize;
            
            const gridWidth = gridSize * cellSize;
            const gridHeight = gridSize * cellSize;
            const gridOffsetX = (canvasWidth - gridWidth) / 2;
            const gridOffsetY = (canvasHeight - gridHeight) / 2;
            
            this.gridOffsetX = gridOffsetX;
            this.gridOffsetY = gridOffsetY;
            this.targetGrid = [];
            
            const pieceSize = cellSize;
            const hasImage = this.imageLoaded && window.PuzzleConfig.enableImageMode;
            
            let imageScale = 1;
            let imageOffsetX = 0;
            let imageOffsetY = 0;
            
            if (hasImage) {
                const imgRatio = this.puzzleImage.width / this.puzzleImage.height;
                const gridRatio = gridWidth / gridHeight;
                
                if (imgRatio > gridRatio) {
                    imageScale = this.puzzleImage.height / gridHeight;
                    imageOffsetX = (this.puzzleImage.width / imageScale - gridWidth) / 2;
                    imageOffsetY = 0;
                } else {
                    imageScale = this.puzzleImage.width / gridWidth;
                    imageOffsetY = (this.puzzleImage.height / imageScale - gridHeight) / 2;
                    imageOffsetX = 0;
                }
            }
            
            for (let i = 0; i < config.size; i++) {
                const row = Math.floor(i / gridSize);
                const col = i % gridSize;
                
                const targetX = gridOffsetX + col * cellSize;
                const targetY = gridOffsetY + row * cellSize;
                
                let imageData = null;
                if (hasImage) {
                    const sx = (col * cellSize + imageOffsetX) * imageScale;
                    const sy = (row * cellSize + imageOffsetY) * imageScale;
                    const sw = cellSize * imageScale;
                    const sh = cellSize * imageScale;
                    imageData = { sx, sy, sw, sh };
                }
                
                this.targetGrid.push({
                    x: targetX,
                    y: targetY,
                    imageData: imageData,
                    index: i
                });
            }
            
            const shuffledIndices = this.shuffleArray([...Array(config.size).keys()]);
            
            const leftAreaWidth = canvasWidth * 0.25;
            const rightAreaWidth = canvasWidth * 0.25;
            
            shuffledIndices.forEach((originalIndex, newIndex) => {
                const target = this.targetGrid[originalIndex];
                
                let rotation = 0;
                if (this.enableRotation && Math.random() > 0.5) {
                    rotation = Math.floor(Math.random() * 4) * 90;
                }
                
                let startX, startY;
                if (newIndex % 2 === 0) {
                    startX = Math.random() * leftAreaWidth + 10;
                    startY = Math.random() * (canvasHeight - pieceSize - 20) + 10;
                } else {
                    startX = canvasWidth - rightAreaWidth + Math.random() * (rightAreaWidth - pieceSize - 10);
                    startY = Math.random() * (canvasHeight - pieceSize - 20) + 10;
                }
                
                this.pieces.push({
                    id: originalIndex,
                    correctIndex: originalIndex,
                    currentX: startX,
                    currentY: startY,
                    targetX: target.x,
                    targetY: target.y,
                    imageData: target.imageData,
                    rotation: rotation,
                    targetRotation: 0,
                    isLocked: false,
                    width: pieceSize,
                    height: pieceSize
                });
            });
        },

        shuffleArray(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        },

        rotatePiece(pieceId, animated = true) {
            const piece = this.pieces.find(p => p.id === pieceId);
            if (!piece || piece.isLocked || !this.enableRotation) return false;
            
            if (animated) {
                piece.isRotating = true;
                piece.targetRotation = (piece.rotation + 90) % 360;
            } else {
                piece.rotation = (piece.rotation + 90) % 360;
            }
            return true;
        },

        updateRotations(deltaTime = 16) {
            const baseSpeed = 180;
            const speed = baseSpeed * (deltaTime / 1000);
            let hasUpdates = false;
            
            this.pieces.forEach(p => {
                if (p.isRotating) {
                    let diff = p.targetRotation - p.rotation;
                    
                    if (diff > 180) diff -= 360;
                    if (diff < -180) diff += 360;
                    
                    if (Math.abs(diff) < speed) {
                        p.rotation = p.targetRotation;
                        p.isRotating = false;
                    } else {
                        p.rotation += diff > 0 ? speed : -speed;
                        if (p.rotation < 0) p.rotation += 360;
                        p.rotation = p.rotation % 360;
                    }
                    hasUpdates = true;
                }
            });
            return hasUpdates;
        },

        selectPiece(pieceId) {
            this.pieces.forEach(p => {
                p.isSelected = (p.id === pieceId);
            });
            this.selectedPieceId = pieceId;
        },

        clearSelection() {
            this.pieces.forEach(p => {
                p.isSelected = false;
            });
            this.selectedPieceId = null;
        },

        movePiece(pieceId, newX, newY) {
            const piece = this.pieces.find(p => p.id === pieceId);
            if (!piece || piece.isLocked) return false;
            
            piece.currentX = newX;
            piece.currentY = newY;
            return true;
        },

        checkSnap(pieceId) {
            const piece = this.pieces.find(p => p.id === pieceId);
            if (!piece || piece.isLocked) return { snapped: false };
            
            if (piece.isRotating) return { snapped: false };
            
            const snapDistance = window.PuzzleConfig.ANIMATION.snapDistance;
            
            const distance = Math.sqrt(
                Math.pow(piece.currentX - piece.targetX, 2) +
                Math.pow(piece.currentY - piece.targetY, 2)
            );
            
            const rotationCorrect = !this.enableRotation || piece.rotation === piece.targetRotation;
            
            console.log(`[吸附检测] 碎片${pieceId}: distance=${distance.toFixed(1)}, snapDistance=${snapDistance}, rotation=${piece.rotation}, targetRotation=${piece.targetRotation}, enableRotation=${this.enableRotation}, rotationCorrect=${rotationCorrect}`);
            
            if (distance < snapDistance && rotationCorrect) {
                piece.currentX = piece.targetX;
                piece.currentY = piece.targetY;
                piece.isLocked = true;
                this.completedPieces++;
                
                return {
                    snapped: true,
                    pieceId: pieceId,
                    isComplete: this.completedPieces === this.pieces.length
                };
            }
            
            return { snapped: false };
        },

        getPieceAt(x, y) {
            for (let i = this.pieces.length - 1; i >= 0; i--) {
                const p = this.pieces[i];
                if (p.isLocked) continue;
                
                if (x >= p.currentX && x <= p.currentX + p.width &&
                    y >= p.currentY && y <= p.currentY + p.height) {
                    return p;
                }
            }
            return null;
        },

        useHint() {
            if (this.hintsRemaining <= 0) return null;
            
            this.hintsRemaining--;
            
            const unlockedPieces = this.pieces.filter(p => !p.isLocked);
            if (unlockedPieces.length === 0) return null;
            
            let bestPiece = null;
            let minDistance = Infinity;
            
            unlockedPieces.forEach(piece => {
                const distance = Math.sqrt(
                    Math.pow(piece.currentX - piece.targetX, 2) +
                    Math.pow(piece.currentY - piece.targetY, 2)
                );
                
                if (distance < minDistance) {
                    minDistance = distance;
                    bestPiece = piece;
                }
            });
            
            return bestPiece;
        },

        nextLevel() {
            return this.init(this.currentLevel + 1);
        },

        getProgress() {
            return {
                completed: this.completedPieces,
                total: this.pieces.length,
                hints: this.hintsRemaining,
                level: this.currentLevel
            };
        },

        getPiecesForRender() {
            return this.pieces.map(p => ({
                ...p,
                displayX: p.isLocked ? p.targetX : p.currentX,
                displayY: p.isLocked ? p.targetY : p.currentY
            }));
        },

        getImage() {
            return this.puzzleImage;
        },

        hasImage() {
            return this.imageLoaded && window.PuzzleConfig.enableImageMode;
        }
    };

})();