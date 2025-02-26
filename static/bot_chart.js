class BotChart {
    constructor(mainCanvasId, miniCanvasId, logFunc = console.log) {
        this.mainCanvas = document.getElementById(mainCanvasId);
        this.miniCanvas = document.getElementById(miniCanvasId);
        if (!this.mainCanvas || !this.miniCanvas) {
            throw new Error('Canvas elements not found');
        }
        this.mainCtx = this.mainCanvas.getContext('2d', { antialias: true }); // Включаем антиалиасинг
        this.miniCtx = this.miniCanvas.getContext('2d', { antialias: true }); // Включаем антиалиасинг
        this.log = logFunc;
        this.chartCache = null;
        this.chartType = 'candlestick';
        this.darkMode = document.body.classList.contains('dark-mode');
        this.zoomLevel = 1;
        this.offset = 0;
        this.indicators = { sma: true, rsi: true, macd: false, bollinger: false, vwap: false, stochastic: false };
        this.lastCandles = [];
        this.miniRangeStart = 0;
        this.miniRangeEnd = 1;
        this.draggingStart = false;
        this.draggingEnd = false;
        this.crosshairX = -1;
        this.crosshairY = -1;
        this.liveCrosshairX = -1; // Для LIVE режима
        this.liveCrosshairY = -1; // Для LIVE режима
        this.drawing = false;
        this.lines = [];
        this.signals = [];
        this.tooltip = { x: -1, y: -1, data: null };
        this.cachedIndicators = new Map();
        this.showGaps = true;
        this.currentTimeframe = '1d';
        this.liveMode = false;
        this.liveInterval = null;
        this.redrawRequested = false;

        // Учитываем devicePixelRatio для повышения чёткости
        const dpr = window.devicePixelRatio || 1;
        this.resizeCanvas(dpr);
        window.addEventListener('resize', () => this.resizeCanvas(dpr));
        this.addZoomListeners();
        this.addRangeSliders();
        this.addCrosshairListeners();
        this.addDrawingListeners();
    }

    resizeCanvas(dpr = 1) {
        const mainWidth = this.mainCanvas.parentElement.offsetWidth;
        const mainHeight = this.mainCanvas.parentElement.offsetHeight * 0.85;
        const miniWidth = this.miniCanvas.parentElement.offsetWidth;
        const miniHeight = this.mainCanvas.parentElement.offsetHeight * 0.1;

        // Устанавливаем физический размер и размер в пикселях с учётом dpr
        this.mainCanvas.width = mainWidth * dpr;
        this.mainCanvas.height = mainHeight * dpr;
        this.mainCanvas.style.width = `${mainWidth}px`;
        this.mainCanvas.style.height = `${mainHeight}px`;
        this.mainCtx.scale(dpr, dpr);

        this.miniCanvas.width = miniWidth * dpr;
        this.miniCanvas.height = miniHeight * dpr;
        this.miniCanvas.style.width = `${miniWidth}px`;
        this.miniCanvas.style.height = `${miniHeight}px`;
        this.miniCtx.scale(dpr, dpr);

        // Сбрасываем начальные значения ползунков при ресайзе
        this.miniRangeStart = 0;
        this.miniRangeEnd = 1;
        this.offset = 0;
        this.zoomLevel = 1;
        if (this.chartCache) this.draw(this.chartCache.candles);
    }

    setChartType(type) {
        this.chartType = type;
        if (this.chartCache) this.draw(this.chartCache.candles);
    }

    setDarkMode(isDark) {
        this.darkMode = isDark;
        this.mainCanvas.style.background = isDark ? 'linear-gradient(135deg, #2c3e50, #4a69bd)' : 'linear-gradient(135deg, #f5f7fa, #c3cfe2)';
        this.miniCanvas.style.background = isDark ? '#34495e' : '#ffffff';
        if (this.chartCache) this.draw(this.chartCache.candles);
    }

    setIndicators(settings) {
        this.indicators = { ...this.indicators, ...settings };
        this.cachedIndicators.clear();
        if (this.chartCache) this.draw(this.chartCache.candles);
    }

    setShowGaps(show) {
        this.showGaps = show;
        if (this.chartCache) this.draw(this.chartCache.candles);
    }

    setTimeframe(timeframe) {
        this.currentTimeframe = timeframe;
        if (this.chartCache) this.draw(this.chartCache.candles);
    }

    clearLines() {
        this.lines = [];
        if (this.chartCache) this.draw(this.chartCache.candles);
        document.getElementById('clear-drawing-btn').style.display = 'none';
    }

    clearCache() {
        this.chartCache = null;
        this.cachedIndicators.clear();
        this.log("Кэш графика очищен");
    }

    startLiveMode(fetchCallback) {
        if (this.liveMode) return;
        this.liveMode = true;
        let lastTimestamp = this.chartCache ? this.chartCache.candles[this.chartCache.candles.length - 1].time : 0;
        this.liveInterval = setInterval(async () => {
            try {
                const newCandles = await fetchCallback(this.currentTimeframe);
                if (newCandles && newCandles.length > 0) {
                    const latestCandle = newCandles[newCandles.length - 1];
                    if (latestCandle && latestCandle.time > lastTimestamp) {
                        this.lastCandles = [...this.lastCandles, latestCandle];
                        this.chartCache = { candles: this.lastCandles };
                        this.updateLiveCrosshair(latestCandle);
                        this.draw(this.lastCandles);
                        lastTimestamp = latestCandle.time;
                        this.log(`LIVE: Добавлена новая свеча ${new Date(latestCandle.time).toLocaleString()}`);
                    } else {
                        this.log('LIVE: Нет новых данных или время свечи не обновлено', 'warn');
                    }
                } else {
                    this.log('LIVE: Пустой ответ от сервера', 'warn');
                }
            } catch (error) {
                this.log(`LIVE: Ошибка получения данных: ${error.message}`, 'error');
            }
        }, 1000); // Обновление каждую секунду для частого обновления
        this.log("LIVE режим включён");
    }

    stopLiveMode() {
        if (!this.liveMode) return;
        clearInterval(this.liveInterval);
        this.liveMode = false;
        this.liveCrosshairX = -1;
        this.liveCrosshairY = -1;
        this.log("LIVE режим выключён");
        this.draw(this.lastCandles); // Перерисовываем без LIVE перекрестия
    }

    updateLiveCrosshair(candle) {
        if (!this.liveMode || !candle) return;
        const visibleCandles = this.lastCandles.slice(this.startIndex, this.endIndex);
        const chartWidth = (this.mainCanvas.width / (window.devicePixelRatio || 1)) - 50; // Учитываем dpr
        const xStep = Math.max(1, chartWidth / (visibleCandles.length - 1 || 1)); // Минимальный шаг 1px
        const candleIndex = this.lastCandles.findIndex(c => c.time === candle.time);
        if (candleIndex >= 0) {
            const relativeIndex = candleIndex - this.startIndex;
            if (relativeIndex >= 0 && relativeIndex < visibleCandles.length) {
                const x = 50 + relativeIndex * xStep;
                const y = (this.mainCanvas.height / (window.devicePixelRatio || 1)) - 20 - (candle.close - this.minPrice) * this.yScale;
                this.liveCrosshairX = x;
                this.liveCrosshairY = y;
            } else {
                this.liveCrosshairX = -1;
                this.liveCrosshairY = -1;
            }
        } else {
            this.liveCrosshairX = -1;
            this.liveCrosshairY = -1;
        }
    }

    addZoomListeners() {
        let lastZoomTime = 0;
        this.mainCanvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const now = Date.now();
            if (now - lastZoomTime < 100) return;
            lastZoomTime = now;

            const rect = this.mainCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const padding = 50;
            const chartWidth = (this.mainCanvas.width / (window.devicePixelRatio || 1)) - 2 * padding;

            const cursorPosition = Math.max(0, Math.min(1, (x - padding) / chartWidth));
            const visibleRange = 1 / this.zoomLevel;

            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            const newZoomLevel = Math.max(0.1, Math.min(5, this.zoomLevel * zoomFactor));
            const newVisibleRange = 1 / newZoomLevel;

            const oldCenter = this.offset + cursorPosition * visibleRange;
            this.offset = oldCenter - cursorPosition * newVisibleRange;
            this.offset = Math.max(0, Math.min(1 - newVisibleRange, this.offset));
            this.zoomLevel = newZoomLevel;

            this.miniRangeStart = this.offset;
            this.miniRangeEnd = this.offset + newVisibleRange;

            if (this.chartCache) this.draw(this.chartCache.candles);
        });
    }

    addRangeSliders() {
        let dragMiddle = false;
        let initialX;

        this.miniCanvas.addEventListener('mousedown', (e) => {
            const rect = this.miniCanvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) / (this.miniCanvas.width / (window.devicePixelRatio || 1));
            initialX = x;
            if (Math.abs(x - this.miniRangeStart) < 0.05) {
                this.draggingStart = true;
            } else if (Math.abs(x - this.miniRangeEnd) < 0.05) {
                this.draggingEnd = true;
            } else if (x > this.miniRangeStart && x < this.miniRangeEnd) {
                dragMiddle = true;
            }
        });

        this.miniCanvas.addEventListener('mousemove', (e) => {
            const rect = this.miniCanvas.getBoundingClientRect();
            const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / (this.miniCanvas.width / (window.devicePixelRatio || 1))));
            const rangeWidth = this.miniRangeEnd - this.miniRangeStart;
            if (this.draggingStart) {
                this.miniRangeStart = Math.max(0, Math.min(x, this.miniRangeEnd - 0.01));
                this.offset = this.miniRangeStart;
                this.zoomLevel = Math.max(0.1, 1 / (this.miniRangeEnd - this.miniRangeStart));
                this.draw(this.lastCandles);
            } else if (this.draggingEnd) {
                this.miniRangeEnd = Math.min(1, Math.max(x, this.miniRangeStart + 0.01));
                this.zoomLevel = Math.max(0.1, 1 / (this.miniRangeEnd - this.miniRangeStart));
                this.draw(this.lastCandles);
            } else if (dragMiddle) {
                const delta = x - initialX;
                const newStart = Math.max(0, Math.min(1 - rangeWidth, this.miniRangeStart + delta));
                this.miniRangeStart = newStart;
                this.miniRangeEnd = newStart + rangeWidth;
                this.offset = this.miniRangeStart;
                initialX = x;
                this.draw(this.lastCandles);
            }
        });

        this.miniCanvas.addEventListener('mouseup', () => {
            this.draggingStart = false;
            this.draggingEnd = false;
            dragMiddle = false;
        });

        this.miniCanvas.addEventListener('mouseleave', () => {
            this.draggingStart = false;
            this.draggingEnd = false;
            dragMiddle = false;
        });
    }

    addCrosshairListeners() {
        this.mainCanvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.mainCanvas.addEventListener('mouseleave', () => {
            this.crosshairX = -1;
            this.crosshairY = -1;
            this.tooltip = { x: -1, y: -1, data: null };
            this.requestRedraw(this.lastCandles);
        });
    }

    handleMouseMove(event) {
        if (!this.chartCache || !this.chartCache.candles || this.chartCache.candles.length === 0) return;

        const rect = this.mainCanvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const padding = 50;
        const visibleCandles = this.lastCandles.slice(this.startIndex, this.endIndex);
        const chartWidth = (this.mainCanvas.width / (window.devicePixelRatio || 1)) - padding;

        if (x < padding || x > this.mainCanvas.width || y < padding || y > this.mainCanvas.height - padding) {
            this.crosshairX = -1;
            this.crosshairY = -1;
            this.tooltip = { x: -1, y: -1, data: null };
            this.requestRedraw(this.lastCandles);
            return;
        }

        this.crosshairX = x;

        // Рассчитываем положение свечи для точного прилипания
        const xStep = Math.max(1, chartWidth / (visibleCandles.length - 1 || 1));
        const candleIndex = Math.min(visibleCandles.length - 1, Math.max(0, Math.round((x - padding) / xStep)));
        const candle = visibleCandles[candleIndex];

        if (!candle) {
            this.crosshairX = -1;
            this.crosshairY = -1;
            this.tooltip = { x: -1, y: -1, data: null };
            this.requestRedraw(this.lastCandles);
            return;
        }

        const snappedX = padding + candleIndex * xStep;
        this.crosshairX = snappedX;

        let snappedY;
        if (this.chartType === 'scatter' || this.chartType === 'candlestick') {
            snappedY = (this.mainCanvas.height / (window.devicePixelRatio || 1)) - 20 - (candle.close - this.minPrice) * this.yScale;
        } else {
            snappedY = y;
        }
        this.crosshairY = snappedY;

        this.tooltip = { x: snappedX, y: snappedY, data: candle };
        this.requestRedraw(this.lastCandles);
    }

    addDrawingListeners() {
        let startX, startY;
        this.mainCanvas.addEventListener('mousedown', (e) => {
            if (!this.drawing) return;
            const rect = this.mainCanvas.getBoundingClientRect();
            startX = e.clientX - rect.left;
            startY = e.clientY - rect.top;
            this.lines.push({ startX, startY, endX: startX, endY: startY });
        });

        this.mainCanvas.addEventListener('mousemove', (e) => {
            if (this.drawing && this.lines.length > 0) {
                const rect = this.mainCanvas.getBoundingClientRect();
                const endX = e.clientX - rect.left;
                const endY = e.clientY - rect.top;
                this.lines[this.lines.length - 1] = { startX, startY, endX, endY };
                this.draw(this.lastCandles);
            }
        });

        this.mainCanvas.addEventListener('mouseup', (e) => {
            if (this.drawing && this.lines.length > 0) {
                const rect = this.mainCanvas.getBoundingClientRect();
                const endX = e.clientX - rect.left;
                const endY = e.clientY - rect.top;
                this.lines[this.lines.length - 1] = { startX, startY, endX, endY };
                document.getElementById('clear-drawing-btn').style.display = 'inline-block';
                this.draw(this.lastCandles);
            }
        });
    }

    toggleDrawing() {
        this.drawing = !this.drawing;
        this.log(`Режим рисования линий: ${this.drawing ? 'включён' : 'выключён'}`);
    }

    draw(candles) {
        if (!candles || candles.length === 0) {
            this.mainCtx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
            this.miniCtx.clearRect(0, 0, this.miniCanvas.width, this.miniCanvas.height);
            this.mainCtx.fillStyle = this.darkMode ? '#ddd' : '#333';
            this.mainCtx.font = '16px Arial';
            this.mainCtx.textAlign = 'center';
            this.mainCtx.fillText('Нет данных для отображения', this.mainCanvas.width / 2, this.mainCanvas.height / 2);
            return;
        }

        this.lastCandles = candles;
        this.mainCtx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
        this.miniCtx.clearRect(0, 0, this.miniCanvas.width, this.miniCanvas.height);

        const visibleCandles = Math.floor(candles.length / this.zoomLevel);
        this.startIndex = Math.floor(this.offset * (candles.length - visibleCandles));
        this.endIndex = Math.min(this.startIndex + visibleCandles, candles.length);
        const visibleData = candles.slice(this.startIndex, this.endIndex);

        const prices = visibleData.map(c => c.close);
        this.minPrice = Math.min(...visibleData.map(c => this.chartType === 'bar' ? 0 : c.low));
        this.maxPrice = Math.max(...visibleData.map(c => this.chartType === 'bar' ? c.volume : c.high));
        const priceRange = this.maxPrice - this.minPrice || 1;
        this.yScale = ((this.mainCanvas.height / (window.devicePixelRatio || 1)) - 60) / priceRange;
        const volumeMax = Math.max(...visibleData.map(c => c.volume));
        const volumeScale = ((this.mainCanvas.height / (window.devicePixelRatio || 1)) - 60) / volumeMax;

        this.mainCtx.fillStyle = this.darkMode ? '#141721' : '#ffffff';
        this.mainCtx.fillRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);

        this.drawGrid(visibleData, this.minPrice, this.maxPrice, this.yScale);
        this.drawMiniChart(candles);
        this.drawAxes(visibleData, this.minPrice, this.maxPrice, this.yScale);

        const chartWidth = (this.mainCanvas.width / (window.devicePixelRatio || 1)) - 50; // Пространство для свечей
        const xStep = Math.max(1, chartWidth / (visibleData.length - 1 || 1)); // Минимальный шаг 1px
        switch (this.chartType) {
            case 'scatter':
                this.drawLineChart(visibleData, xStep, this.yScale, this.minPrice);
                break;
            case 'candlestick':
                this.drawCandleChart(visibleData, xStep, this.yScale, this.minPrice);
                break;
            case 'bar':
                this.drawVolumeChart(visibleData, xStep, volumeScale);
                break;
        }

        if (this.indicators.sma || this.indicators.rsi || this.indicators.macd || this.indicators.bollinger || this.indicators.vwap || this.indicators.stochastic) {
            this.drawIndicators(visibleData, xStep, this.yScale, this.minPrice);
        }

        this.drawLines();
        this.drawSignals(visibleData, xStep, this.yScale, this.minPrice);
        this.drawCrosshair(visibleData, xStep, this.yScale, this.minPrice);
        this.highlightCurrentPrice(visibleData, xStep, this.yScale, this.minPrice); // Подсветка текущей цены
    }

    drawGrid(candles, minPrice, maxPrice, yScale) {
        this.mainCtx.strokeStyle = this.darkMode ? '#2a2e39' : '#ebedf0';
        this.mainCtx.lineWidth = 1; // Более чёткие линии
        const priceStep = (maxPrice - minPrice) / 5;
        for (let i = 0; i <= 5; i++) {
            const y = (this.mainCanvas.height / (window.devicePixelRatio || 1)) - 20 - (i * priceStep) * yScale;
            this.mainCtx.beginPath();
            this.mainCtx.moveTo(50, y);
            this.mainCtx.lineTo(this.mainCanvas.width, y);
            this.mainCtx.stroke();
        }
        const xStep = (this.mainCanvas.width / (window.devicePixelRatio || 1) - 50) / 5;
        for (let i = 0; i <= 5; i++) {
            const x = 50 + i * xStep;
            this.mainCtx.beginPath();
            this.mainCtx.moveTo(x, 0);
            this.mainCtx.lineTo(x, (this.mainCanvas.height / (window.devicePixelRatio || 1)) - 20);
            this.mainCtx.stroke();
        }
    }

    drawLineChart(candles, xStep, yScale, minPrice) {
        this.mainCtx.strokeStyle = '#00C087';
        this.mainCtx.lineWidth = 2; // Более чёткая линия
        this.mainCtx.beginPath();
        let isTradingClosed = false;
        candles.forEach((candle, i) => {
            const x = 50 + i * xStep;
            const y = (this.mainCanvas.height / (window.devicePixelRatio || 1)) - 20 - (candle.close - minPrice) * yScale;
            if (this.showGaps && i > 0 && candle.time - candles[i - 1].time > 86400000) {
                isTradingClosed = true;
                this.mainCtx.stroke();
                this.mainCtx.beginPath();
            }
            if (i === 0 || isTradingClosed) {
                this.mainCtx.moveTo(x, y);
                isTradingClosed = false;
            } else {
                this.mainCtx.lineTo(x, y);
            }
        });
        this.mainCtx.stroke();

        const lastCandle = candles[candles.length - 1];
        const lastY = (this.mainCanvas.height / (window.devicePixelRatio || 1)) - 20 - (lastCandle.close - minPrice) * yScale;
        this.mainCtx.fillStyle = this.darkMode ? '#00C087' : '#000000';
        this.mainCtx.font = '14px Arial';
        this.mainCtx.textAlign = 'right';
        this.mainCtx.fillText(lastCandle.close.toFixed(2), (this.mainCanvas.width / (window.devicePixelRatio || 1)) - 5, lastY + 5);
    }

    drawCandleChart(candles, xStep, yScale, minPrice) {
        const candleWidth = Math.max(6, Math.min(12, xStep * 0.6)); // Более чёткая ширина свечей
        candles.forEach((candle, i) => {
            const x = 50 + i * xStep;
            const openY = (this.mainCanvas.height / (window.devicePixelRatio || 1)) - 20 - (candle.open - minPrice) * yScale;
            const closeY = (this.mainCanvas.height / (window.devicePixelRatio || 1)) - 20 - (candle.close - minPrice) * yScale;
            const highY = (this.mainCanvas.height / (window.devicePixelRatio || 1)) - 20 - (candle.high - minPrice) * yScale;
            const lowY = (this.mainCanvas.height / (window.devicePixelRatio || 1)) - 20 - (candle.low - minPrice) * yScale;

            this.mainCtx.strokeStyle = candle.close >= candle.open ? '#00C087' : '#FF5252';
            this.mainCtx.lineWidth = 1; // Чёткие линии
            this.mainCtx.beginPath();
            this.mainCtx.moveTo(x, highY);
            this.mainCtx.lineTo(x, lowY);
            this.mainCtx.stroke();

            this.mainCtx.fillStyle = candle.close >= candle.open ? 'rgba(0, 192, 135, 0.9)' : 'rgba(255, 82, 82, 0.9)';
            const candleHeight = Math.abs(openY - closeY);
            this.mainCtx.fillRect(x - candleWidth / 2, Math.min(openY, closeY), candleWidth, candleHeight || 1);

            // Подсвечиваем последнюю свечу, если это текущая цена
            if (i === candles.length - 1 && this.liveMode) {
                const prevCandle = i > 0 ? candles[i - 1] : null;
                let highlightColor = '#FFCA28'; // Жёлтый по умолчанию (цена на месте)
                if (prevCandle) {
                    if (candle.close > prevCandle.close) highlightColor = '#00C087'; // Зелёный (рост)
                    else if (candle.close < prevCandle.close) highlightColor = '#FF5252'; // Красный (падение)
                }
                this.mainCtx.strokeStyle = highlightColor; // Цвет подсветки
                this.mainCtx.lineWidth = 2;
                this.mainCtx.strokeRect(x - candleWidth / 2 - 2, Math.min(openY, closeY) - 2, candleWidth + 4, candleHeight + 4);
            }
        });
    }

    drawVolumeChart(candles, xStep, volumeScale) {
        const barWidth = Math.max(6, Math.min(12, xStep * 0.6)); // Чёткая ширина баров
        candles.forEach((candle, i) => {
            const x = 50 + i * xStep;
            const height = candle.volume * volumeScale;
            this.mainCtx.fillStyle = 'rgba(0, 192, 135, 0.7)';
            this.mainCtx.fillRect(x - barWidth / 2, (this.mainCanvas.height / (window.devicePixelRatio || 1)) - 20 - height, barWidth, height);

            // Подсвечиваем последний бар, если это текущая цена
            if (i === candles.length - 1 && this.liveMode) {
                const prevCandle = i > 0 ? candles[i - 1] : null;
                let highlightColor = '#FFCA28'; // Жёлтый по умолчанию (цена на месте)
                if (prevCandle) {
                    if (candle.close > prevCandle.close) highlightColor = '#00C087'; // Зелёный (рост)
                    else if (candle.close < prevCandle.close) highlightColor = '#FF5252'; // Красный (падение)
                }
                this.mainCtx.strokeStyle = highlightColor; // Цвет подсветки
                this.mainCtx.lineWidth = 2;
                this.mainCtx.strokeRect(x - barWidth / 2 - 2, (this.mainCanvas.height / (window.devicePixelRatio || 1)) - 20 - height - 2, barWidth + 4, height + 4);
            }
        });
    }

    drawMiniChart(candles) {
        const xStep = Math.max(1, (this.miniCanvas.width / (window.devicePixelRatio || 1)) / (candles.length - 1 || 1)); // Минимальный шаг 1px для ровности
        const prices = candles.map(c => c.close);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const yScale = ((this.miniCanvas.height / (window.devicePixelRatio || 1)) - 20) / (maxPrice - minPrice || 1);

        this.miniCtx.fillStyle = this.darkMode ? '#354052' : '#f5f7fa';
        this.miniCtx.fillRect(0, 0, this.miniCanvas.width, this.miniCanvas.height);

        this.miniCtx.strokeStyle = '#00C087';
        this.miniCtx.lineWidth = 2; // Чёткая линия
        this.miniCtx.beginPath();
        candles.forEach((candle, i) => {
            const x = i * xStep;
            const y = (this.miniCanvas.height / (window.devicePixelRatio || 1)) - 10 - (candle.close - minPrice) * yScale;
            if (i === 0) this.miniCtx.moveTo(x, y);
            else this.miniCtx.lineTo(x, y);
        });
        this.miniCtx.stroke();

        const startX = Math.max(0, Math.min((this.miniCanvas.width / (window.devicePixelRatio || 1)) - 5, this.miniRangeStart * (this.miniCanvas.width / (window.devicePixelRatio || 1))));
        const endX = Math.max(0, Math.min((this.miniCanvas.width / (window.devicePixelRatio || 1)) - 5, this.miniRangeEnd * (this.miniCanvas.width / (window.devicePixelRatio || 1))));
        this.miniCtx.fillStyle = 'rgba(169, 169, 169, 0.2)';
        this.miniCtx.fillRect(startX, 0, Math.max(0, endX - startX), this.miniCanvas.height);

        this.miniCtx.fillStyle = '#00C087';
        const sliderWidth = 10;
        this.miniCtx.fillRect(startX - sliderWidth / 2, 0, sliderWidth, this.miniCanvas.height);
        this.miniCtx.fillRect(endX - sliderWidth / 2, 0, sliderWidth, this.miniCanvas.height);

        // Подсветка текущей цены в мини-графике
        if (this.liveMode && this.lastCandles.length > 0) {
            const lastCandle = this.lastCandles[this.lastCandles.length - 1];
            const lastX = (this.lastCandles.findIndex(c => c.time === lastCandle.time)) * xStep;
            const lastY = (this.miniCanvas.height / (window.devicePixelRatio || 1)) - 10 - (lastCandle.close - minPrice) * yScale;
            const prevCandle = this.lastCandles.length > 1 ? this.lastCandles[this.lastCandles.length - 2] : null;
            let highlightColor = '#FFCA28'; // Жёлтый по умолчанию (цена на месте)
            if (prevCandle) {
                if (lastCandle.close > prevCandle.close) highlightColor = '#00C087'; // Зелёный (рост)
                else if (lastCandle.close < prevCandle.close) highlightColor = '#FF5252'; // Красный (падение)
            }
            this.miniCtx.strokeStyle = highlightColor; // Цвет подсветки
            this.miniCtx.lineWidth = 2;
            this.miniCtx.beginPath();
            this.miniCtx.moveTo(lastX, 0);
            this.miniCtx.lineTo(lastX, (this.miniCanvas.height / (window.devicePixelRatio || 1)));
            this.miniCtx.stroke();
            this.miniCtx.fillStyle = highlightColor;
            this.miniCtx.font = '10px Arial';
            this.miniCtx.textAlign = 'left';
            this.miniCtx.fillText(lastCandle.close.toFixed(2), lastX + 5, (this.miniCanvas.height / (window.devicePixelRatio || 1)) - 5);
        }
    }

    drawAxes(candles, minPrice, maxPrice, yScale) {
        this.mainCtx.fillStyle = this.darkMode ? '#b2b5be' : '#787b86';
        this.mainCtx.font = '12px Arial'; // Более читаемый шрифт

        this.mainCtx.textAlign = 'right';
        const priceStep = (maxPrice - minPrice) / 5;
        for (let i = 0; i <= 5; i++) {
            const price = minPrice + i * priceStep;
            const y = (this.mainCanvas.height / (window.devicePixelRatio || 1)) - 20 - (price - minPrice) * yScale;
            this.mainCtx.fillText(price.toFixed(2), 45, y + 4);
        }

        this.mainCtx.textAlign = 'center';
        const visibleData = candles;
        const xStep = (this.mainCanvas.width / (window.devicePixelRatio || 1) - 50) / (visibleData.length - 1 || 1);
        const timeStep = Math.max(1, Math.floor(visibleData.length / 5));

        for (let i = 0; i <= 5; i++) {
            const index = Math.min(i * timeStep, visibleData.length - 1);
            if (index >= 0 && index < visibleData.length) {
                const x = 50 + index * xStep;
                const date = new Date(visibleData[index].time);
                const label = ['1d', '1w', '1M'].includes(this.currentTimeframe) 
                    ? date.toLocaleDateString() 
                    : date.toLocaleTimeString();
                this.mainCtx.fillText(label, x, (this.mainCanvas.height / (window.devicePixelRatio || 1)) - 5);
            }
        }
    }

    drawCrosshair(candles, xStep, yScale, minPrice) {
        const dpr = window.devicePixelRatio || 1;

        // Обычное перекрестие (при наведении мыши)
        if (this.crosshairX >= 0 && this.crosshairY >= 0) {
            this.mainCtx.strokeStyle = this.darkMode ? '#b2b5be' : '#787b86';
            this.mainCtx.lineWidth = 1;
            this.mainCtx.setLineDash([5, 5]);

            this.mainCtx.beginPath();
            this.mainCtx.moveTo(this.crosshairX, 0);
            this.mainCtx.lineTo(this.crosshairX, (this.mainCanvas.height / dpr) - 20);
            this.mainCtx.stroke();

            this.mainCtx.beginPath();
            this.mainCtx.moveTo(50, this.crosshairY);
            this.mainCtx.lineTo(this.mainCanvas.width, this.crosshairY);
            this.mainCtx.stroke();

            this.mainCtx.setLineDash([]);

            const index = Math.round(((this.crosshairX - 50) / dpr) / xStep);
            if (index >= 0 && index < candles.length) {
                const candle = candles[index];
                const time = new Date(candle.time);

                const price = this.chartType === 'bar' ? candle.volume : candle.close;
                this.mainCtx.fillStyle = this.darkMode ? '#b2b5be' : '#787b86';
                this.mainCtx.font = '14px Arial';
                this.mainCtx.textAlign = 'right';
                this.mainCtx.fillText(price.toFixed(2), 45, this.crosshairY + 4);

                this.mainCtx.textAlign = 'center';
                this.mainCtx.fillText(
                    ['1d', '1w', '1M'].includes(this.currentTimeframe) ? time.toLocaleDateString() : time.toLocaleTimeString(),
                    this.crosshairX,
                    (this.mainCanvas.height / dpr) - 5
                );

                // Сдвигаем текст подсказки, если она уходит за правый край
                const tooltipX = Math.min(this.crosshairX + 10, (this.mainCanvas.width / dpr) - 160); // 150 + 10 для отступа
                const tooltipY = this.crosshairY - 90;
                this.mainCtx.fillStyle = this.darkMode ? '#2a2e39' : '#ebedf0';
                this.mainCtx.fillRect(tooltipX, tooltipY, 150, 110);
                this.mainCtx.fillStyle = this.darkMode ? '#b2b5be' : '#787b86';
                this.mainCtx.font = '12px Arial';
                this.mainCtx.textAlign = 'left';
                this.mainCtx.fillText(`O: ${candle.open.toFixed(2)} ₽`, tooltipX + 5, tooltipY + 15);
                this.mainCtx.fillText(`H: ${candle.high.toFixed(2)} ₽`, tooltipX + 5, tooltipY + 30);
                this.mainCtx.fillText(`L: ${candle.low.toFixed(2)} ₽`, tooltipX + 5, tooltipY + 45);
                this.mainCtx.fillText(`C: ${candle.close.toFixed(2)} ₽`, tooltipX + 5, tooltipY + 60);
                this.mainCtx.fillText(`V: ${candle.volume}`, tooltipX + 5, tooltipY + 75);
                this.mainCtx.fillText(`Время: ${time.toLocaleString()}`, tooltipX + 5, tooltipY + 90);
            }
        }

        // Красное перекрестие для LIVE режима (текущая цена)
        if (this.liveMode && this.liveCrosshairX >= 0 && this.liveCrosshairY >= 0) {
            this.mainCtx.strokeStyle = '#FF5252'; // Красный цвет для LIVE
            this.mainCtx.lineWidth = 1;
            this.mainCtx.setLineDash([5, 5]);

            this.mainCtx.beginPath();
            this.mainCtx.moveTo(this.liveCrosshairX, 0);
            this.mainCtx.lineTo(this.liveCrosshairX, (this.mainCanvas.height / dpr) - 20);
            this.mainCtx.stroke();

            this.mainCtx.beginPath();
            this.mainCtx.moveTo(50, this.liveCrosshairY);
            this.mainCtx.lineTo(this.mainCanvas.width, this.liveCrosshairY);
            this.mainCtx.stroke();

            this.mainCtx.setLineDash([]);

            const lastCandle = this.lastCandles[this.lastCandles.length - 1];
            if (lastCandle) {
                const time = new Date(lastCandle.time);
                const price = this.chartType === 'bar' ? lastCandle.volume : lastCandle.close;

                this.mainCtx.fillStyle = '#FF5252'; // Красный цвет текста для LIVE
                this.mainCtx.font = '14px Arial';
                this.mainCtx.textAlign = 'right';
                this.mainCtx.fillText(price.toFixed(2), 45, this.liveCrosshairY + 4);

                this.mainCtx.textAlign = 'center';
                this.mainCtx.fillText(
                    ['1d', '1w', '1M'].includes(this.currentTimeframe) ? time.toLocaleDateString() : time.toLocaleTimeString(),
                    this.liveCrosshairX,
                    (this.mainCanvas.height / dpr) - 5
                );

                // Сдвигаем текст подсказки LIVE, если он уходит за правый край
                const tooltipX = Math.min(this.liveCrosshairX + 10, (this.mainCanvas.width / dpr) - 160); // 150 + 10 для отступа
                const tooltipY = this.liveCrosshairY - 90;
                this.mainCtx.fillStyle = this.darkMode ? '#2a2e39' : '#ebedf0';
                this.mainCtx.fillRect(tooltipX, tooltipY, 150, 110);
                this.mainCtx.fillStyle = '#FF5252';
                this.mainCtx.font = '12px Arial';
                this.mainCtx.textAlign = 'left';
                this.mainCtx.fillText(`O: ${lastCandle.open.toFixed(2)} ₽`, tooltipX + 5, tooltipY + 15);
                this.mainCtx.fillText(`H: ${lastCandle.high.toFixed(2)} ₽`, tooltipX + 5, tooltipY + 30);
                this.mainCtx.fillText(`L: ${lastCandle.low.toFixed(2)} ₽`, tooltipX + 5, tooltipY + 45);
                this.mainCtx.fillText(`C: ${lastCandle.close.toFixed(2)} ₽`, tooltipX + 5, tooltipY + 60);
                this.mainCtx.fillText(`V: ${lastCandle.volume}`, tooltipX + 5, tooltipY + 75);
                this.mainCtx.fillText(`Время: ${time.toLocaleString()}`, tooltipX + 5, tooltipY + 90);
            }
        }
    }

    drawLines() {
        this.mainCtx.strokeStyle = '#FFEB3B';
        this.mainCtx.lineWidth = 2;
        this.lines.forEach(line => {
            this.mainCtx.beginPath();
            this.mainCtx.moveTo(line.startX, line.startY);
            this.mainCtx.lineTo(line.endX, line.endY);
            this.mainCtx.stroke();
        });
    }

    drawSignals(candles, xStep, yScale, minPrice) {
        this.signals = [];
        if (this.indicators.macd) {
            const macd = this.calculateMACD(candles);
            for (let i = 1; i < macd.macd.length; i++) {
                if (macd.macd[i - 1] < macd.signal[i - 1] && macd.macd[i] > macd.signal[i]) {
                    this.signals.push({ index: i, type: 'buy' });
                } else if (macd.macd[i - 1] > macd.signal[i - 1] && macd.macd[i] < macd.signal[i]) {
                    this.signals.push({ index: i, type: 'sell' });
                }
            }
        }
        if (this.indicators.rsi) {
            const rsi = this.calculateRSI(candles);
            for (let i = 0; i < rsi.length; i++) {
                if (rsi[i] && rsi[i] < 30) this.signals.push({ index: i, type: 'buy' });
                if (rsi[i] && rsi[i] > 70) this.signals.push({ index: i, type: 'sell' });
            }
        }

        const botActions = window.getBotActions ? window.getBotActions() : [];
        botActions.forEach(action => {
            const candleIndex = candles.findIndex(c => c.time >= action.time);
            if (candleIndex >= 0) {
                this.signals.push({ index: candleIndex, type: action.type });
            }
        });

        this.signals.forEach(signal => {
            const x = 50 + signal.index * xStep;
            const y = (this.mainCanvas.height / (window.devicePixelRatio || 1)) - 20 - (candles[signal.index].close - minPrice) * yScale;
            this.mainCtx.fillStyle = signal.type === 'buy' ? '#00C087' : '#FF5252';
            this.mainCtx.beginPath();
            this.mainCtx.arc(x, y, 5, 0, Math.PI * 2);
            this.mainCtx.fill();
            this.mainCtx.fillText(signal.type === 'buy' ? '↑' : '↓', x - 3, y - 10);
        });
    }

    drawIndicators(candles, xStep, yScale, minPrice) {
        const cacheKey = JSON.stringify({ candles, indicators: this.indicators });
        if (this.cachedIndicators.has(cacheKey)) {
            const cached = this.cachedIndicators.get(cacheKey);
            this.drawCachedIndicators(cached, xStep, yScale, minPrice);
            return;
        }

        const results = {};
        if (this.indicators.sma) results.sma = this.calculateSMA(candles, 20);
        if (this.indicators.rsi) results.rsi = this.calculateRSI(candles);
        if (this.indicators.macd) results.macd = this.calculateMACD(candles);
        if (this.indicators.bollinger) results.bollinger = this.calculateBollingerBands(candles);
        if (this.indicators.vwap) results.vwap = this.calculateVWAP(candles);
        if (this.indicators.stochastic) results.stochastic = this.calculateStochastic(candles);

        this.cachedIndicators.set(cacheKey, results);
        this.drawCachedIndicators(results, xStep, yScale, minPrice);
    }

    drawCachedIndicators(results, xStep, yScale, minPrice) {
        const dpr = window.devicePixelRatio || 1;
        if (results.sma) {
            this.mainCtx.strokeStyle = '#ff9800';
            this.mainCtx.lineWidth = 2; // Чёткая линия
            this.mainCtx.beginPath();
            results.sma.forEach((value, i) => {
                if (value !== null) {
                    const x = 50 + i * xStep;
                    const y = (this.mainCanvas.height / dpr) - 20 - (value - minPrice) * yScale;
                    if (i === 19) this.mainCtx.moveTo(x, y);
                    else this.mainCtx.lineTo(x, y);
                }
            });
            this.mainCtx.stroke();
        }

        if (results.rsi) {
            const rsiScale = ((this.mainCanvas.height / dpr) - 60) / 100;
            this.mainCtx.strokeStyle = '#9c27b0';
            this.mainCtx.lineWidth = 2;
            this.mainCtx.beginPath();
            results.rsi.forEach((value, i) => {
                if (value !== null) {
                    const x = 50 + i * xStep;
                    const y = (this.mainCanvas.height / dpr) - 20 - value * rsiScale;
                    if (i === 14) this.mainCtx.moveTo(x, y);
                    else this.mainCtx.lineTo(x, y);
                }
            });
            this.mainCtx.stroke();
        }

        if (results.macd) {
            const macdScale = ((this.mainCanvas.height / dpr) - 60) / (Math.max(...results.macd.macd.map(Math.abs)) || 1);
            this.mainCtx.strokeStyle = '#2962FF';
            this.mainCtx.lineWidth = 2;
            this.mainCtx.beginPath();
            results.macd.macd.forEach((value, i) => {
                if (value !== null) {
                    const x = 50 + i * xStep;
                    const y = (this.mainCanvas.height / dpr) / 2 - value * macdScale;
                    if (i === 12) this.mainCtx.moveTo(x, y);
                    else this.mainCtx.lineTo(x, y);
                }
            });
            this.mainCtx.stroke();

            this.mainCtx.strokeStyle = '#FF6D00';
            this.mainCtx.lineWidth = 2;
            this.mainCtx.beginPath();
            results.macd.signal.forEach((value, i) => {
                if (value !== null) {
                    const x = 50 + i * xStep;
                    const y = (this.mainCanvas.height / dpr) / 2 - value * macdScale;
                    if (i === 26) this.mainCtx.moveTo(x, y);
                    else this.mainCtx.lineTo(x, y);
                }
            });
            this.mainCtx.stroke();

            this.mainCtx.fillStyle = 'rgba(128, 128, 128, 0.3)';
            results.macd.histogram.forEach((value, i) => {
                if (value !== null) {
                    const x = 50 + i * xStep;
                    const height = value * macdScale;
                    const y = height >= 0 ? (this.mainCanvas.height / dpr) / 2 - height : (this.mainCanvas.height / dpr) / 2;
                    this.mainCtx.fillRect(x - xStep * 0.4, y, xStep * 0.8, Math.abs(height));
                }
            });
        }

        if (results.bollinger) {
            this.mainCtx.strokeStyle = '#2196F3';
            this.mainCtx.lineWidth = 2;
            this.mainCtx.beginPath();
            results.bollinger.upper.forEach((value, i) => {
                if (value !== null) {
                    const x = 50 + i * xStep;
                    const y = (this.mainCanvas.height / dpr) - 20 - (value - minPrice) * yScale;
                    if (i === 20) this.mainCtx.moveTo(x, y);
                    else this.mainCtx.lineTo(x, y);
                }
            });
            this.mainCtx.stroke();

            this.mainCtx.beginPath();
            results.bollinger.lower.forEach((value, i) => {
                if (value !== null) {
                    const x = 50 + i * xStep;
                    const y = (this.mainCanvas.height / dpr) - 20 - (value - minPrice) * yScale;
                    if (i === 20) this.mainCtx.moveTo(x, y);
                    else this.mainCtx.lineTo(x, y);
                }
            });
            this.mainCtx.stroke();
        }

        if (results.vwap) {
            this.mainCtx.strokeStyle = '#F06292';
            this.mainCtx.lineWidth = 2;
            this.mainCtx.beginPath();
            results.vwap.forEach((value, i) => {
                if (value !== null) {
                    const x = 50 + i * xStep;
                    const y = (this.mainCanvas.height / dpr) - 20 - (value - minPrice) * yScale;
                    if (i === 0) this.mainCtx.moveTo(x, y);
                    else this.mainCtx.lineTo(x, y);
                }
            });
            this.mainCtx.stroke();
        }

        if (results.stochastic) {
            const stochScale = ((this.mainCanvas.height / dpr) - 60) / 100;
            this.mainCtx.strokeStyle = '#26A69A';
            this.mainCtx.lineWidth = 2;
            this.mainCtx.beginPath();
            results.stochastic.k.forEach((value, i) => {
                if (value !== null) {
                    const x = 50 + i * xStep;
                    const y = (this.mainCanvas.height / dpr) - 20 - value * stochScale;
                    if (i === 14) this.mainCtx.moveTo(x, y);
                    else this.mainCtx.lineTo(x, y);
                }
            });
            this.mainCtx.stroke();

            this.mainCtx.strokeStyle = '#EF5350';
            this.mainCtx.beginPath();
            results.stochastic.d.forEach((value, i) => {
                if (value !== null) {
                    const x = 50 + i * xStep;
                    const y = (this.mainCanvas.height / dpr) - 20 - value * stochScale;
                    if (i === 16) this.mainCtx.moveTo(x, y);
                    else this.mainCtx.lineTo(x, y);
                }
            });
            this.mainCtx.stroke();
        }
    }

    highlightCurrentPrice(candles, xStep, yScale, minPrice) {
        if (this.liveMode && this.lastCandles.length > 0) {
            const lastCandle = this.lastCandles[this.lastCandles.length - 1];
            const visibleIndex = candles.findIndex(c => c.time === lastCandle.time);
            if (visibleIndex >= 0) {
                const x = 50 + visibleIndex * xStep;
                const y = (this.mainCanvas.height / (window.devicePixelRatio || 1)) - 20 - (lastCandle.close - minPrice) * yScale;

                // Определяем цвет на основе изменения относительно предыдущей свечи
                const prevCandle = this.lastCandles.length > 1 ? this.lastCandles[this.lastCandles.length - 2] : null;
                let highlightColor = '#FFCA28'; // Жёлтый по умолчанию (цена на месте)
                if (prevCandle) {
                    if (lastCandle.close > prevCandle.close) highlightColor = '#00C087'; // Зелёный (рост)
                    else if (lastCandle.close < prevCandle.close) highlightColor = '#FF5252'; // Красный (падение)
                }

                // Подсветка линии текущей цены
                this.mainCtx.strokeStyle = highlightColor; // Цвет в зависимости от изменения
                this.mainCtx.lineWidth = 2;
                this.mainCtx.setLineDash([5, 5]);
                this.mainCtx.beginPath();
                this.mainCtx.moveTo(50, y);
                this.mainCtx.lineTo((this.mainCanvas.width / (window.devicePixelRatio || 1)), y);
                this.mainCtx.stroke();
                this.mainCtx.setLineDash([]);

                // Текст текущей цены
                this.mainCtx.fillStyle = highlightColor;
                this.mainCtx.font = '14px Arial';
                this.mainCtx.textAlign = 'right';
                this.mainCtx.fillText(lastCandle.close.toFixed(2), (this.mainCanvas.width / (window.devicePixelRatio || 1)) - 5, y - 5);
            }
        }
    }

    calculateSMA(candles, period) {
        const sma = [];
        for (let i = 0; i < candles.length; i++) {
            if (i < period - 1) {
                sma.push(null);
            } else {
                const slice = candles.slice(i - period + 1, i + 1);
                const avg = slice.reduce((sum, c) => sum + c.close, 0) / period;
                sma.push(avg);
            }
        }
        return sma;
    }

    calculateRSI(candles) {
        const rsiPeriod = 14;
        const rsi = [];
        let avgGain = 0;
        let avgLoss = 0;
        for (let i = 0; i < candles.length; i++) {
            if (i === 0) {
                rsi.push(null);
                continue;
            }
            const diff = candles[i].close - candles[i - 1].close;
            const gain = diff > 0 ? diff : 0;
            const loss = diff < 0 ? -diff : 0;
            if (i < rsiPeriod) {
                avgGain += gain / rsiPeriod;
                avgLoss += loss / rsiPeriod;
                rsi.push(null);
            } else if (i === rsiPeriod) {
                avgGain += gain / rsiPeriod;
                avgLoss += loss / rsiPeriod;
                const rs = avgGain / (avgLoss || 0.0001);
                rsi.push(100 - (100 / (1 + rs)));
            } else {
                avgGain = (avgGain * (rsiPeriod - 1) + gain) / rsiPeriod;
                avgLoss = (avgLoss * (rsiPeriod - 1) + loss) / rsiPeriod;
                const rs = avgGain / (avgLoss || 0.0001);
                rsi.push(100 - (100 / (1 + rs)));
            }
        }
        return rsi;
    }

    calculateMACD(candles) {
        const ema12 = this.calculateEMA(candles, 12);
        const ema26 = this.calculateEMA(candles, 26);
        const macd = [];
        const signal = [];
        const histogram = [];

        for (let i = 0; i < candles.length; i++) {
            if (i < 26) {
                macd.push(null);
                signal.push(null);
                histogram.push(null);
            } else {
                macd.push(ema12[i] - ema26[i]);
                if (i >= 34) {
                    const signalSlice = macd.slice(i - 9, i + 1);
                    signal.push(signalSlice.reduce((sum, val) => sum + val, 0) / 9);
                    histogram.push(macd[i] - signal[i - 9]);
                } else {
                    signal.push(null);
                    histogram.push(null);
                }
            }
        }

        return { macd, signal, histogram };
    }

    calculateEMA(candles, period) {
        const k = 2 / (period + 1);
        const ema = [candles[0].close];
        for (let i = 1; i < candles.length; i++) {
            ema.push(candles[i].close * k + ema[i - 1] * (1 - k));
        }
        return ema;
    }

    calculateBollingerBands(candles) {
        const period = 20;
        const multiplier = 2;
        const sma = this.calculateSMA(candles, period);
        const upper = [];
        const lower = [];

        for (let i = 0; i < candles.length; i++) {
            if (i < period - 1) {
                upper.push(null);
                lower.push(null);
            } else {
                const slice = candles.slice(i - period + 1, i + 1);
                const mean = sma[i];
                const stdDev = Math.sqrt(slice.reduce((sum, c) => sum + Math.pow(c.close - mean, 2), 0) / period);
                upper.push(mean + multiplier * stdDev);
                lower.push(mean - multiplier * stdDev);
            }
        }
        return { upper, lower };
    }

    calculateVWAP(candles) {
        const vwap = [];
        let cumulativePriceVolume = 0;
        let cumulativeVolume = 0;

        for (let i = 0; i < candles.length; i++) {
            const typicalPrice = (candles[i].high + candles[i].low + candles[i].close) / 3;
            cumulativePriceVolume += typicalPrice * candles[i].volume;
            cumulativeVolume += candles[i].volume;
            vwap.push(cumulativePriceVolume / (cumulativeVolume || 1));
        }
        return vwap;
    }

    calculateStochastic(candles) {
        const period = 14;
        const smoothK = 3;
        const smoothD = 3;
        const kValues = [];
        const dValues = [];

        for (let i = 0; i < candles.length; i++) {
            if (i < period - 1) {
                kValues.push(null);
                dValues.push(null);
            } else {
                const slice = candles.slice(i - period + 1, i + 1);
                const highestHigh = Math.max(...slice.map(c => c.high));
                const lowestLow = Math.min(...slice.map(c => c.low));
                const k = ((candles[i].close - lowestLow) / (highestHigh - lowestLow || 1)) * 100;
                kValues.push(k);
                if (i >= period + smoothK - 2) {
                    const kSlice = kValues.slice(i - smoothK + 1, i + 1);
                    const smoothedK = kSlice.reduce((sum, val) => sum + val, 0) / smoothK;
                    if (i >= period + smoothK + smoothD - 3) {
                        const dSlice = kValues.slice(i - smoothD + 1, i + 1).map((_, idx) => {
                            const subSlice = kValues.slice(i - smoothD - smoothK + idx + 2, i - smoothD + idx + 2 + smoothK);
                            return subSlice.reduce((sum, val) => sum + val, 0) / smoothK;
                        });
                        dValues.push(dSlice.reduce((sum, val) => sum + val, 0) / smoothD);
                    } else {
                        dValues.push(null);
                    }
                } else {
                    dValues.push(null);
                }
            }
        }
        return { k: kValues, d: dValues };
    }

    requestRedraw(candles) {
        if (!this.redrawRequested) {
            this.redrawRequested = true;
            requestAnimationFrame(() => {
                this.draw(candles);
                this.redrawRequested = false;
            });
        }
    }
}

export default BotChart;