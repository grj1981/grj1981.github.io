'use strict';

(function() {
    // 存在则先清理，防止页面刷新后旧状态残留
if (window.TouchManager) {
    if (window.TouchManager.cleanup) {
        window.TouchManager.cleanup();
    }
}

    window.TouchManager = {
        touchEvents: new Map(),
        gestureConfig: {
            longPressDuration: 500,
            doubleTapDelay: 300,
            sensitivity: 1.0,
            dragThreshold: 15,
            rotationSensitivity: 1.0
        },
        touches: new Map(),
        lastTapTime: 0,
        tapCount: 0,
        isLongPress: false,
        longPressTimer: null,
        _eventHandlers: {
            mouseDown: null,
            mouseMove: null,
            mouseUp: null,
            touchStart: null,
            touchMove: null,
            touchEnd: null,
            touchCancel: null,
            dblClick: null
        },

        // 初始化
        init(canvas) {
            this.canvas = canvas;
            this.setupGestures(canvas);
            this.detectDeviceType();
        },

        // 检测设备类型
        detectDeviceType() {
            const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            // 根据设备类型调整配置
            if (isTouchDevice) {
                this.gestureConfig.dragThreshold = 20;
                this.gestureConfig.doubleTapDelay = 300;
            }
            
            if (isMobile) {
                this.gestureConfig.sensitivity = 1.2;
            }
        },

        // 设置手势
        setupGestures(canvas) {
            if (!canvas) return;

            // 清理旧的事件绑定
            this.cleanupEventListeners(canvas);

            // 存储 canvas 引用
            this.canvas = canvas;

            // 鼠标事件
            this._eventHandlers.mouseDown = (e) => this.handleMouseDown(e);
            this._eventHandlers.mouseMove = (e) => this.handleMouseMove(e);
            this._eventHandlers.mouseUp = (e) => this.handleMouseUp(e);
            this._eventHandlers.dblClick = (e) => this.handleDoubleTap(e);

            canvas.addEventListener('mousedown', this._eventHandlers.mouseDown);
            canvas.addEventListener('mousemove', this._eventHandlers.mouseMove);
            canvas.addEventListener('mouseup', this._eventHandlers.mouseUp);
            canvas.addEventListener('mouseleave', this._eventHandlers.mouseUp);
            canvas.addEventListener('dblclick', this._eventHandlers.dblClick);

            // 触摸事件
            this._eventHandlers.touchStart = (e) => this.handleTouchStart(e);
            this._eventHandlers.touchMove = (e) => this.handleTouchMove(e);
            this._eventHandlers.touchEnd = (e) => this.handleTouchEnd(e);
            this._eventHandlers.touchCancel = (e) => this.handleTouchCancel(e);

            canvas.addEventListener('touchstart', this._eventHandlers.touchStart, { passive: false });
            canvas.addEventListener('touchmove', this._eventHandlers.touchMove, { passive: false });
            canvas.addEventListener('touchend', this._eventHandlers.touchEnd, { passive: false });
            canvas.addEventListener('touchcancel', this._eventHandlers.touchCancel, { passive: false });

            // 阻止默认行为
            canvas.style.touchAction = 'none';
            canvas.style.webkitTouchCallout = 'none';
        },

        // 触摸开始
        handleTouchStart(e) {
            e.preventDefault();
            
            const touches = e.changedTouches;
            if (!touches.length) return;

            const touch = touches[0];
            const touchId = touch.identifier || 0;

            this.touches.set(touchId, {
                startX: touch.clientX,
                startY: touch.clientY,
                currentX: touch.clientX,
                currentY: touch.clientY,
                startTime: Date.now(),
                isDragging: false,
                isTap: false
            });

            // 启动长按检测
            this.startLongPressDetection(touchId, touch);

            // 触发down事件
            this.triggerEvent('touchstart', {
                x: touch.clientX,
                y: touch.clientY,
                touchId: touchId
            });
        },

        // 触摸移动
        handleTouchMove(e) {
            e.preventDefault();
            
            const touches = e.changedTouches;
            if (!touches.length) return;

            const touch = touches[0];
            const touchId = touch.identifier || 0;
            const storedTouch = this.touches.get(touchId);

            if (!storedTouch) return;

            // 取消长按 - 只要手指移动就取消
            this.cancelLongPress();

            // 如果已经触发过长按，不再响应拖拽
            if (this.isLongPress) return;

            // 计算移动距离
            const dx = touch.clientX - storedTouch.startX;
            const dy = touch.clientY - storedTouch.startY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // 超过阈值，开始拖拽
            if (distance > this.gestureConfig.dragThreshold && !storedTouch.isDragging) {
                storedTouch.isDragging = true;
                this.triggerEvent('dragstart', {
                    x: touch.clientX,
                    y: touch.clientY,
                    touchId: touchId
                });
            }

            if (storedTouch.isDragging) {
                storedTouch.currentX = touch.clientX;
                storedTouch.currentY = touch.clientY;

                this.triggerEvent('dragmove', {
                    x: touch.clientX,
                    y: touch.clientY,
                    dx: touch.clientX - storedTouch.startX,
                    dy: touch.clientY - storedTouch.startY,
                    touchId: touchId
                });
            }
        },

        // 触摸结束
        handleTouchEnd(e) {
            e.preventDefault();
            
            const touches = e.changedTouches;
            if (!touches.length) return;

            const touch = touches[0];
            const touchId = touch.identifier || 0;
            const storedTouch = this.touches.get(touchId);

            if (!storedTouch) return;

            // 取消长按 - 只要手指移动就取消
            this.cancelLongPress();

            // 如果已经触发过长按，不再响应拖拽
            if (this.isLongPress) return;

            // 计算移动距离
            const dx = touch.clientX - storedTouch.startX;
            const dy = touch.clientY - storedTouch.startY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // 超过阈值，开始拖拽
            if (distance > this.gestureConfig.dragThreshold && !storedTouch.isDragging) {
                storedTouch.isDragging = true;
                this.triggerEvent('dragstart', {
                    x: e.clientX,
                    y: e.clientY,
                    touchId: 0
                });
            }

            if (storedTouch.isDragging) {
                storedTouch.currentX = e.clientX;
                storedTouch.currentY = e.clientY;

                this.triggerEvent('dragmove', {
                    x: e.clientX,
                    y: e.clientY,
                    dx: dx,
                    dy: dy,
                    touchId: 0
                });
            }
        },

        // 鼠标按下
        handleMouseDown(e) {
            const mouseId = 0;
            this.touches.set(mouseId, {
                startX: e.clientX,
                startY: e.clientY,
                currentX: e.clientX,
                currentY: e.clientY,
                startTime: Date.now(),
                isDragging: false,
                isTap: false
            });
            
            this.startLongPressDetection(mouseId, { clientX: e.clientX, clientY: e.clientY });
            
            this.triggerEvent('touchstart', {
                x: e.clientX,
                y: e.clientY,
                touchId: mouseId
            });
        },

        // 鼠标移动
        handleMouseMove(e) {
            const mouseId = 0;
            const storedTouch = this.touches.get(mouseId);
            
            if (!storedTouch) return;
            
            this.cancelLongPress();
            
            if (this.isLongPress) return;
            
            const dx = e.clientX - storedTouch.startX;
            const dy = e.clientY - storedTouch.startY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > this.gestureConfig.dragThreshold && !storedTouch.isDragging) {
                storedTouch.isDragging = true;
                this.triggerEvent('dragstart', {
                    x: e.clientX,
                    y: e.clientY,
                    touchId: mouseId
                });
            }
            
            if (storedTouch.isDragging) {
                storedTouch.currentX = e.clientX;
                storedTouch.currentY = e.clientY;
                
                this.triggerEvent('dragmove', {
                    x: e.clientX,
                    y: e.clientY,
                    dx: dx,
                    dy: dy,
                    touchId: mouseId
                });
            }
        },

        // 鼠标释放
        handleMouseUp(e) {
            const storedTouch = this.touches.get(0);
            if (!storedTouch) return;

            this.cancelLongPress();

            const duration = Date.now() - storedTouch.startTime;
            const distance = Math.sqrt(
                Math.pow(e.clientX - storedTouch.startX, 2) +
                Math.pow(e.clientY - storedTouch.startY, 2)
            );

            if (storedTouch.isDragging) {
                this.triggerEvent('dragend', {
                    x: e.clientX,
                    y: e.clientY,
                    touchId: 0
                });
            } else if (duration < 300 && distance < 10) {
                this.handleTap(e.clientX, e.clientY);
            }

            this.touches.delete(0);
        },

        // 处理点击/轻触
        handleTap(x, y) {
            const now = Date.now();
            const timeSinceLastTap = now - this.lastTapTime;
            const isDoubleTap = timeSinceLastTap < this.gestureConfig.doubleTapDelay;

            this.lastTapTime = now;
            this.tapCount = isDoubleTap ? this.tapCount + 1 : 1;

            if (isDoubleTap && this.tapCount >= 2) {
                // 双击
                this.triggerEvent('doubletap', { x, y });
                this.tapCount = 0;
            } else {
                // 单击
                this.triggerEvent('tap', { x, y });
            }
        },

        // 处理双击（桌面端）
        handleDoubleTap(e) {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            this.triggerEvent('doubletap', { x, y });
        },

        // 长按检测开始
        startLongPressDetection(touchId, touch) {
            this.isLongPress = false;
            
            this.longPressTimer = setTimeout(() => {
                this.isLongPress = true;
                this.triggerEvent('longpress', {
                    x: touch.clientX,
                    y: touch.clientY,
                    touchId: touchId
                });
            }, this.gestureConfig.longPressDuration);
        },

        // 取消长按
        cancelLongPress() {
            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
            }
        },

        // 配置事件处理
        on(event, callback) {
            if (!this.touchEvents.has(event)) {
                this.touchEvents.set(event, new Set());
            }
            this.touchEvents.get(event).add(callback);
        },

        // 触发事件
        triggerEvent(event, data) {
            const handlers = this.touchEvents.get(event);
            if (handlers) {
                handlers.forEach(callback => {
                    try {
                        callback(data);
                    } catch (error) {
                        console.error(`Touch event handler error: ${event}`, error);
                    }
                });
            }
        },

        // 获取配置
        getConfig() {
            return { ...this.gestureConfig };
        },

        // 设置配置
        setConfig(config) {
            Object.assign(this.gestureConfig, config);
        },

        // 获取设备信息
        getDeviceInfo() {
            return {
                isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
                isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
                maxTouchPoints: navigator.maxTouchPoints,
                pixelRatio: window.devicePixelRatio || 1
            };
        },

        // 清理事件监听器
        cleanupEventListeners(canvas) {
            const c = canvas || this.canvas;
            if (!c) return;

            // 确保 _eventHandlers 存在
            if (!this._eventHandlers) {
                this._eventHandlers = {
                    mouseDown: null, mouseMove: null, mouseUp: null,
                    touchStart: null, touchMove: null, touchEnd: null,
                    touchCancel: null, dblClick: null
                };
                return;
            }

            if (this._eventHandlers.mouseDown) {
                c.removeEventListener('mousedown', this._eventHandlers.mouseDown);
            }
            if (this._eventHandlers.mouseMove) {
                c.removeEventListener('mousemove', this._eventHandlers.mouseMove);
            }
            if (this._eventHandlers.mouseUp) {
                c.removeEventListener('mouseup', this._eventHandlers.mouseUp);
                c.removeEventListener('mouseleave', this._eventHandlers.mouseUp);
            }
            if (this._eventHandlers.dblClick) {
                c.removeEventListener('dblclick', this._eventHandlers.dblClick);
            }
            if (this._eventHandlers.touchStart) {
                c.removeEventListener('touchstart', this._eventHandlers.touchStart);
            }
            if (this._eventHandlers.touchMove) {
                c.removeEventListener('touchmove', this._eventHandlers.touchMove);
            }
            if (this._eventHandlers.touchEnd) {
                c.removeEventListener('touchend', this._eventHandlers.touchEnd);
            }
            if (this._eventHandlers.touchCancel) {
                c.removeEventListener('touchcancel', this._eventHandlers.touchCancel);
            }

            this._eventHandlers = {
                mouseDown: null,
                mouseMove: null,
                mouseUp: null,
                touchStart: null,
                touchMove: null,
                touchEnd: null,
                touchCancel: null,
                dblClick: null
            };
        },

        // 清理
        cleanup() {
            this.cleanupEventListeners();
            this.touches.clear();
            this.cancelLongPress();
            this.touchEvents.clear();
            this.canvas = null;
        }
    };

})();