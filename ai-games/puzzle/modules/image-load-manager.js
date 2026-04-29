'use strict';

(function() {
    if (window.ImageLoadManager) return;

    window.ImageLoadManager = {
        maxRetries: 3,
        currentRetry: 0,
        sources: [
            'https://picsum.photos',
            'https://api.paugram.com/wallpaper/',
            'https://source.unsplash.com/1600x900'
        ],
        currentIndex: 0,
        currentLoad: null,
        loadingCallbacks: new Map(),
        loadingProgress: null,
        isFallbackMode: false,

        init() {
            this.loadingProgress = document.createElement('div');
            this.loadingProgress.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 20px;
                border-radius: 10px;
                font-size: 16px;
                z-index: 1000;
                display: none;
            `;
            document.body.appendChild(this.loadingProgress);
        },

        // 显示加载进度
        showLoadingProgress(message = '加载图片中...') {
            if (this.loadingProgress) {
                this.loadingProgress.textContent = message;
                this.loadingProgress.style.display = 'block';
            }
        },

        // 隐藏加载进度
        hideLoadingProgress() {
            if (this.loadingProgress) {
                this.loadingProgress.style.display = 'none';
            }
        },

        // 切换图片源
        switchSource() {
            this.currentIndex = (this.currentIndex + 1) % this.sources.length;
            this.currentRetry = 0;
        },

        // 设置图片源
        setImageSource(index) {
            if (index >= 0 && index < this.sources.length) {
                this.currentIndex = index;
                this.currentRetry = 0;
            }
        },

        // 添加图片源
        addImageSource(url) {
            if (url && !this.sources.includes(url)) {
                this.sources.push(url);
            }
        },

        // 移除图片源
        removeImageSource(url) {
            const index = this.sources.indexOf(url);
            if (index > -1) {
                this.sources.splice(index, 1);
                if (this.currentIndex >= this.sources.length) {
                    this.currentIndex = 0;
                }
            }
        },

        // 获取当前图片源
        getCurrentSource() {
            return this.sources[this.currentIndex];
        },

        // 生成图片URL
        generateImageUrl(width, height, seed) {
            const source = this.getCurrentSource();
            const timestamp = Date.now();
            
            if (source.includes('picsum.photos')) {
                return `${source}/${width}/${height}?random=${seed || timestamp}`;
            } else if (source.includes('api.paugram.com')) {
                return `${source}?type=nature&t=${seed || timestamp}`;
            } else if (source.includes('placeholder.com')) {
                return `${source}/${width}x${height}?text=Puzzle+${seed || timestamp}`;
            } else if (source.includes('source.unsplash.com')) {
                return `${source}/1600x900?sig=${seed || timestamp}`;
            } else {
                return `${source}?width=${width}&height=${height}&seed=${seed || timestamp}`;
            }
        },

        // 预加载图片
        preloadImages(imageUrls, onProgress, onComplete) {
            const loadedCount = 0;
            const totalUrls = imageUrls.length;
            
            imageUrls.forEach((url, index) => {
                this.loadImage(url)
                    .then(() => {
                        loadedCount++;
                        if (onProgress) {
                            onProgress(loadedCount, totalUrls);
                        }
                        
                        if (loadedCount === totalUrls && onComplete) {
                            onComplete();
                        }
                    })
                    .catch(error => {
                        console.warn(`预加载失败: ${url}`, error);
                        loadedCount++;
                        if (onProgress) {
                            onProgress(loadedCount, totalUrls);
                        }
                        
                        if (loadedCount === totalUrls && onComplete) {
                            onComplete();
                        }
                    });
            });
        },

        // 主要的图片加载方法
        loadImage(url, retryCount = 0) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                
                // 设置超时
                const timeout = setTimeout(() => {
                    this.handleImageError(img, resolve, reject, retryCount, 'timeout');
                }, 15000);
                
                img.onload = () => {
                    clearTimeout(timeout);
                    this.hideLoadingProgress();
                    this.isFallbackMode = false;
                    resolve(img);
                };
                
                img.onerror = () => {
                    clearTimeout(timeout);
                    this.handleImageError(img, resolve, reject, retryCount, 'error');
                };
                
                // 显示加载状态
                if (!this.isFallbackMode) {
                    this.showLoadingProgress(`正在加载图片... (源${this.currentIndex + 1}/${this.sources.length})`);
                }
                
                img.src = url;
            });
        },

        // 处理图片加载错误
        handleImageError(img, resolve, reject, retryCount, errorType) {
            if (retryCount < this.maxRetries) {
                this.currentRetry = retryCount + 1;
                this.switchSource();
                
                const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
                console.warn(`图片加载失败，${delay}ms后重试... (尝试 ${retryCount + 1}/${this.maxRetries})`);
                
                setTimeout(() => {
                    const newUrl = this.generateImageUrl(img.naturalWidth || 500, img.naturalHeight || 400);
                    this.loadImage(newUrl, retryCount + 1)
                        .then(resolve)
                        .catch(reject);
                }, delay);
            } else {
                console.warn('图片加载失败，使用备用方案');
                this.hideLoadingProgress();
                this.showFallbackMode();
                reject(new Error(`图片加载失败: ${errorType}`));
            }
        },

        // 显示备用模式
        showFallbackMode() {
            this.isFallbackMode = true;
            if (this.loadingProgress) {
                this.loadingProgress.innerHTML = `
                    <div>图片加载失败</div>
                    <div style="margin-top: 10px; font-size: 14px;">使用纯色模式继续游戏</div>
                `;
                setTimeout(() => {
                    this.hideLoadingProgress();
                }, 2000);
            }
        },

        // 带重试机制的图片加载
        loadImageWithRetry(url, options = {}) {
            const {
                maxRetries = this.maxRetries,
                retryDelay = 1000,
                onRetry = null,
                timeout = 15000
            } = options;

            return new Promise((resolve, reject) => {
                const attemptLoad = (attempt = 0) => {
                    const img = new Image();
                    
                    const timeoutId = setTimeout(() => {
                        attemptLoad(attempt + 1);
                    }, timeout);
                    
                    img.onload = () => {
                        clearTimeout(timeoutId);
                        this.hideLoadingProgress();
                        resolve(img);
                    };
                    
                    img.onerror = () => {
                        clearTimeout(timeoutId);
                        
                        if (attempt < maxRetries) {
                            if (onRetry) {
                                onRetry(attempt, maxRetries);
                            }
                            
                            setTimeout(() => {
                                attemptLoad(attempt + 1);
                            }, retryDelay * Math.pow(2, attempt));
                        } else {
                            this.showFallbackMode();
                            reject(new Error(`图片加载失败，已重试${maxRetries}次`));
                        }
                    };
                    
                    this.showLoadingProgress(`加载图片... (${attempt + 1}/${maxRetries})`);
                    img.src = url;
                };
                
                attemptLoad();
            });
        },

        // 从canvas创建图片
        imageFromCanvas(canvas, quality = 0.9) {
            return new Promise((resolve, reject) => {
                try {
                    canvas.toBlob(
                        (blob) => {
                            const url = URL.createObjectURL(blob);
                            const img = new Image();
                            
                            img.onload = () => {
                                URL.revokeObjectURL(url);
                                resolve(img);
                            };
                            
                            img.onerror = () => {
                                URL.revokeObjectURL(url);
                                reject(new Error('Canvas转图片失败'));
                            };
                            
                            img.src = url;
                        },
                        'image/jpeg',
                        quality
                    );
                } catch (error) {
                    reject(error);
                }
            });
        },

        // 图片压缩
        compressImage(img, maxWidth, maxHeight, quality = 0.8) {
            return new Promise((resolve, reject) => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // 计算压缩尺寸
                const ratio = Math.min(maxWidth / img.width, maxHeight / img.height);
                const width = img.width * ratio;
                const height = img.height * ratio;
                
                canvas.width = width;
                canvas.height = height;
                
                // 绘制压缩后的图片
                ctx.drawImage(img, 0, 0, width, height);
                
                // 转换为Blob
                canvas.toBlob(
                    (blob) => {
                        const url = URL.createObjectURL(blob);
                        const compressedImg = new Image();
                        
                        compressedImg.onload = () => {
                            URL.revokeObjectURL(url);
                            resolve(compressedImg);
                        };
                        
                        compressedImg.onerror = () => {
                            URL.revokeObjectURL(url);
                            reject(new Error('图片压缩失败'));
                        };
                        
                        compressedImg.src = url;
                    },
                    'image/jpeg',
                    quality
                );
            });
        },

        // 检查图片加载
        checkImageLoaded(img) {
            return new Promise((resolve) => {
                if (img.complete) {
                    resolve(true);
                } else {
                    img.onload = () => resolve(true);
                    img.onerror = () => resolve(false);
                }
            });
        },

        // 批量加载图片
        loadImages(urls, options = {}) {
            const {
                concurrency = 3,
                onProgress = null,
                onComplete = null,
                onError = null
            } = options;

            return new Promise((resolve) => {
                const results = [];
                let loaded = 0;
                let failed = 0;
                
                const loadNext = (index) => {
                    if (index >= urls.length) {
                        if (onComplete) onComplete(results, loaded, failed);
                        return;
                    }
                    
                    this.loadImage(urls[index])
                        .then(img => {
                            results[index] = { success: true, data: img };
                            loaded++;
                        })
                        .catch(error => {
                            results[index] = { success: false, error: error };
                            failed++;
                            if (onError) onError(error, index);
                        })
                        .finally(() => {
                            if (onProgress) {
                                onProgress(loaded + failed, urls.length, index);
                            }
                            loadNext(index + 1);
                        });
                };
                
                // 并发控制
                for (let i = 0; i < Math.min(concurrency, urls.length); i++) {
                    loadNext(i);
                }
            });
        },

        // 清理资源
        cleanup() {
            if (this.loadingProgress) {
                document.body.removeChild(this.loadingProgress);
                this.loadingProgress = null;
            }
            
            // 清理所有未完成的加载
            if (this.currentLoad) {
                this.currentLoad = null;
            }
        }
    };

})();