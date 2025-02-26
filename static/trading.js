import BotChart from './bot_chart.js';
import { startTrading, stopTrading, getBotActions } from './bot_trading.js';
import { initializeML, getPrediction } from './ml_model.js';
import { logToConsole, renderPortfolio, addTab, closeTab, updateTickerData, calculatePerformance, setChartType } from './utils.js';

document.addEventListener('DOMContentLoaded', async function() {
    const chartCanvas = document.getElementById('chart-canvas');
    const miniChartCanvas = document.getElementById('mini-chart-canvas');
    if (!chartCanvas || !miniChartCanvas) {
        console.error('Не найдены Canvas элементы с ID "chart-canvas" или "mini-chart-canvas"');
        return;
    }

    const chart = new BotChart('chart-canvas', 'mini-chart-canvas', logToConsole);
    const consoleOutput = document.getElementById('console-output');
    const orderbookArea = document.getElementById('orderbook-area');
    const portfolioArea = document.getElementById('portfolio-area');
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const tickerTabs = document.getElementById('tickerTabs');
    const tabsPanel = document.querySelector('.tabs-panel');
    const addTabBtn = document.getElementById('add-tab-btn');
    const noTickerMessage = document.getElementById('no-ticker-message');
    const lineChartBtn = document.getElementById('line-chart-btn');
    const candleChartBtn = document.getElementById('candle-chart-btn');
    const volumeChartBtn = document.getElementById('volume-chart-btn');
    const clearDrawingBtn = document.getElementById('clear-drawing-btn');
    const drawingCheckbox = document.getElementById('drawing-checkbox');
    const showGapsCheckbox = document.getElementById('show-gaps-checkbox');
    const clearCacheBtn = document.getElementById('clear-cache-btn');
    const smaCheckbox = document.getElementById('sma-checkbox');
    const rsiCheckbox = document.getElementById('rsi-checkbox');
    const macdCheckbox = document.getElementById('macd-checkbox');
    const bollingerCheckbox = document.getElementById('bollinger-checkbox');
    const vwapCheckbox = document.getElementById('vwap-checkbox');
    const stochasticCheckbox = document.getElementById('stochastic-checkbox');
    const devModeCheckbox = document.getElementById('dev-mode-checkbox');
    const modeToggle = document.getElementById('mode-toggle');
    const modeLabel = document.getElementById('mode-label');
    const buyBtn = document.getElementById('buy-btn');
    const sellBtn = document.getElementById('sell-btn');
    const orderButtons = document.getElementById('order-buttons');
    const marketStatus = document.getElementById('market-status');
    const virtualBalanceInput = document.getElementById('virtual-balance-input');
    const virtualBalanceSection = document.getElementById('virtual-balance-section');
    const tradeModeSelect = document.getElementById('trade-mode');
    const strategySelect = document.getElementById('strategy-select');
    const strategySettings = document.getElementById('strategy-settings');
    const startBotBtn = document.getElementById('start-bot-btn');
    const resetSettingsBtn = document.getElementById('reset-settings-btn');
    const liveModeBtn = document.getElementById('live-mode-btn');
    let lastPriceMap = {};
    let currentTimeframe = '1d';
    let devMode = true;
    let tradingMode = 'training';
    let botRunning = false;
    let currentChartType = 'candlestick';
    let scheduleInterval = null;
    let lastScheduleUpdate = 0;

    window.currentTicker = initialData.ticker;
    window.currentFigi = initialData.figi;
    window.getBotActions = getBotActions;

    modeToggle.checked = false;
    modeLabel.textContent = 'Обучение';
    tradeModeSelect.value = 'training';

    // Функции кэширования
    function cacheData(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            logToConsole(`Сохранено в кэш: ${key}`, 'info', consoleOutput, devMode);
        } catch (e) {
            logToConsole(`Ошибка сохранения в localStorage: ${e.message}`, 'error', consoleOutput, devMode);
        }
    }

    function getCachedData(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            logToConsole(`Ошибка чтения из localStorage: ${e.message}`, 'error', consoleOutput, devMode);
            return null;
        }
    }

    function isCacheFresh(cachedData, ttl = 60) {
        if (!cachedData || !cachedData.timestamp) return false;
        const now = Math.floor(Date.now() / 1000);
        return (now - cachedData.timestamp) < ttl;
    }

    // Инициализация WebSocket
    let ws;
    function initWebSocket() {
        if (!window.currentFigi) {
            logToConsole('FIGI не определён, WebSocket не запускается', 'warn', consoleOutput, devMode);
            return;
        }
        ws = new WebSocket('ws://127.0.0.1:9001');
        ws.onopen = () => {
            logToConsole('WebSocket подключен', 'info', consoleOutput, devMode);
            ws.send(JSON.stringify({ figi: window.currentFigi }));
        };
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            logToConsole(`Получены данные WebSocket: ${JSON.stringify(data)}`, 'info', consoleOutput, devMode);
            if (data.figi === window.currentFigi) {
                cacheData(`price_${window.currentFigi}`, {
                    price: data.price,
                    lastPrice: data.lastPrice || 0,
                    change: data.change || 0,
                    market_open: data.market_open,
                    timestamp: Math.floor(Date.now() / 1000)
                });
                updatePriceDisplay({
                    price: data.price,
                    lastPrice: data.lastPrice || 0,
                    change: data.change || 0,
                    market_open: data.market_open
                });
                // Обновляем график, если в LIVE режиме
                if (chart.liveMode) {
                    chart.lastCandles = chart.lastCandles.map(c => c.time === data.time ? { ...c, close: data.price } : c);
                    chart.draw(chart.lastCandles);
                }
            }
        };
        ws.onerror = (error) => {
            logToConsole(`Ошибка WebSocket: ${error.message || 'неизвестная ошибка'}`, 'error', consoleOutput, devMode);
        };
        ws.onclose = () => {
            logToConsole('WebSocket закрыт, попытка переподключения...', 'warn', consoleOutput, devMode);
            setTimeout(initWebSocket, 1000);
        };
    }

    // Обновление цены и статуса на интерфейсе
    function updatePriceDisplay(data) {
        const priceElement = document.getElementById('price');
        if (priceElement) {
            if (data.price && data.lastPrice) { // Предполагаем, что lastPrice — цена за предыдущий день
                const change = ((data.price - data.lastPrice) / data.lastPrice) * 100;
                priceElement.textContent = `Цена: ${data.price.toFixed(2)} ₽ (Изменение: ${change.toFixed(2)}%)`;
                priceElement.className = change >= 0 ? 'price badge bg-success ms-1' : 'price badge bg-danger ms-1';
            } else {
                priceElement.textContent = data.price ? `Цена: ${data.price.toFixed(2)} ₽ (Изменение: N/A)` : 'Цена: N/A';
                priceElement.className = 'price badge bg-secondary ms-1';
            }
        }
        const statusElement = document.getElementById('market-status');
        if (statusElement) {
            statusElement.textContent = data.market_open ? 'Биржа открыта' : 'Биржа закрыта';
            statusElement.className = `alert mt-2 ${data.market_open ? 'alert-success' : 'alert-warning'}`;
            statusElement.style.display = 'block';
        }
        orderButtons.style.display = (data.market_open || tradingMode === 'training') ? 'flex' : 'none';
        buyBtn.disabled = !data.market_open && tradingMode === 'real';
        sellBtn.disabled = !data.market_open && tradingMode === 'real';
    }

    async function loadIndicatorSettings() {
        try {
            const response = await fetch('/get_indicator_settings');
            if (!response.ok) throw new Error('Ошибка загрузки настроек');
            const settings = await response.json();
            smaCheckbox.checked = settings.indicators?.sma || false;
            rsiCheckbox.checked = settings.indicators?.rsi || false;
            macdCheckbox.checked = settings.indicators?.macd || false;
            bollingerCheckbox.checked = settings.indicators?.bollinger || false;
            vwapCheckbox.checked = settings.indicators?.vwap || false;
            stochasticCheckbox.checked = settings.indicators?.stochastic || false;
            chart.setIndicators(settings.indicators || {});
            devModeCheckbox.checked = devMode;
            document.querySelector('.app-console').classList.toggle('hidden', !devMode);
            logToConsole(`Настройки индикаторов загружены: ${JSON.stringify(settings)}`, 'info', consoleOutput, devMode);
            cacheData('indicator_settings', { ...settings, timestamp: Math.floor(Date.now() / 1000) });
        } catch (error) {
            logToConsole(`Ошибка загрузки настроек индикаторов: ${error.message}`, 'error', consoleOutput, devMode);
        }
    }

    async function loadChartData(ticker, figi) {
        const loadingOverlay = document.getElementById('chart-loading');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
            loadingOverlay.style.justifyContent = 'center';
            loadingOverlay.style.alignItems = 'center';
        }
        const cacheKey = `candles_${ticker}_${figi}_${currentTimeframe}`;
        const cachedData = getCachedData(cacheKey);

        if (cachedData && isCacheFresh(cachedData, 300)) {
            logToConsole(`Используем кэшированные данные для ${ticker}`, 'info', consoleOutput, devMode);
            chart.chartCache = { key: cacheKey, ticker, figi, timeframe: currentTimeframe, candles: cachedData.candles };
            chart.setTimeframe(currentTimeframe);
            chart.draw(cachedData.candles, cachedData.indicators);
            calculatePerformance(cachedData.candles, logToConsole);
            if (loadingOverlay) loadingOverlay.style.display = 'none';
            return;
        }

        try {
            const response = await fetch(`/get_candles?ticker=${encodeURIComponent(ticker)}&figi=${encodeURIComponent(figi)}&timeframe=${currentTimeframe}`);
            if (!response.ok) throw new Error('Ошибка сети');
            const data = await response.json();
            if (data.error) throw new Error(data.error);

            const candles = data.candles.map(c => ({
                time: c.time,
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
                volume: c.volume
            }));

            chart.chartCache = { key: cacheKey, ticker, figi, timeframe: currentTimeframe, candles };
            chart.setIndicators({
                sma: smaCheckbox?.checked || false,
                rsi: rsiCheckbox?.checked || false,
                macd: macdCheckbox?.checked || false,
                bollinger: bollingerCheckbox?.checked || false,
                vwap: vwapCheckbox?.checked || false,
                stochastic: stochasticCheckbox?.checked || false
            });
            chart.setTimeframe(currentTimeframe);
            chart.draw(candles, data.indicators);
            calculatePerformance(candles, logToConsole);
            logToConsole(`График загружен для ${ticker} с таймфреймом ${currentTimeframe}`, 'info', consoleOutput, devMode);
            cacheData(cacheKey, { candles, indicators: data.indicators, timestamp: Math.floor(Date.now() / 1000) });
            if (loadingOverlay) loadingOverlay.style.display = 'none';
        } catch (error) {
            logToConsole(`Ошибка загрузки графика для ${ticker}: ${error.message}`, 'error', consoleOutput, devMode);
            if (loadingOverlay) loadingOverlay.style.display = 'none';
        }
    }

    async function loadOrderBook(ticker, figi) {
        orderbookArea.innerHTML = '<p class="text-muted text-center" style="height: 100%; display: flex; align-items: center; justify-content: center;">Загрузка...</p>';
        const cacheKey = `orderbook_${figi}`;
        const cachedData = getCachedData(cacheKey);

        if (cachedData && isCacheFresh(cachedData, 60)) {
            renderOrderBook(cachedData, ticker);
            return;
        }

        try {
            const response = await fetch(`/order_book?ticker=${encodeURIComponent(ticker)}&figi=${encodeURIComponent(figi)}`);
            if (!response.ok) throw new Error('Ошибка сети');
            const data = await response.json();
            if (!data.bids.length && !data.asks.length) {
                orderbookArea.innerHTML = '<p class="text-muted text-center" style="height: 100%; display: flex; align-items: center; justify-content: center;">Торги отсутствуют</p>';
                orderButtons.style.display = 'none';
                window.updateMarketStatus(false);
                logToConsole(`Торги отсутствуют для ${ticker}`, 'info', consoleOutput, devMode);
            } else {
                renderOrderBook(data, ticker);
                cacheData(cacheKey, { ...data, timestamp: Math.floor(Date.now() / 1000) });
            }
        } catch (error) {
            logToConsole(`Ошибка загрузки стакана для ${ticker}: ${error.message}`, 'error', consoleOutput, devMode);
            orderbookArea.innerHTML = '<p class="text-muted text-center" style="height: 100%; display: flex; align-items: center; justify-content: center;">Ошибка загрузки стакана</p>';
            orderButtons.style.display = 'none';
            window.updateMarketStatus(false);
        }
    }

    function renderOrderBook(data, ticker) {
        const maxBidQuantity = Math.max(...data.bids.map(bid => bid.quantity), 0);
        const maxAskQuantity = Math.max(...data.asks.map(ask => ask.quantity), 0);
        const maxQuantity = Math.max(maxBidQuantity, maxAskQuantity);

        let html = '<div class="orderbook-table">';
        html += '<table class="table table-sm">';
        html += '<thead><tr><th>Цена (₽)</th><th>Кол-во</th><th>Сумма (₽)</th></tr></thead>';
        html += '<tbody>';
        html += '<tr><td colspan="3" class="text-center text-danger"><strong>Продажа</strong></td></tr>';
        data.asks.slice(0, 5).reverse().forEach(ask => {
            const sum = (parseFloat(ask.price) * ask.quantity).toFixed(2);
            const intensity = maxQuantity > 0 ? (ask.quantity / maxQuantity) * 100 : 0;
            html += `
                <tr class="ask-row" style="background: linear-gradient(to right, #ffe6e6 ${intensity}%, transparent ${intensity}%);">
                    <td class="text-danger">${ask.price}</td>
                    <td class="fw-bold">${ask.quantity}</td>
                    <td>${sum}</td>
                </tr>`;
        });
        html += '<tr><td colspan="3" class="text-center text-success"><strong>Покупка</strong></td></tr>';
        data.bids.slice(0, 5).forEach(bid => {
            const sum = (parseFloat(bid.price) * bid.quantity).toFixed(2);
            const intensity = maxQuantity > 0 ? (bid.quantity / maxQuantity) * 100 : 0;
            html += `
                <tr class="bid-row" style="background: linear-gradient(to right, #e6ffe6 ${intensity}%, transparent ${intensity}%);">
                    <td class="text-success">${bid.price}</td>
                    <td class="fw-bold">${bid.quantity}</td>
                    <td>${sum}</td>
                </tr>`;
        });
        html += '</tbody></table></div>';

        orderbookArea.innerHTML = html;
        const marketOpen = data.market_open === true;
        orderButtons.style.display = (marketOpen || tradingMode === 'training') ? 'flex' : 'none';
        window.updateMarketStatus(marketOpen);
        buyBtn.disabled = !marketOpen && tradingMode === 'real';
        sellBtn.disabled = !marketOpen && tradingMode === 'real';
        logToConsole(`Стакан загружен для ${ticker}, рынок открыт: ${marketOpen}`, 'info', consoleOutput, devMode);
    }

    async function loadPortfolio() {
        portfolioArea.innerHTML = '<p class="text-muted">Загрузка...</p>';
        const cacheKey = `portfolio_${tradingMode}`;
        const cachedData = getCachedData(cacheKey);

        if (cachedData && isCacheFresh(cachedData, 60)) {
            portfolioArea.innerHTML = renderPortfolio(cachedData);
            logToConsole('Портфолио загружено из кэша', 'info', consoleOutput, devMode);
            return;
        }

        try {
            const response = await fetch(`/account_info?mode=${tradingMode}`);
            if (!response.ok) throw new Error('Ошибка сети');
            const data = await response.json();
            if (data.error) throw new Error(data.error);

            portfolioArea.innerHTML = renderPortfolio(data);
            cacheData(cacheKey, { ...data, timestamp: Math.floor(Date.now() / 1000) });
            logToConsole('Портфолио загружено', 'info', consoleOutput, devMode);
        } catch (error) {
            logToConsole(`Ошибка загрузки портфолио: ${error.message}`, 'error', consoleOutput, devMode);
            portfolioArea.innerHTML = '<p class="text-muted">Ошибка загрузки портфолио</p>';
        }
    }

    async function loadAccountInfo() {
        const cacheKey = `account_${tradingMode}`;
        const cachedData = getCachedData(cacheKey);

        if (cachedData && isCacheFresh(cachedData, 60)) {
            updateAccountUI(cachedData);
            logToConsole('Аккаунт загружен из кэша', 'info', consoleOutput, devMode);
            return;
        }

        try {
            const response = await fetch(`/account_info?mode=${tradingMode}`);
            if (!response.ok) throw new Error('Ошибка сети');
            const data = await response.json();
            if (data.error) throw new Error(data.error);

            updateAccountUI(data);
            cacheData(cacheKey, { ...data, timestamp: Math.floor(Date.now() / 1000) });
        } catch (error) {
            logToConsole(`Ошибка загрузки аккаунта: ${error.message}`, 'error', consoleOutput, devMode);
            ['account-balance', 'modal-account-balance', 'account-id', 'account-name', 'token-status'].forEach(id => {
                const element = document.getElementById(id);
                if (element) element.textContent = "Ошибка";
            });
        }
    }

    function updateAccountUI(data) {
        const updateElement = (id, value) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        };

        updateElement('account-balance', data.balance);
        updateElement('modal-account-balance', data.balance);
        updateElement('account-id', data.account_id);
        updateElement('account-name', data.name);
        updateElement('token-status', data.token_status);
        if (document.getElementById('timezone-select')) {
            document.getElementById('timezone-select').value = data.timezone || "Europe/Moscow";
        }
        virtualBalanceSection.style.display = tradingMode === 'training' ? 'block' : 'none';
        
        if (tradingMode === 'training' && data.initial_balance !== undefined) {
            virtualBalanceInput.value = data.initial_balance;
        }
        
        logToConsole(`Аккаунт загружен: ID=${data.account_id}, Баланс=${data.balance}`, 'info', consoleOutput, devMode);
    }

    async function addTicker() {
        const tickerInput = document.getElementById('tickerInput');
        const addTickerModal = bootstrap.Modal.getInstance(document.getElementById('addTickerModal'));
        const ticker = tickerInput.value.trim();
        if (!ticker) {
            logToConsole('Тикер не введён', 'warn', consoleOutput, devMode);
            alert('Пожалуйста, введите тикер');
            return;
        }

        try {
            const response = await fetch(`/find_figi?ticker=${encodeURIComponent(ticker)}`);
            if (!response.ok) throw new Error('Ошибка сети');
            const data = await response.json();
            if (data.figi) {
                addTab(ticker, data.figi, false, tickerTabs, addTabBtn, tabsPanel, noTickerMessage, logToConsole, updateTickerData.bind(null, null, null, null, lastPriceMap, logToConsole), loadChartData, loadOrderBook, loadPortfolio);
                addTickerModal.hide();
                tickerInput.value = '';
                document.getElementById('app-content').classList.remove('no-tickers');
                logToConsole(`Добавлен тикер: ${ticker}`, 'info', consoleOutput, devMode);
            } else {
                throw new Error(data.error || 'FIGI не найден');
            }
        } catch (error) {
            logToConsole(`Ошибка добавления тикера ${ticker}: ${error.message}`, 'error', consoleOutput, devMode);
            alert(`Ошибка: ${error.message}`);
        }
    }

    async function saveSettings() {
        const timezone = document.getElementById('timezone-select')?.value || "Europe/Moscow";
        devMode = document.getElementById('dev-mode-checkbox')?.checked || false;
        const settings = {
            timezone,
            indicators: {
                sma: smaCheckbox.checked,
                rsi: rsiCheckbox.checked,
                macd: macdCheckbox.checked,
                bollinger: bollingerCheckbox.checked,
                vwap: vwapCheckbox.checked,
                stochastic: stochasticCheckbox.checked
            },
            strategySettings: { scalping: currentScalpingSettings }
        };
        try {
            const response = await fetch('/save_settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            if (!response.ok) throw new Error('Ошибка сети');
            const data = await response.json();
            if (data.status === 'success') {
                if (tradingMode === 'training') {
                    const newBalance = parseFloat(virtualBalanceInput.value);
                    const balanceResponse = await fetch('/set_virtual_balance', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ balance: newBalance })
                    });
                    if (!balanceResponse.ok) throw new Error('Ошибка сохранения виртуального баланса');
                }
                logToConsole(`Настройки сохранены: ${JSON.stringify(settings)}`, 'info', consoleOutput, devMode);
                document.querySelector('.app-console').classList.toggle('hidden', !devMode);
                const accountModal = bootstrap.Modal.getInstance(document.getElementById('accountModal'));
                if (accountModal) {
                    accountModal.hide();
                }
                loadAccountInfo();
                cacheData('indicator_settings', { ...settings, timestamp: Math.floor(Date.now() / 1000) });
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            logToConsole(`Ошибка сохранения настроек: ${error.message}`, 'error', consoleOutput, devMode);
        }
    }

    window.placeOrder = async function(action) {
        if (!window.currentTicker || !window.currentFigi) {
            alert('Выберите тикер для торговли');
            return;
        }
        if (action === 'sell' && tradingMode === 'training') {
            const response = await fetch(`/account_info?mode=${tradingMode}`);
            const data = await response.json();
            const positions = data.positions || {};
            if (!positions[window.currentFigi] || positions[window.currentFigi].quantity <= 0) {
                alert('Нет акций для продажи');
                logToConsole('Попытка продажи без акций', 'warn', consoleOutput, devMode);
                return;
            }
        }
        try {
            const response = await fetch('/place_order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticker: window.currentTicker,
                    figi: window.currentFigi,
                    action: action,
                    quantity: 1,
                    mode: tradingMode
                })
            });
            const data = await response.json();
            if (data.status === 'success') {
                logToConsole(data.message, 'info', consoleOutput, devMode);
                await loadAccountInfo();
                await loadPortfolio();
                await loadTradeHistory();
                await loadPortfolioStats();
                logToConsole('Портфель обновлён после операции', 'info', consoleOutput, devMode);
            } else {
                logToConsole(`Ошибка при выполнении заявки: ${data.error}`, 'error', consoleOutput, devMode);
                alert(data.error);
            }
        } catch (error) {
            logToConsole(`Ошибка выполнения заявки: ${error.message}`, 'error', consoleOutput, devMode);
        }
    };

    const defaultScalpingSettings = {
        period: 5,
        profitTarget: 0.5,
        stopLoss: 0.2,
        volume: 1
    };

    let currentScalpingSettings = null;

    async function loadStrategySettings() {
        const strategy = strategySelect.value;
        strategySettings.innerHTML = '';
        if (!currentScalpingSettings) {
            try {
                const response = await fetch('/get_indicator_settings');
                const settings = await response.json();
                currentScalpingSettings = settings.strategySettings?.scalping || { ...defaultScalpingSettings };
                logToConsole(`Загружены настройки стратегии: ${JSON.stringify(currentScalpingSettings)}`, 'info', consoleOutput, devMode);
            } catch (error) {
                currentScalpingSettings = { ...defaultScalpingSettings };
                logToConsole(`Ошибка загрузки настроек стратегии, используются значения по умолчанию: ${error.message}`, 'error', consoleOutput, devMode);
            }
        }
        if (strategy === 'scalping') {
            strategySettings.innerHTML = `
                <div class="mb-2">
                    <label for="scalping-period" class="form-label">Период анализа (мин):</label>
                    <input type="number" class="form-control" id="scalping-period" value="${currentScalpingSettings.period}" min="1">
                </div>
                <div class="mb-2">
                    <label for="scalping-profit" class="form-label">Цель прибыли (%):</label>
                    <input type="number" class="form-control" id="scalping-profit" value="${currentScalpingSettings.profitTarget}" step="0.1" min="0">
                </div>
                <div class="mb-2">
                    <label for="scalping-stop" class="form-label">Стоп-лосс (%):</label>
                    <input type="number" class="form-control" id="scalping-stop" value="${currentScalpingSettings.stopLoss}" step="0.1" min="0">
                </div>
                <div class="mb-2">
                    <label for="scalping-volume" class="form-label">Объём сделки (лоты):</label>
                    <input type="number" class="form-control" id="scalping-volume" value="${currentScalpingSettings.volume}" min="1">
                </div>
                <button class="btn btn-outline-primary" id="save-strategy-btn">Сохранить настройки</button>
            `;
            document.getElementById('save-strategy-btn').addEventListener('click', saveStrategySettings);
        }
    }

    async function saveStrategySettings() {
        currentScalpingSettings = {
            period: parseInt(document.getElementById('scalping-period').value),
            profitTarget: parseFloat(document.getElementById('scalping-profit').value),
            stopLoss: parseFloat(document.getElementById('scalping-stop').value),
            volume: parseInt(document.getElementById('scalping-volume').value)
        };
        try {
            const response = await fetch('/save_settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ strategySettings: { scalping: currentScalpingSettings } })
            });
            if (!response.ok) throw new Error('Ошибка сохранения');
            logToConsole('Настройки стратегии сохранены', 'info', consoleOutput, devMode);
        } catch (error) {
            logToConsole(`Ошибка сохранения настроек стратегии: ${error.message}`, 'error', consoleOutput, devMode);
        }
    }

    function resetStrategySettings() {
        currentScalpingSettings = { ...defaultScalpingSettings };
        loadStrategySettings();
        logToConsole('Настройки стратегии сброшены', 'info', consoleOutput, devMode);
    }

    async function startBot() {
        if (!window.currentTicker || !window.currentFigi) {
            alert('Выберите тикер для торговли');
            return;
        }
        if (botRunning && tradingMode === 'real') {
            if (!confirm('Подтвердите запуск бота в реальном режиме')) return;
        }
        botRunning = true;
        startBotBtn.textContent = 'Остановить бота';
        startBotBtn.classList.remove('btn-primary');
        startBotBtn.classList.add('btn-danger');
        logToConsole(`Бот запущен в режиме: ${tradingMode}`, 'info', consoleOutput, devMode);
        window.updateMarketStatus(true, 'Действие модели: Запуск бота');
        startTrading(tradingMode, window.currentTicker, window.currentFigi, strategySelect.value, currentScalpingSettings, (message, level) => logToConsole(message, level, consoleOutput, devMode), getPrediction);
    }

    function stopBot() {
        botRunning = false;
        startBotBtn.textContent = 'Запустить бота';
        startBotBtn.classList.remove('btn-danger');
        startBotBtn.classList.add('btn-primary');
        logToConsole('Бот остановлен', 'info', consoleOutput, devMode);
        window.updateMarketStatus(true, 'Действие модели: Бот остановлен');
        stopTrading();
    }

    async function updateTabPrices() {
        const tabs = tickerTabs.querySelectorAll('.nav-item');
        for (const tab of tabs) {
            const link = tab.querySelector('a');
            if (!link || link.id === 'add-tab-btn') continue;
            const ticker = link.textContent.split(' ')[0].trim();
            const tabId = link.id.replace('-tab', '');
            const priceSpan = document.getElementById(`${tabId}-price`);
            const trendSpan = document.getElementById(`${tabId}-trend`);
            if (!priceSpan || !trendSpan) {
                logToConsole(`Элементы ${tabId}-price или ${tabId}-trend не найдены`, 'error', consoleOutput, devMode);
                continue;
            }

            const cacheKey = `price_${window.currentFigi}`;
            const cachedData = getCachedData(cacheKey);

            if (cachedData && isCacheFresh(cachedData, 60)) {
                priceSpan.textContent = `${cachedData.price.toFixed(2)} ₽`;
                priceSpan.className = 'price badge bg-secondary ms-1';
                if (cachedData.change > 0) {
                    trendSpan.innerHTML = '<i class="ti ti-caret-up text-success"></i>';
                } else if (cachedData.change < 0) {
                    trendSpan.innerHTML = '<i class="ti ti-caret-down text-danger"></i>';
                } else {
                    trendSpan.innerHTML = '';
                }
                logToConsole(`Обновлена цена из кэша для ${ticker}: ${cachedData.price.toFixed(2)} ₽`, 'info', consoleOutput, devMode);
                continue;
            }

            try {
                const response = await fetch(`/get_price?ticker=${encodeURIComponent(ticker)}&figi=${encodeURIComponent(window.currentFigi)}`);
                const data = await response.json();
                if (data.price) {
                    priceSpan.textContent = `${data.price.toFixed(2)} ₽`;
                    priceSpan.className = 'price badge bg-secondary ms-1';
                    if (data.change > 0) {
                        trendSpan.innerHTML = '<i class="ti ti-caret-up text-success"></i>';
                    } else if (data.change < 0) {
                        trendSpan.innerHTML = '<i class="ti ti-caret-down text-danger"></i>';
                    } else {
                        trendSpan.innerHTML = '';
                    }
                    logToConsole(`Обновлена цена для ${ticker}: ${data.price.toFixed(2)} ₽, изменение: ${data.change}`, 'info', consoleOutput, devMode);
                    cacheData(cacheKey, { ...data, timestamp: Math.floor(Date.now() / 1000) });
                } else {
                    priceSpan.textContent = 'N/A';
                    trendSpan.innerHTML = '';
                }
            } catch (error) {
                logToConsole(`Ошибка обновления цены для ${ticker}: ${error.message}`, 'error', consoleOutput, devMode);
                priceSpan.textContent = 'N/A';
                trendSpan.innerHTML = '';
            }
        }
    }

    async function loadPortfolioStats() {
        try {
            const response = await fetch(`/portfolio_stats?mode=${tradingMode}`);
            if (!response.ok) throw new Error('Ошибка загрузки статистики');
            const data = await response.json();
            const statsDiv = document.getElementById('portfolio-stats');
            if (statsDiv) {
                statsDiv.innerHTML = `
                    <h5>Статистика портфеля</h5>
                    <p>Волатильность: ${(data.volatility * 100).toFixed(2)}%</p>
                    <p>Макс. просадка: ${(data.max_drawdown * 100).toFixed(2)}%</p>
                    <p>Sharpe Ratio: ${data.sharpe_ratio.toFixed(2)}</p>
                `;
            }
            logToConsole(`Статистика портфеля: ${JSON.stringify(data)}`, 'info', consoleOutput, devMode);
        } catch (error) {
            logToConsole(`Ошибка загрузки статистики портфеля: ${error.message}`, 'error', consoleOutput, devMode);
        }
    }

    async function loadTradingSchedule(retries = 3) {
        const scheduleDiv = document.getElementById('trading-schedule');
        if (!scheduleDiv) return;

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                const response = await fetch('/trading_schedule', { signal: controller.signal });
                clearTimeout(timeoutId);

                if (!response.ok) throw new Error(`HTTP ошибка ${response.status}`);
                const data = await response.json();
                if (data.error) throw new Error(data.error);

                if (data.is_open) {
                    scheduleDiv.innerHTML = `<h5>Расписание торгов</h5><p>Биржа открыта, до закрытия: ${Math.floor(data.time_to_close / 60)} мин</p>`;
                } else {
                    scheduleDiv.innerHTML = `<h5>Расписание торгов</h5><p>Биржа закрыта, до открытия: ${Math.floor(data.time_to_open / 60)} мин</p>`;
                }

                if (scheduleInterval) clearInterval(scheduleInterval);
                scheduleInterval = setInterval(() => {
                    if (data.is_open) {
                        data.time_to_close -= 1;
                        if (data.time_to_close >= 0) {
                            scheduleDiv.innerHTML = `<h5>Расписание торгов</h5><p>Биржа открыта, до закрытия: ${Math.floor(data.time_to_close / 60)} мин</p>`;
                        } else {
                            clearInterval(scheduleInterval);
                            loadTradingSchedule(retries);
                        }
                    } else {
                        data.time_to_open -= 1;
                        if (data.time_to_open >= 0) {
                            scheduleDiv.innerHTML = `<h5>Расписание торгов</h5><p>Биржа закрыта, до открытия: ${Math.floor(data.time_to_open / 60)} мин</p>`;
                        } else {
                            clearInterval(scheduleInterval);
                            loadTradingSchedule(retries);
                        }
                    }
                }, 1000);

                logToConsole(`Расписание торгов загружено: ${JSON.stringify(data)}`, 'info', consoleOutput, devMode);
                break;
            } catch (error) {
                logToConsole(`Ошибка загрузки расписания (попытка ${attempt}/${retries}): ${error.message}`, 'error', consoleOutput, devMode);
                if (attempt === retries) {
                    scheduleDiv.innerHTML = `<h5>Расписание торгов</h5><p>Ошибка: Не удалось загрузить расписание (${error.message})</p>`;
                } else {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
    }

    async function loadTradeHistory() {
        try {
            const response = await fetch('/trade_history');
            if (!response.ok) throw new Error('Ошибка загрузки истории');
            const data = await response.json();
            const historyDiv = document.getElementById('trade-history');
            if (historyDiv) {
                historyDiv.innerHTML = '<h5>История сделок</h5>';
                if (data.trades.length === 0) {
                    historyDiv.innerHTML += '<p>Сделок нет</p>';
                } else {
                    let html = '<table class="table table-sm"><thead><tr><th>Тикер</th><th>Действие</th><th>Кол-во</th><th>Цена</th><th>Сумма</th><th>Дата</th></tr></thead><tbody>';
                    data.trades.forEach(trade => {
                        const date = new Date(trade.timestamp * 1000).toLocaleString();
                        html += `
                            <tr>
                                <td>${trade.ticker}</td>
                                <td>${trade.action === 'buy' ? 'Покупка' : 'Продажа'}</td>
                                <td>${trade.quantity}</td>
                                <td>${trade.price.toFixed(2)} ₽</td>
                                <td>${trade.total_cost.toFixed(2)} ₽</td>
                                <td>${date}</td>
                            </tr>`;
                    });
                    html += '</tbody></table>';
                    historyDiv.innerHTML += html;
                }
            }
            logToConsole(`История сделок загружена: ${data.trades.length} записей`, 'info', consoleOutput, devMode);
        } catch (error) {
            logToConsole(`Ошибка загрузки истории сделок: ${error.message}`, 'error', consoleOutput, devMode);
        }
    }

    if (initialData.ticker && initialData.figi) {
        addTab(initialData.ticker, initialData.figi, true, tickerTabs, addTabBtn, tabsPanel, noTickerMessage, logToConsole, updateTickerData.bind(null, null, null, null, lastPriceMap, logToConsole), loadChartData, loadOrderBook, loadPortfolio);
        document.getElementById('app-content').classList.remove('no-tickers');
    } else {
        document.getElementById('app-content').classList.add('no-tickers');
        tabsPanel.style.display = 'none';
        noTickerMessage.style.display = 'flex';
    }
    loadAccountInfo();
    await loadIndicatorSettings();
    await loadStrategySettings();
    await loadPortfolioStats();
    await loadTradingSchedule();
    await loadTradeHistory();

    await new Promise(resolve => {
        if (typeof tf !== 'undefined') {
            resolve();
        } else {
            const checkTf = setInterval(() => {
                if (typeof tf !== 'undefined') {
                    clearInterval(checkTf);
                    resolve();
                }
            }, 100);
        }
    });

    initializeML((message, level) => logToConsole(message, level, consoleOutput, devMode), () => window.currentTicker, () => window.currentFigi).then(() => {
        logToConsole('Машинное обучение инициализировано', 'info', consoleOutput, devMode);
    }).catch(error => {
        logToConsole(`Ошибка инициализации ML: ${error.message}`, 'error', consoleOutput, devMode);
    });

    initWebSocket();

    darkModeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        darkModeToggle.innerHTML = document.body.classList.contains('dark-mode') ? '<i class="ti ti-sun"></i>' : '<i class="ti ti-moon"></i>';
        chart.setDarkMode(document.body.classList.contains('dark-mode'));
        if (window.currentTicker && window.currentFigi) loadChartData(window.currentTicker, window.currentFigi);
    });

    lineChartBtn.setAttribute('title', 'Линейный график: показывает изменение цены в виде линии');
    candleChartBtn.setAttribute('title', 'Свечной график: отображает открытие, закрытие, максимум и минимум цены');
    volumeChartBtn.setAttribute('title', 'Объёмный график: показывает объём торгов в виде столбцов');
    
    setChartType('candlestick', lineChartBtn, candleChartBtn, volumeChartBtn);
    chart.setChartType('candlestick');

    lineChartBtn.addEventListener('click', () => {
        currentChartType = 'scatter';
        setChartType('scatter', lineChartBtn, candleChartBtn, volumeChartBtn);
        chart.setChartType('scatter');
        if (window.currentTicker && window.currentFigi) loadChartData(window.currentTicker, window.currentFigi);
        logToConsole('Выбран линейный график', 'info', consoleOutput, devMode);
    });

    candleChartBtn.addEventListener('click', () => {
        currentChartType = 'candlestick';
        setChartType('candlestick', lineChartBtn, candleChartBtn, volumeChartBtn);
        chart.setChartType('candlestick');
        if (window.currentTicker && window.currentFigi) loadChartData(window.currentTicker, window.currentFigi);
        logToConsole('Выбран свечной график', 'info', consoleOutput, devMode);
    });

    volumeChartBtn.addEventListener('click', () => {
        currentChartType = 'bar';
        setChartType('bar', lineChartBtn, candleChartBtn, volumeChartBtn);
        chart.setChartType('bar');
        if (window.currentTicker && window.currentFigi) loadChartData(window.currentTicker, window.currentFigi);
        logToConsole('Выбран объёмный график', 'info', consoleOutput, devMode);
    });

    clearDrawingBtn.addEventListener('click', () => {
        chart.clearLines();
        clearDrawingBtn.style.display = 'none';
        logToConsole("Линии на графике очищены", 'info', consoleOutput, devMode);
    });

    drawingCheckbox.addEventListener('change', () => {
        chart.toggleDrawing();
    });

    showGapsCheckbox.addEventListener('change', () => {
        chart.setShowGaps(showGapsCheckbox.checked);
    });

    clearCacheBtn.addEventListener('click', () => {
        chart.clearCache();
        localStorage.clear();
        if (window.currentTicker && window.currentFigi) loadChartData(window.currentTicker, window.currentFigi);
        logToConsole('Кэш очищен', 'info', consoleOutput, devMode);
    });

    modeToggle.addEventListener('change', () => {
        tradingMode = modeToggle.checked ? 'real' : 'training';
        modeLabel.textContent = modeToggle.checked ? 'Реальная торговля' : 'Обучение';
        tradeModeSelect.value = tradingMode;
        loadAccountInfo();
        if (window.currentTicker && window.currentFigi) {
            loadOrderBook(window.currentTicker, window.currentFigi);
            loadPortfolio();
            loadPortfolioStats();
            loadTradeHistory();
        }
        logToConsole(`Режим торговли изменён на: ${tradingMode}`, 'info', consoleOutput, devMode);
    });

    [smaCheckbox, rsiCheckbox, macdCheckbox, bollingerCheckbox, vwapCheckbox, stochasticCheckbox].forEach(checkbox => {
        if (checkbox) {
            checkbox.addEventListener('change', () => {
                saveSettings();
                if (window.currentTicker && window.currentFigi) loadChartData(window.currentTicker, window.currentFigi);
            });
        }
    });

    if (devModeCheckbox) {
        devModeCheckbox.addEventListener('change', () => {
            devMode = devModeCheckbox.checked;
            document.querySelector('.app-console').classList.toggle('hidden', !devMode);
            logToConsole(`Режим разработки: ${devMode ? 'включён' : 'выключён'}`, 'info', consoleOutput, devMode);
        });
    }

    document.getElementById('addTickerSubmit').addEventListener('click', addTicker);
    document.getElementById('save-timezone-btn').addEventListener('click', saveSettings);

    tradeModeSelect.addEventListener('change', () => {
        tradingMode = tradeModeSelect.value;
        modeToggle.checked = tradingMode === 'real';
        modeLabel.textContent = tradingMode === 'real' ? 'Реальная торговля' : 'Обучение';
        loadAccountInfo();
        if (window.currentTicker && window.currentFigi) {
            loadOrderBook(window.currentTicker, window.currentFigi);
            loadPortfolio();
            loadPortfolioStats();
            loadTradeHistory();
        }
        logToConsole(`Режим торговли изменён на: ${tradingMode}`, 'info', consoleOutput, devMode);
    });

    strategySelect.addEventListener('change', loadStrategySettings);
    startBotBtn.addEventListener('click', () => botRunning ? stopBot() : startBot());
    resetSettingsBtn.addEventListener('click', resetStrategySettings);

    liveModeBtn.addEventListener('click', () => {
        if (chart.liveMode) {
            chart.stopLiveMode();
            liveModeBtn.textContent = 'LIVE';
            liveModeBtn.classList.remove('btn-danger');
            liveModeBtn.classList.add('btn-outline-secondary');
        } else {
            chart.startLiveMode(async (timeframe) => {
                try {
                    const response = await fetch(`/get_candles?ticker=${encodeURIComponent(window.currentTicker)}&figi=${encodeURIComponent(window.currentFigi)}&timeframe=${timeframe}`);
                    if (!response.ok) throw new Error('Ошибка сети');
                    const data = await response.json();
                    if (data.error) throw new Error(data.error);
                    return data.candles.map(c => ({
                        time: c.time,
                        open: c.open,
                        high: c.high,
                        low: c.low,
                        close: c.close,
                        volume: c.volume
                    }));
                } catch (error) {
                    logToConsole(`LIVE: Ошибка получения свечей: ${error.message}`, 'error', consoleOutput, devMode);
                    return [];
                }
            });
            liveModeBtn.textContent = 'STOP LIVE';
            liveModeBtn.classList.remove('btn-outline-secondary');
            liveModeBtn.classList.add('btn-danger');
        }
    });

    document.querySelectorAll('.timeframe-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentTimeframe = btn.dataset.timeframe;
            document.getElementById('timeframeDropdown').innerHTML = `Таймфрейм: ${btn.textContent} <i class="ti ti-clock-hour-7" style="font-size: 25px;"></i>`;
            document.querySelectorAll('.timeframe-btn').forEach(b => b.disabled = (b.dataset.timeframe === currentTimeframe));
            if (window.currentTicker && window.currentFigi) {
                loadChartData(window.currentTicker, window.currentFigi);
            }
            logToConsole(`Выбран таймфрейм: ${btn.textContent}`, 'info', consoleOutput, devMode);
        });
    });

    setInterval(async () => {
        if (window.currentTicker && window.currentFigi) {
            await loadChartData(window.currentTicker, window.currentFigi);
            await loadOrderBook(window.currentTicker, window.currentFigi);
            await loadPortfolio();
            await updateTabPrices();
            await loadPortfolioStats();
            await loadTradeHistory();
            const now = Date.now();
            if (now - lastScheduleUpdate >= 60000) {
                await loadTradingSchedule();
                lastScheduleUpdate = now;
            }
        }
    }, 10000);

    document.getElementById('copy-console-btn').addEventListener('click', () => {
        const consoleText = Array.from(consoleOutput.children)
            .map(div => div.textContent)
            .join('\n');
        
        const textarea = document.createElement('textarea');
        textarea.value = consoleText;
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            logToConsole('Текст консоли скопирован в буфер обмена', 'info', consoleOutput, devMode);
        } catch (err) {
            logToConsole(`Ошибка копирования: ${err.message}`, 'error', consoleOutput, devMode);
        } finally {
            document.body.removeChild(textarea);
        }
    });

    await updateTabPrices();

    window.closeTab = (tabId, closeBtn) => closeTab(tabId, closeBtn, tickerTabs, orderbookArea, portfolioArea, document.getElementById('app-content'), tabsPanel, noTickerMessage, logToConsole, loadChartData, loadOrderBook, loadPortfolio);
});