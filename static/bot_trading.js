import { renderPortfolio } from './utils.js';

let tradingInterval = null;
let botActions = []; // Массив для хранения действий бота

export function startTrading(mode, ticker, figi, strategy, settings, log, getPrediction) {
    if (strategy === 'scalping') {
        tradingInterval = setInterval(async () => {
            try {
                const priceResponse = await fetch(`/get_price?ticker=${encodeURIComponent(ticker)}&figi=${encodeURIComponent(figi)}`);
                const priceData = await priceResponse.json();
                if (!priceData.price) throw new Error('Нет данных о цене');
                const currentPrice = priceData.price;

                const portfolioResponse = await fetch(`/account_info?mode=${mode}`);
                const portfolioData = await portfolioResponse.json();
                const positions = portfolioData.positions || {};
                const availableLots = positions[figi]?.quantity || 0;

                const prediction = await getPrediction(currentPrice); // Предполагаем, что getPrediction принимает текущую цену
                if (prediction === null) {
                    log('Ожидание достаточного количества данных для предсказания...', 'warn');
                    window.updateMarketStatus(true, 'Действие модели: Ожидание данных', mode);
                    return;
                }

                if (prediction > currentPrice * (1 + settings.profitTarget / 100)) {
                    log(`Скальпинг: Покупка ${settings.volume} лотов ${ticker} по ${currentPrice} ₽ (предсказание: ${prediction.toFixed(2)} ₽)`, 'info');
                    window.updateMarketStatus(true, 'Действие модели: Покупка', mode);
                    await placeOrder(mode, ticker, figi, 'buy', settings.volume, currentPrice, settings, log);
                    botActions.push({ type: 'buy', ticker, figi, price: currentPrice, time: Date.now(), quantity: settings.volume });
                } else if (prediction < currentPrice * (1 - settings.stopLoss / 100) && availableLots >= settings.volume) {
                    log(`Скальпинг: Продажа ${settings.volume} лотов ${ticker} по ${currentPrice} ₽ (предсказание: ${prediction.toFixed(2)} ₽)`, 'info');
                    window.updateMarketStatus(true, 'Действие модели: Продажа', mode);
                    await placeOrder(mode, ticker, figi, 'sell', settings.volume, currentPrice, settings, log);
                    botActions.push({ type: 'sell', ticker, figi, price: currentPrice, time: Date.now(), quantity: settings.volume });
                } else {
                    log(`Скальпинг: Держим позицию для ${ticker}, цена ${currentPrice} ₽, предсказание ${prediction.toFixed(2)} ₽ (доступно: ${availableLots} лотов)`, 'info');
                    window.updateMarketStatus(true, 'Действие модели: Hold', mode);
                }
            } catch (error) {
                log(`Ошибка в торговле: ${error.message}`, 'error');
                window.updateMarketStatus(true, 'Действие модели: Ошибка', mode);
            }
        }, 1000); // Оставил интервал 1000 мс, как в твоём коде
    }
}

export function stopTrading() {
    if (tradingInterval) {
        clearInterval(tradingInterval);
        tradingInterval = null;
    }
}

export function getBotActions() {
    return botActions; // Экспорт действий бота для отображения на графике
}

window.updateMarketStatus = function(marketOpen, customMessage, mode) {  // Добавлен аргумент mode
    const marketStatusDiv = document.getElementById('market-status');
    marketStatusDiv.style.display = 'block';
    if (!marketOpen && mode === 'real') {  // Используем переданный mode
        marketStatusDiv.className = 'alert mt-2 alert-warning';
        marketStatusDiv.textContent = 'Биржа закрыта';
    } else if (customMessage) {
        marketStatusDiv.className = 'alert mt-2 alert-info';
        marketStatusDiv.textContent = customMessage;
    } else {
        marketStatusDiv.className = 'alert mt-2 alert-info';
        marketStatusDiv.textContent = 'Действие модели: Ожидание';
    }
};

async function placeOrder(mode, ticker, figi, action, quantity, price, settings, log) {
    try {
        const response = await fetch('/place_order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ticker,
                figi,
                action,
                quantity,
                mode
            })
        });
        const data = await response.json();
        if (!response.ok || data.status !== 'success') {
            throw new Error(data.error || 'Неизвестная ошибка при выполнении заявки');
        }
        
        const successMessage = data.message || `${action === 'buy' ? 'Покупка' : 'Продажа'} ${quantity} лотов ${ticker} по ${price} ₽ выполнена`;
        log(successMessage, 'info');

        const portfolioResponse = await fetch(`/account_info?mode=${mode}`);
        const portfolioData = await portfolioResponse.json();
        if (!portfolioResponse.ok || portfolioData.error) {
            throw new Error(portfolioData.error || 'Ошибка загрузки портфолио');
        }
        document.getElementById('portfolio-area').innerHTML = renderPortfolio(portfolioData);
        log('Портфолио обновлено после заявки', 'info');
    } catch (error) {
        log(`Ошибка выполнения заявки: ${error.message}`, 'error');
    }
}