let tradingSchedule = null;
let selectedTimezone = 'Europe/Moscow';
let currentTicker = null;
let priceUpdateInterval = null;
let orderBookUpdateInterval = null;

fetch('/trading_status')
    .then(response => response.json())
    .then(data => {
        tradingSchedule = data.schedule;
        updateTradingStatus();
    })
    .catch(error => {
        console.error('Ошибка загрузки графика:', error);
        document.getElementById('trading-status').innerHTML = '<h3 style="font-size: 24pt; color: orange;">Ошибка загрузки графика</h3>';
    });

fetch('/account_info')
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            console.error('Ошибка загрузки аккаунта:', data.error);
        } else {
            selectedTimezone = data.timezone;
            updateGreeting();
            updateTradingStatus();
        }
    })
    .catch(error => {
        console.error('Ошибка при начальной загрузке аккаунта:', error);
    });

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainderSeconds = seconds % 60;
    const roundedSeconds = Math.round(remainderSeconds / 10) * 10;
    if (roundedSeconds === 60) {
        return `${String(hours).padStart(2, '0')} ч : ${String(minutes + 1).padStart(2, '0')} мин`;
    }
    return `${String(hours).padStart(2, '0')} ч : ${String(minutes).padStart(2, '0')} мин`;
}

function updateTradingStatus() {
    if (!tradingSchedule || !selectedTimezone) return;

    const now = new Date().toLocaleString("en-US", { timeZone: selectedTimezone });
    const today = new Date(now).toISOString().split('T')[0];
    const currentSchedule = tradingSchedule.find(day => day.date === today);

    const statusElement = document.getElementById('trading-status');
    const timerElement = document.getElementById('timer');

    if (!currentSchedule || !currentSchedule.is_trading_day) {
        statusElement.innerHTML = '<h3 class="weekend-message">Сегодня выходной день</h3>';
        timerElement.innerHTML = '';
        return;
    }

    const openTime = new Date(`${today}T07:00:00+03:00`);
    const closeTime = new Date(`${today}T23:50:00+03:00`);
    const currentTime = new Date(now);

    if (currentTime < openTime) {
        const secondsUntilOpen = Math.floor((openTime - currentTime) / 1000);
        statusElement.innerHTML = '<h3 style="font-size: 24pt; color: red;">Биржа закрыта</h3>';
        timerElement.innerHTML = `${formatTime(secondsUntilOpen)} (Открытие)`;
    } else if (currentTime >= openTime && currentTime <= closeTime) {
        const secondsUntilClose = Math.floor((closeTime - currentTime) / 1000);
        statusElement.innerHTML = '<h3 style="font-size: 24pt; color: white;">Биржа открыта</h3>';
        timerElement.innerHTML = `${formatTime(secondsUntilClose)} (Закрытие)`;
    } else {
        const tomorrow = new Date(currentTime);
        tomorrow.setDate(currentTime.getDate() + 1);
        const nextOpenTime = new Date(`${tomorrow.toISOString().split('T')[0]}T07:00:00+03:00`);
        const secondsUntilNextOpen = Math.floor((nextOpenTime - currentTime) / 1000);
        statusElement.innerHTML = '<h3 style="font-size: 24pt; color: red;">Биржа закрыта</h3>';
        timerElement.innerHTML = `${formatTime(secondsUntilNextOpen)} (Открытие)`;
    }
}

function updateGreeting() {
    if (!selectedTimezone) return;
    const hour = new Date().toLocaleString("en-US", { timeZone: selectedTimezone, hour: 'numeric', hour12: false });
    const greetingElement = document.getElementById('greeting');
    if (hour >= 5 && hour < 12) greetingElement.textContent = 'Доброе утро';
    else if (hour >= 12 && hour < 17) greetingElement.textContent = 'Добрый день';
    else if (hour >= 17 && hour < 22) greetingElement.textContent = 'Добрый вечер';
    else greetingElement.textContent = 'Доброй ночи';
}

function loadRecentTickers() {
    fetch('/get_cache')
        .then(response => response.json())
        .then(cache => {
            const recentTickers = document.getElementById('recent-tickers');
            const clearButton = document.getElementById('clear-tickers');
            recentTickers.innerHTML = '';

            if (cache.length === 0) {
                recentTickers.innerHTML = '<p>Скоро здесь появится история</p>';
                clearButton.style.display = 'none';
            } else {
                cache.forEach(item => {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'btn start-ticker-btn ticker-btn';
                    button.dataset.ticker = item.ticker;
                    button.innerHTML = `${item.ticker} <span class="badge bg-success">${item.price}</span>`;
                    button.addEventListener('click', () => {
                        tickerInput.value = item.ticker;
                        searchButton.textContent = 'Торговать';
                        currentTicker = item.ticker;
                        resultElement.innerHTML = `
                            <div class="row">
                                <div class="col-lg-4"><p class="text-success">Код FIGI: ${item.figi}</p></div>
                                <div class="col-lg-4"><p class="text-success">Название: ${item.name}</p></div>
                                <div class="col-lg-4"><p class="text-success">Цена: ${item.price}</p></div>
                            </div>
                        `;
                        loadOrderBook(item.ticker);
                        startAutoUpdate();
                    });
                    recentTickers.appendChild(button);
                });
                clearButton.style.display = 'block';
            }
        })
        .catch(error => {
            console.error('Ошибка загрузки кеша:', error);
        });
}

function loadPortfolio() {
    fetch('/portfolio')
        .then(response => response.json())
        .then(data => {
            const portfolioResult = document.getElementById('portfolio-result');
            if (data.error) {
                portfolioResult.innerHTML = `<p class="text-danger">${data.error}</p>`;
            } else if (data.positions.length === 0) {
                portfolioResult.innerHTML = '<p>Портфель пуст</p>';
            } else {
                let html = '<table class="table table-sm"><thead><tr><th>Тикер</th><th>Название</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead><tbody>';
                data.positions.forEach(pos => {
                    html += `
                        <tr>
                            <td>${pos.ticker}</td>
                            <td>${pos.name}</td>
                            <td>${pos.quantity}</td>
                            <td>${pos.price}</td>
                            <td>${pos.total_value}</td>
                        </tr>
                    `;
                });
                html += '</tbody></table>';
                portfolioResult.innerHTML = html;
            }
        })
        .catch(error => {
            console.error('Ошибка загрузки портфеля:', error);
        });
}

function loadOrderBook(ticker) {
    if (!ticker) {
        document.getElementById('order-book-result').innerHTML = '<p>Выберите тикер для просмотра.</p>';
        return;
    }

    fetch(`/order_book/${ticker}`)
        .then(response => response.json())
        .then(data => {
            const orderBookResult = document.getElementById('order-book-result');
            if (data.error) {
                orderBookResult.innerHTML = `<p class="text-danger">${data.error}</p>`;
            } else {
                const maxBidQuantity = Math.max(...data.bids.map(bid => bid.quantity), 0);
                const maxAskQuantity = Math.max(...data.asks.map(ask => ask.quantity), 0);
                const maxQuantity = Math.max(maxBidQuantity, maxAskQuantity);

                let html = '<h5>Стакан заявок</h5><div class="row">';
                
                html += '<div class="col-6 bids"><h6>Покупка</h6><ul style="list-style: none; padding: 0;">';
                data.bids.forEach(bid => {
                    const widthPercent = maxQuantity > 0 ? (bid.quantity / maxQuantity) * 100 : 0;
                    html += `
                        <li style="margin-bottom: 5px;">
                            <span>${bid.price}</span> - <span>${bid.quantity} лотов</span>
                            <div class="progress" style="height: 10px;">
                                <div class="progress-bar bg-success" role="progressbar" style="width: ${widthPercent}%;" aria-valuenow="${bid.quantity}" aria-valuemin="0" aria-valuemax="${maxQuantity}"></div>
                            </div>
                        </li>`;
                });
                html += '</ul></div>';

                html += '<div class="col-6 asks"><h6>Продажа</h6><ul style="list-style: none; padding: 0;">';
                data.asks.forEach(ask => {
                    const widthPercent = maxQuantity > 0 ? (ask.quantity / maxQuantity) * 100 : 0;
                    html += `
                        <li style="margin-bottom: 5px;">
                            <span>${ask.price}</span> - <span>${ask.quantity} лотов</span>
                            <div class="progress" style="height: 10px;">
                                <div class="progress-bar bg-danger" role="progressbar" style="width: ${widthPercent}%;" aria-valuenow="${ask.quantity}" aria-valuemin="0" aria-valuemax="${maxQuantity}"></div>
                            </div>
                        </li>`;
                });
                html += '</ul></div>';

                html += '</div>';
                orderBookResult.innerHTML = html;
            }
        })
        .catch(error => {
            console.error('Ошибка загрузки стакана:', error);
        });
}

function updateTickerPrice(ticker) {
    if (!ticker) return;
    fetch(`/find_ticker/${ticker}`)
        .then(response => response.json())
        .then(data => {
            if (!data.error && currentTicker === ticker) {
                resultElement.innerHTML = `
                    <div class="row">
                        <div class="col-lg-4"><p class="text-success">Код FIGI: ${data.figi}</p></div>
                        <div class="col-lg-4"><p class="text-success">Название: ${data.name}</p></div>
                        <div class="col-lg-4"><p class="text-success">Цена: ${data.price}</p></div>
                    </div>
                `;
            }
        })
        .catch(error => {
            console.error('Ошибка обновления цены:', error);
        });
}

function startAutoUpdate() {
    if (priceUpdateInterval) clearInterval(priceUpdateInterval);
    if (orderBookUpdateInterval) clearInterval(orderBookUpdateInterval);

    priceUpdateInterval = setInterval(() => updateTickerPrice(currentTicker), 10000);
    orderBookUpdateInterval = setInterval(() => loadOrderBook(currentTicker), 10000);
}

function stopAutoUpdate() {
    if (priceUpdateInterval) clearInterval(priceUpdateInterval);
    if (orderBookUpdateInterval) clearInterval(orderBookUpdateInterval);
    priceUpdateInterval = null;
    orderBookUpdateInterval = null;
}

setInterval(updateTradingStatus, 1000);
loadRecentTickers();
loadPortfolio();
loadOrderBook(null);

const searchButton = document.getElementById('search-ticker-btn');
const tickerInput = document.getElementById('ticker-input');
const resultElement = document.getElementById('ticker-result');

searchButton.addEventListener('click', () => {
    const ticker = tickerInput.value.trim();
    console.log('Кнопка нажата. Текст кнопки:', searchButton.textContent);
    console.log('Текущий тикер:', currentTicker, 'Введенный тикер:', ticker);

    if (searchButton.textContent === 'Найти' && ticker) {
        console.log('Ищем тикер:', ticker);
        fetch(`/find_ticker/${ticker}`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    resultElement.innerHTML = `<p class="text-danger">Ошибка поиска: ${data.error}</p>`;
                } else {
                    resultElement.innerHTML = `
                        <div class="row">
                            <div class="col-lg-4"><p class="text-success">Код FIGI: ${data.figi}</p></div>
                            <div class="col-lg-4"><p class="text-success">Название: ${data.name}</p></div>
                            <div class="col-lg-4"><p class="text-success">Цена: ${data.price}</p></div>
                        </div>
                    `;
                    searchButton.textContent = 'Торговать';
                    currentTicker = ticker;
                    loadOrderBook(ticker);
                    startAutoUpdate();
                }
            })
            .catch(error => {
                console.error('Ошибка при поиске тикера:', error);
                resultElement.innerHTML = '<p class="text-danger">Ошибка поиска</p>';
            });
    } else if (searchButton.textContent === 'Торговать' && ticker === currentTicker) {
        console.log('Переход к торговле с тикером:', ticker);
        stopAutoUpdate();
        const figiElement = document.querySelector('#ticker-result .text-success:nth-child(1)');
        if (figiElement) {
            const figi = figiElement.textContent.split(': ')[1];
            console.log('FIGI извлечен:', figi);
            fetch('/start_trading', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticker: ticker, figi: figi })
            })
            .then(response => response.json())
            .then(data => {
                console.log('Ответ сервера:', data);
                if (data.status === 'success') {
                    console.log('trading.py запущен, закрываем текущее окно');
                    fetch('/close_app', { method: 'POST' })
                        .then(response => response.json())
                        .then(data => {
                            console.log('Текущее окно закрыто:', data.message);
                        })
                        .catch(error => {
                            console.error('Ошибка при закрытии текущего окна:', error);
                        });
                } else {
                    console.error('Ошибка запуска trading.py:', data.message);
                    alert('Ошибка: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Ошибка запроса /start_trading:', error);
                alert('Ошибка при запуске торговли');
            });
        } else {
            console.error('Ошибка: FIGI не найден в DOM');
            alert('Ошибка: Не удалось извлечь FIGI');
        }
    } else if (ticker !== currentTicker) {
        console.log('Сброс тикера');
        searchButton.textContent = 'Найти';
        resultElement.innerHTML = '';
        document.getElementById('order-book-result').innerHTML = '<p>Выберите тикер для просмотра.</p>';
        currentTicker = null;
        stopAutoUpdate();
    }
});

tickerInput.addEventListener('input', () => {
    if (searchButton.textContent === 'Торговать' && tickerInput.value.trim() !== currentTicker) {
        searchButton.textContent = 'Найти';
        resultElement.innerHTML = '';
        document.getElementById('order-book-result').innerHTML = '<p>Выберите тикер для просмотра.</p>';
        currentTicker = null;
        stopAutoUpdate();
    }
});

function addTickerButton(ticker) {
    const tickerList = document.querySelectorAll('.ticker-btn');
    if (!Array.from(tickerList).some(btn => btn.dataset.ticker === ticker) && tickerList.length < 10) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn start-ticker-btn ticker-btn';
        button.dataset.ticker = ticker;
        button.innerHTML = `${ticker} <span class="badge bg-success">N/A</span>`;
        button.addEventListener('click', () => {
            tickerInput.value = ticker;
            searchButton.textContent = 'Торговать';
            currentTicker = ticker;
            fetch(`/find_ticker/${ticker}`)
                .then(response => response.json())
                .then(data => {
                    resultElement.innerHTML = `
                        <div class="row">
                            <div class="col-lg-4"><p class="text-success">Код FIGI: ${data.figi}</p></div>
                            <div class="col-lg-4"><p class="text-success">Название: ${data.name}</p></div>
                            <div class="col-lg-4"><p class="text-success">Цена: ${data.price}</p></div>
                        </div>
                    `;
                    loadOrderBook(ticker);
                    startAutoUpdate();
                });
        });
        document.getElementById('recent-tickers').appendChild(button);
    }
}

document.getElementById('clear-tickers').addEventListener('click', () => {
    fetch('/clear_cache', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            document.getElementById('recent-tickers').innerHTML = '<p>Скоро здесь появится история</p>';
            document.getElementById('clear-tickers').style.display = 'none';
            searchButton.textContent = 'Найти';
            resultElement.innerHTML = '';
            document.getElementById('order-book-result').innerHTML = '<p>Выберите тикер для просмотра.</p>';
            currentTicker = null;
            stopAutoUpdate();
        })
        .catch(error => {
            console.error('Ошибка очистки кеша:', error);
        });
});

document.querySelector('[data-bs-target="#accountModal"]').addEventListener('click', () => {
    fetch('/account_info')
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                document.getElementById('account-id').textContent = "Ошибка";
                document.getElementById('account-name').textContent = "Ошибка";
                document.getElementById('token-status').textContent = data.error;
                document.getElementById('account-balance').textContent = "Ошибка";
            } else {
                document.getElementById('account-id').textContent = data.account_id;
                document.getElementById('account-name').textContent = data.name;
                document.getElementById('token-status').textContent = data.token_status;
                document.getElementById('account-balance').textContent = data.balance;
                selectedTimezone = data.timezone;
                document.getElementById('timezone-select').value = selectedTimezone;

                const resetButton = document.getElementById('reset-bot-btn');
                resetButton.textContent = 'Удалить .env и перезапустить';
                resetButton.classList.remove('btn-warning');
                resetButton.classList.add('btn-danger');
            }
        })
        .catch(error => {
            console.error('Ошибка загрузки информации об аккаунте:', error);
            document.getElementById('account-id').textContent = "Ошибка загрузки";
            document.getElementById('account-name').textContent = "Ошибка загрузки";
            document.getElementById('token-status').textContent = "Ошибка загрузки";
            document.getElementById('account-balance').textContent = "Ошибка загрузки";
        });
});

document.getElementById('reset-bot-btn').addEventListener('click', (event) => {
    const button = event.target;
    console.log('Кнопка нажата. Текущий текст:', button.textContent);
    
    if (button.textContent === 'Удалить .env и перезапустить') {
        console.log('Меняем текст на "Подтвердите"');
        button.textContent = 'Подтвердите';
        button.classList.remove('btn-danger');
        button.classList.add('btn-warning');
    } else if (button.textContent === 'Подтвердите') {
        console.log('Подтверждение получено, отправляем запрос');
        fetch('/reset_bot', { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                console.log('Ответ сервера:', data);
                if (data.status === 'success') {
                    alert(data.message);
                    const modal = bootstrap.Modal.getInstance(document.getElementById('accountModal'));
                    modal.hide();
                } else {
                    alert(data.error);
                }
                button.textContent = 'Удалить .env и перезапустить';
                button.classList.remove('btn-warning');
                button.classList.add('btn-danger');
            })
            .catch(error => {
                console.error('Ошибка при сбросе бота:', error);
                button.textContent = 'Удалить .env и перезапустить';
                button.classList.remove('btn-warning');
                button.classList.add('btn-danger');
            });
    }
});

document.getElementById('save-timezone-btn').addEventListener('click', () => {
    const timezone = document.getElementById('timezone-select').value;
    fetch('/set_timezone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone: timezone })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            selectedTimezone = timezone;
            updateTradingStatus();
            updateGreeting();
            const modal = bootstrap.Modal.getInstance(document.getElementById('accountModal'));
            modal.hide();
            console.log('Часовой пояс сохранен');
        } else {
            alert(data.error);
        }
    })
    .catch(error => {
        console.error('Ошибка при сохранении часового пояса:', error);
    });
});

document.getElementById('close-app-btn').addEventListener('click', () => {
    fetch('/close_app', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                console.log(data.message);
            } else {
                console.error('Ошибка при закрытии:', data.error);
            }
        })
        .catch(error => {
            console.error('Ошибка запроса /close_app:', error);
        });
});