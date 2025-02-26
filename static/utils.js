export function logToConsole(message, level = 'info', consoleOutput = document.getElementById('console-output'), devMode = true) {
    if (!devMode || !consoleOutput) return;
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = `log-${level}`;
    logEntry.textContent = `[${timestamp}] ${message}`;
    consoleOutput.appendChild(logEntry);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

export function renderPortfolio(data) {
    let html = '<h6>Портфолио</h6><ul class="list-unstyled">';
    html += `<li>Баланс: ${data.balance} ₽</li>`;
    if (data.positions && Object.keys(data.positions).length > 0) {
        for (const [figi, pos] of Object.entries(data.positions)) {
            html += `<li>${pos.name}: ${pos.quantity} лотов (${pos.value} ₽)</li>`;
        }
    } else {
        html += '<li>Позиции отсутствуют</li>';
    }
    html += '</ul>';
    return html;
}

export function addTab(ticker, figi, active, tickerTabs, addTabBtn, tabsPanel, noTickerMessage, logToConsole, updateTickerData, loadChartData, loadOrderBook, loadPortfolio) {
    const tabId = `tab-${tickerTabs.children.length + 1}`;
    const tab = document.createElement('li');
    tab.className = 'nav-item';
    tab.innerHTML = `
        <a class="nav-link ${active ? 'active' : ''}" id="${tabId}-tab" data-bs-toggle="tab" href="#${tabId}" role="tab" aria-controls="${tabId}">
            ${ticker} <span id="${tabId}-price" class="price badge bg-secondary ms-1">N/A</span> <span id="${tabId}-trend" class="trend"></span>
            <button type="button" class="btn-close ms-2" aria-label="Close" onclick="closeTab('${tabId}', this)"></button>
        </a>`;
    
    const addTabLi = document.getElementById('add-tab');
    tickerTabs.insertBefore(tab, addTabLi);
    logToConsole(`Добавлена вкладка: ${tabId}, ticker: ${ticker}, figi: ${figi}`, 'info');

    tab.querySelector('a').addEventListener('shown.bs.tab', () => {
        window.currentTicker = ticker;
        window.currentFigi = figi;
        loadChartData(ticker, figi);
        loadOrderBook(ticker, figi);
        loadPortfolio();
    });

    if (active) {
        window.currentTicker = ticker;
        window.currentFigi = figi;
        loadChartData(ticker, figi);
        loadOrderBook(ticker, figi);
        loadPortfolio();
    }
}

export function closeTab(tabId, closeBtn, tickerTabs, orderbookArea, portfolioArea, appContent, tabsPanel, noTickerMessage, logToConsole, loadChartData, loadOrderBook, loadPortfolio) {
    const tab = closeBtn.closest('.nav-item');
    const isActive = tab.querySelector('a').classList.contains('active');
    tickerTabs.removeChild(tab);
    if (isActive && tickerTabs.children.length > 1) {
        const nextTab = tickerTabs.children[0].querySelector('a');
        bootstrap.Tab.getOrCreateInstance(nextTab).show();
        window.currentTicker = nextTab.textContent.trim().split(' ')[0];
        window.currentFigi = nextTab.getAttribute('href').substring(1);
        loadChartData(window.currentTicker, window.currentFigi);
        loadOrderBook(window.currentTicker, window.currentFigi);
        loadPortfolio();
    } else if (tickerTabs.children.length === 1) {
        appContent.classList.add('no-tickers');
        tabsPanel.style.display = 'none';
        noTickerMessage.style.display = 'flex';
        orderbookArea.innerHTML = '';
        portfolioArea.innerHTML = '';
        window.currentTicker = null;
        window.currentFigi = null;
    }
}

export function updateTickerData(tickerTabs, orderbookArea, portfolioArea, lastPriceMap, logToConsole) {
    logToConsole(`Обновляем данные для tickerTabs`, 'info');
}

export function calculatePerformance(candles, logToConsole) {
    if (!candles || candles.length === 0) {
        logToConsole('Нет свечей для расчёта изменений', 'warn');
        return;
    }

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const filterCandles = (start) => candles.filter(c => new Date(c.time) >= start);
    const dayCandles = filterCandles(oneDayAgo);
    const weekCandles = filterCandles(oneWeekAgo);
    const monthCandles = filterCandles(oneMonthAgo);
    const yearCandles = filterCandles(oneYearAgo);
    const ytdCandles = filterCandles(startOfYear);

    logToConsole(`Текущая дата: ${now.toISOString()}`, 'info');
    logToConsole(`Свечей всего: ${candles.length}`, 'info');
    logToConsole(`Диапазон свечей: ${new Date(candles[0].time).toISOString()} - ${new Date(candles[candles.length - 1].time).toISOString()}`, 'info');
    logToConsole(`За день: ${dayCandles.length}, За неделю: ${weekCandles.length}, За месяц: ${monthCandles.length}, За год: ${yearCandles.length}, С начала года: ${ytdCandles.length}`, 'info');

    const calcChange = (candleSet, period) => {
        if (candleSet.length < 2) {
            logToConsole(`Недостаточно данных для ${period}: ${candleSet.length} свечей`, 'warn');
            return { change: 'N/A' };
        }
        const start = candleSet[0].close;
        const end = candleSet[candleSet.length - 1].close;
        const change = ((end - start) / start * 100).toFixed(2);
        return { change };
    };

    const dayChange = calcChange(dayCandles, 'день');
    const weekChange = calcChange(weekCandles, 'неделя');
    const monthChange = calcChange(monthCandles, 'месяц');
    const yearChange = calcChange(yearCandles, 'год');
    const ytdChange = calcChange(ytdCandles, 'с начала года');

    const updateElement = (id, value) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
            logToConsole(`Обновлён элемент ${id}: ${value}`, 'info');
        } else {
            logToConsole(`Элемент с ID ${id} не найден`, 'error');
        }
    };

    updateElement('change-day', `За день: ${dayChange.change}%`);
    updateElement('change-week', `За неделю: ${weekChange.change}%`);
    updateElement('change-month', `За месяц: ${monthChange.change}%`);
    updateElement('change-year', `За год: ${yearChange.change}%`);
    updateElement('change-ytd', `С начала года: ${ytdChange.change}%`);
}

export function setChartType(type, lineChartBtn, candleChartBtn, volumeChartBtn) {
    lineChartBtn.classList.toggle('active', type === 'scatter');
    candleChartBtn.classList.toggle('active', type === 'candlestick');
    volumeChartBtn.classList.toggle('active', type === 'bar');
}