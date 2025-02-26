import sys
import os
from threading import Thread
import asyncio
import threading
import numpy as np
from PyQt5.QtWidgets import QApplication, QMainWindow, QShortcut
from PyQt5.QtWebEngineWidgets import QWebEngineView
from PyQt5.QtCore import QUrl, QTimer
from PyQt5.QtGui import QKeySequence, QIcon
from flask import Flask, render_template, request, jsonify
from tinkoff.invest import AsyncClient, InstrumentIdType, CandleInterval
from dotenv import load_dotenv
import logging
from colorama import init, Fore, Style
import webbrowser
import configparser
from datetime import datetime, timedelta
import time
import json
from cachetools import TTLCache
from ratelimiter import RateLimiter
from websocket_server import WebsocketServer

# Инициализация colorama для цветного вывода
init()

# Кастомный форматтер для компактных логов с цветами
class CompactColoredFormatter(logging.Formatter):
    def format(self, record):
        level = record.levelname
        msg = record.getMessage()
        time_str = datetime.fromtimestamp(record.created).strftime('%H:%M:%S')
        if level == 'ERROR':
            return f"{time_str} - {Fore.RED}{level}{Style.RESET_ALL} - {msg}"
        return f"{time_str} - {level} - {msg}"

# Настройка логирования
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
handler.setFormatter(CompactColoredFormatter())
logger.addHandler(handler)

# Инициализация Flask
app = Flask(__name__, static_folder='static', template_folder='templates')

# Пути к файлам
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_DIR = os.path.join(BASE_DIR, "assets", "json")
CONFIG_FILE = os.path.join(os.getcwd(), "config.ini")
SETTINGS_FILE = os.path.join(JSON_DIR, "indicator_settings.json")
VIRTUAL_PORTFOLIO_FILE = os.path.join(JSON_DIR, "virtual_portfolio.json")
TRADE_HISTORY_FILE = os.path.join(JSON_DIR, "trade_history.json")

os.makedirs(JSON_DIR, exist_ok=True)

# Загрузка переменных окружения
load_dotenv()
TOKEN = os.getenv("TINKOFF_TOKEN").strip()
ACCOUNT_ID = os.getenv("ACCOUNT_ID")
if not TOKEN or not ACCOUNT_ID:
    logger.error("Токен или Account ID не найден")
    sys.exit(1)

logger.info(f"Токен загружен: {TOKEN[:10]}...")

# Кэш для данных
price_cache = TTLCache(maxsize=100, ttl=60)
candle_cache = TTLCache(maxsize=50, ttl=5)  # Уменьшен TTL для минутных свечей
instrument_cache = TTLCache(maxsize=200, ttl=3600)
market_status_cache = TTLCache(maxsize=100, ttl=300)

# Ограничение частоты запросов
rate_limiter = RateLimiter(max_calls=100, period=60)

# Глобальная переменная для потоковых данных
real_time_data = {}

# Глобальная переменная для цикла asyncio
stream_loop = None

# Конфигурация часового пояса
def load_config():
    config = configparser.ConfigParser()
    try:
        if os.path.exists(CONFIG_FILE):
            config.read(CONFIG_FILE)
            return config.get('Settings', 'timezone', fallback='Europe/Moscow')
        return 'Europe/Moscow'
    except Exception as e:
        logger.error(f"Ошибка загрузки конфига: {e}")
        return 'Europe/Moscow'

def save_config(timezone):
    config = configparser.ConfigParser()
    config['Settings'] = {'timezone': timezone}
    with open(CONFIG_FILE, 'w') as configfile:
        config.write(configfile)
    logger.info(f"Часовой пояс сохранён: {timezone}")

timezone = load_config()

# Виртуальный портфель
def load_or_create_json(file_path, default):
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Ошибка чтения {file_path}: {e}")
    with open(file_path, 'w') as f:
        json.dump(default, f)
    return default

virtual_portfolio = load_or_create_json(VIRTUAL_PORTFOLIO_FILE, {"balance": 1000000, "positions": {}, "initial_balance": 1000000})
trade_history = load_or_create_json(TRADE_HISTORY_FILE, [])

def save_json(file_path, data):
    try:
        with open(file_path, 'w') as f:
            json.dump(data, f)
        logger.info(f"Данные сохранены в {file_path}")
    except Exception as e:
        logger.error(f"Ошибка сохранения в {file_path}: {e}")

# Получение информации об инструменте
async def get_instrument_info(ticker, figi):
    cache_key = f"{figi}_instrument"
    if cache_key in instrument_cache:
        return instrument_cache[cache_key]
    
    async with AsyncClient(TOKEN) as client:
        try:
            instrument = await client.instruments.get_instrument_by(id_type=InstrumentIdType.INSTRUMENT_ID_TYPE_FIGI, id=figi)
            result = {"ticker": ticker, "figi": figi, "name": instrument.instrument.name, "timestamp": int(time.time())}
            instrument_cache[cache_key] = result
            logger.info(f"Инструмент: {instrument.instrument.name}")
            return result
        except Exception as e:
            logger.error(f"Ошибка инструмента для {figi}: {e}")
            return {"error": str(e), "timestamp": int(time.time())}

# Проверка статуса рынка
async def is_market_open(figi):
    cache_key = f"{figi}_market_status"
    if cache_key in market_status_cache:
        return market_status_cache[cache_key]
    
    async with AsyncClient(TOKEN) as client:
        try:
            status = await client.market_data.get_trading_status(figi=figi)
            is_open = status.trading_status == 5  # Числовое значение для открытого статуса
            market_status_cache[cache_key] = is_open
            real_time_data[figi] = real_time_data.get(figi, {})
            real_time_data[figi]['market_open'] = is_open
            logger.info(f"Статус для {figi}: {is_open}")
            return is_open
        except Exception as e:
            logger.error(f"Ошибка статуса для {figi}: {e}")
            return False

# Расчёт индикаторов
def calculate_sma(closes, period=14):
    if len(closes) < period:
        return []
    return [sum(closes[i:i+period]) / period for i in range(len(closes) - period + 1)]

def calculate_rsi(closes, period=14):
    if len(closes) < period + 1:
        return []
    gains, losses = [], []
    for i in range(1, len(closes)):
        diff = closes[i] - closes[i-1]
        gains.append(max(0, diff))
        losses.append(max(0, -diff))
    if len(gains) < period:
        return []
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    rsi = []
    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
        rs = avg_gain / (avg_loss or 0.0001)
        rsi.append(100 - (100 / (1 + rs)))
    return rsi

def calculate_macd(closes, fast=12, slow=26, signal=9):
    if len(closes) < slow + signal - 1:
        return {"macd": [], "signal": [], "histogram": []}
    def ema(prices, period):
        if len(prices) < period: return []
        ema = [sum(prices[:period]) / period]
        multiplier = 2 / (period + 1)
        for price in prices[period:]:
            ema.append((price - ema[-1]) * multiplier + ema[-1])
        return ema
    ema_fast = ema(closes, fast)
    ema_slow = ema(closes, slow)
    macd = [f - s for f, s in zip(ema_fast[slow-fast:], ema_slow)]
    signal_line = ema(macd, signal)
    histogram = [m - s for m, s in zip(macd[signal-1:], signal_line)]
    return {"macd": macd[signal-1:], "signal": signal_line, "histogram": histogram}

# Потоковая подписка
async def stream_market_data(figi_list, ws_server):
    async with AsyncClient(TOKEN) as client:
        logger.info("Потоковая подписка запущена")
        async for response in client.market_data_stream.market_data_stream([
            {"subscribe_last_price_request": {"instrument_id": figi}} for figi in figi_list
        ]):
            if response.last_price:
                figi = response.last_price.figi
                price = response.last_price.price.units + response.last_price.price.nano / 1e9
                real_time_data[figi] = real_time_data.get(figi, {})
                real_time_data[figi].update({'price': price, 'timestamp': int(time.time())})
                logger.info(f"Цена для {figi}: {price}")
                message = json.dumps({"figi": figi, "price": price, "change": 0, "market_open": real_time_data[figi].get('market_open', False), "time": int(time.time() * 1000)})
                ws_server.send_message_to_all(message)
            elif response.trading_status:
                figi = response.trading_status.figi
                is_open = response.trading_status == 5  # Числовое значение для открытого статуса
                real_time_data[figi] = real_time_data.get(figi, {})
                real_time_data[figi]['market_open'] = is_open
                logger.info(f"Статус для {figi}: {is_open}")
                message = json.dumps({"figi": figi, "market_open": is_open, "message": "Биржа закрыта" if not is_open else "Биржа открыта"})
                ws_server.send_message_to_all(message)
            elif response.ping:
                logger.info("Ping от Tinkoff API")

# Запуск WebSocket-сервера
def start_websocket_server():
    server = WebsocketServer('127.0.0.1', 9001)
    server.set_fn_new_client(lambda client, server: logger.info(f"WebSocket подключение: {client['id']}"))
    server.set_fn_client_left(lambda client, server: logger.info(f"WebSocket отключен: {client['id']}"))
    server.set_fn_message_received(lambda client, server, msg: logger.info(f"WebSocket сообщение: {msg}"))
    threading.Thread(target=server.run_forever, daemon=True).start()
    return server

# Запуск потоковой подписки
def start_stream(ws_server):
    global stream_loop
    stream_loop = asyncio.new_event_loop()
    asyncio.set_event_loop(stream_loop)
    asyncio.ensure_future(stream_market_data(['TCS00A106YF0'], ws_server), loop=stream_loop)
    logger.info("Потоковая подписка запущена")
    stream_loop.run_forever()

@app.route('/trading')
def trading():
    ticker = sys.argv[1] if len(sys.argv) > 1 else ""
    figi = sys.argv[2] if len(sys.argv) > 2 else ""
    logger.info(f"Аргументы: ticker={ticker}, figi={figi}")
    initial_data = {"ticker": ticker, "figi": figi, "timestamp": int(time.time()), "name": "", "error": None}
    
    if ticker and figi:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        instrument_info = loop.run_until_complete(get_instrument_info(ticker, figi))
        if "error" not in instrument_info:
            initial_data.update(instrument_info)
        else:
            initial_data["error"] = instrument_info["error"]
            logger.warning(f"Ошибка в инструменте: {instrument_info['error']}")
    else:
        initial_data["error"] = "Тикер или FIGI не переданы"
        logger.warning("Тикер или FIGI отсутствуют")
    
    logger.info(f"Данные для рендера: ticker={initial_data['ticker']}")
    return render_template('trading.html', **initial_data)

@app.route('/get_price', methods=['GET'])
def get_price():
    ticker, figi = request.args.get('ticker', ''), request.args.get('figi', '')
    if not figi:
        return jsonify({"error": "FIGI не указан"})
    
    cache_key = f"{figi}_price"
    if figi in real_time_data and 'price' in real_time_data[figi]:
        logger.info(f"Потоковые данные для {ticker or figi}")
        return jsonify({"price": real_time_data[figi]['price'], "change": 0, "lastPrice": 0, "market_open": real_time_data[figi].get('market_open', False)})
    
    if cache_key in price_cache:
        logger.info(f"Кэш цены для {ticker or figi}")
        return jsonify(price_cache[cache_key])
    
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    market_open = loop.run_until_complete(is_market_open(figi))
    if not market_open:
        logger.info(f"Биржа закрыта для {ticker or figi}")
        return jsonify({"error": "Биржа закрыта", "market_open": False})
    
    try:
        async def fetch_price():
            async with AsyncClient(TOKEN) as client:
                price_data = await client.market_data.get_last_prices(figi=[figi])
                price = price_data.last_prices[0].price.units + price_data.last_prices[0].price.nano / 1e9
                last_price = 0  # Упрощаем, так как дневные свечи могут вызывать ошибки
                change = ((price - last_price) / last_price * 100) if last_price else 0
                result = {"price": price, "lastPrice": last_price, "change": change, "market_open": True}
                price_cache[cache_key] = result
                return result
        
        result = loop.run_until_complete(fetch_price())
        logger.info(f"Цена для {ticker or figi}: {result['price']}, Предыдущая цена: {result['lastPrice']}")
        return jsonify(result)
    except Exception as e:
        logger.error(f"Ошибка цены для {ticker or figi}: {e}")
        return jsonify({"error": str(e), "market_open": market_open})

@app.route('/find_figi')
def find_figi():
    ticker = request.args.get('ticker', '')
    cache_key = f"{ticker}_figi"
    
    if cache_key in instrument_cache:
        logger.info(f"Кэш FIGI для {ticker}")
        return jsonify({"figi": instrument_cache[cache_key]["figi"]})
    
    try:
        async def fetch_figi():
            async with AsyncClient(TOKEN) as client:
                instruments = await client.instruments.find_instrument(query=ticker)
                if instruments.instruments:
                    instrument = next((i for i in instruments.instruments if i.ticker == ticker.upper()), instruments.instruments[0])
                    result = {"figi": instrument.figi}
                    instrument_cache[cache_key] = {"figi": instrument.figi, "ticker": ticker}
                    return result
                return {"error": f"Тикер {ticker} не найден"}
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(fetch_figi())
        logger.info(f"FIGI для {ticker}: {result.get('figi', 'не найден')}")
        return jsonify(result)
    except Exception as e:
        logger.error(f"Ошибка поиска FIGI: {e}")
        return jsonify({"error": str(e)})

@app.route('/order_book')
def order_book():
    ticker, figi = request.args.get('ticker', ''), request.args.get('figi', '')
    try:
        async def fetch_order_book():
            async with AsyncClient(TOKEN) as client:
                order_book_data = await client.market_data.get_order_book(figi=figi, depth=10)
                market_open = await is_market_open(figi)
                return {
                    "figi": order_book_data.figi,
                    "bids": [{"price": bid.price.units + bid.price.nano / 1e9, "quantity": bid.quantity} for bid in order_book_data.bids],
                    "asks": [{"price": ask.price.units + ask.price.nano / 1e9, "quantity": ask.quantity} for ask in order_book_data.asks],
                    "market_open": market_open
                }
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(fetch_order_book())
        logger.info(f"Стакан для {ticker}")
        return jsonify(result)
    except Exception as e:
        logger.error(f"Ошибка стакана для {ticker}: {e}")
        return jsonify({"error": str(e)})

@app.route('/get_candles', methods=['GET'])
def get_candles():
    ticker, figi = request.args.get('ticker', ''), request.args.get('figi', '')
    timeframe = request.args.get('timeframe', '1m')
    cache_key = f"candles_{figi}_{timeframe}"

    if cache_key in candle_cache and (time.time() - candle_cache[cache_key]['timestamp']) < 5:
        logger.info(f"Кэш свечей для {ticker or figi} ({timeframe})")
        return jsonify(candle_cache[cache_key]['candles'])

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        async def fetch_candles():
            async with AsyncClient(TOKEN) as client:
                intervals = {
                    '1m': CandleInterval.CANDLE_INTERVAL_1_MIN,
                    '5m': CandleInterval.CANDLE_INTERVAL_5_MIN,
                    '15m': CandleInterval.CANDLE_INTERVAL_15_MIN,
                    '30m': CandleInterval.CANDLE_INTERVAL_30_MIN,
                    '1h': CandleInterval.CANDLE_INTERVAL_HOUR,
                    '4h': CandleInterval.CANDLE_INTERVAL_4_HOUR,
                    '1d': CandleInterval.DAY,
                    '1w': CandleInterval.WEEK,
                    '1M': CandleInterval.MONTH
                }
                interval = intervals.get(timeframe, CandleInterval.CANDLE_INTERVAL_1_MIN)

                now = datetime.utcnow()
                if timeframe in ['1d', '1w', '1M']:
                    from_time = now - timedelta(days=60)  # Сохраняем стабильный диапазон 60 дней
                elif timeframe in ['1h', '4h']:
                    from_time = now - timedelta(hours=24)  # Сохраняем стабильный диапазон 24 часа
                else:  # Для минутных интервалов (1m, 5m, 15m, 30m)
                    from_time = now - timedelta(minutes=1)  # Минимальный диапазон: 1 минута

                try:
                    candles = await client.market_data.get_candles(figi=figi, from_=from_time, to=now, interval=interval)
                    price_data = await client.market_data.get_last_prices(figi=[figi])
                    latest_price = price_data.last_prices[0].price.units + price_data.last_prices[0].price.nano / 1e9

                    candle_data = [{
                        'time': c.time.timestamp() * 1000,
                        'open': c.open.units + c.open.nano / 1e9,
                        'high': c.high.units + c.high.nano / 1e9,
                        'low': c.low.units + c.low.nano / 1e9,
                        'close': latest_price if i == len(candles.candles) - 1 else c.close.units + c.close.nano / 1e9,
                        'volume': c.volume
                    } for i, c in enumerate(candles.candles)]

                    if not candle_data:
                        logger.warning(f"Нет свечей для {figi} ({timeframe})")
                        return jsonify([])

                    candle_cache[cache_key] = {'candles': candle_data, 'timestamp': time.time()}
                    logger.info(f"Свечи для {ticker or figi} ({timeframe}): {len(candle_data)} записей")
                    return jsonify(candle_data)
                except Exception as e:
                    logger.error(f"Ошибка получения свечей для {figi} ({timeframe}): {e}")
                    if timeframe in ['1d', '1w', '1M']:
                        from_time_fallback = now - timedelta(days=7)  # Фолбэк на 7 дней
                        try:
                            candles_fallback = await client.market_data.get_candles(figi=figi, from_=from_time_fallback, to=now, interval=CandleInterval.DAY)
                            candle_data_fallback = [{
                                'time': c.time.timestamp() * 1000,
                                'open': c.open.units + c.open.nano / 1e9,
                                'high': c.high.units + c.high.nano / 1e9,
                                'low': c.low.units + c.low.nano / 1e9,
                                'close': latest_price if i == len(candles_fallback.candles) - 1 else c.close.units + c.close.nano / 1e9,
                                'volume': c.volume
                            } for i, c in enumerate(candles_fallback.candles)]
                            candle_cache[cache_key] = {'candles': candle_data_fallback, 'timestamp': time.time()}
                            logger.info(f"Фолбэк: Свечи для {ticker or figi} ({timeframe}): {len(candle_data_fallback)} записей")
                            return jsonify(candle_data_fallback)
                        except Exception as e_fallback:
                            logger.error(f"Фолбэк не сработал для {figi} ({timeframe}): {e_fallback}")
                    elif timeframe in ['1h', '4h']:
                        from_time_fallback = now - timedelta(hours=12)  # Фолбэк на 12 часов
                        try:
                            candles_fallback = await client.market_data.get_candles(figi=figi, from_=from_time_fallback, to=now, interval=CandleInterval.CANDLE_INTERVAL_HOUR)
                            candle_data_fallback = [{
                                'time': c.time.timestamp() * 1000,
                                'open': c.open.units + c.open.nano / 1e9,
                                'high': c.high.units + c.high.nano / 1e9,
                                'low': c.low.units + c.low.nano / 1e9,
                                'close': latest_price if i == len(candles_fallback.candles) - 1 else c.close.units + c.close.nano / 1e9,
                                'volume': c.volume
                            } for i, c in enumerate(candles_fallback.candles)]
                            candle_cache[cache_key] = {'candles': candle_data_fallback, 'timestamp': time.time()}
                            logger.info(f"Фолбэк: Свечи для {ticker or figi} ({timeframe}): {len(candle_data_fallback)} записей")
                            return jsonify(candle_data_fallback)
                        except Exception as e_fallback:
                            logger.error(f"Фолбэк не сработал для {figi} ({timeframe}): {e_fallback}")
                    else:  # Для минутных интервалов (1m, 5m, 15m, 30m)
                        from_time_fallback = now - timedelta(seconds=30)  # Минимальный фолбэк: 30 секунд
                        try:
                            candles_fallback = await client.market_data.get_candles(figi=figi, from_=from_time_fallback, to=now, interval=CandleInterval.CANDLE_INTERVAL_1_MIN)
                            candle_data_fallback = [{
                                'time': c.time.timestamp() * 1000,
                                'open': c.open.units + c.open.nano / 1e9,
                                'high': c.high.units + c.high.nano / 1e9,
                                'low': c.low.units + c.low.nano / 1e9,
                                'close': latest_price if i == len(candles_fallback.candles) - 1 else c.close.units + c.close.nano / 1e9,
                                'volume': c.volume
                            } for i, c in enumerate(candles_fallback.candles)]
                            candle_cache[cache_key] = {'candles': candle_data_fallback, 'timestamp': time.time()}
                            logger.info(f"Фолбэк: Свечи для {ticker or figi} ({timeframe}): {len(candle_data_fallback)} записей")
                            return jsonify(candle_data_fallback)
                        except Exception as e_fallback:
                            logger.error(f"Фолбэк не сработал для {figi} ({timeframe}): {e_fallback}")
                    return jsonify([])

        result = loop.run_until_complete(fetch_candles())
        return result
    except Exception as e:
        logger.error(f"Ошибка получения свечей для {ticker or figi} ({timeframe}): {e}")
        return jsonify({'error': str(e)})

@app.route('/account_info')
def account_info():
    mode = request.args.get('mode', 'real')
    try:
        async def fetch_account_info():
            async with AsyncClient(TOKEN) as client:
                accounts = await client.users.get_accounts()
                account = next((acc for acc in accounts.accounts if acc.id == ACCOUNT_ID), None)
                if not account:
                    return {"error": "Аккаунт не найден"}
                
                if mode == 'real':
                    portfolio = await client.operations.get_portfolio(account_id=ACCOUNT_ID)
                    real_balance = sum(pos.current_price.units + pos.current_price.nano / 1e9 * pos.quantity.units + pos.quantity.nano / 1e9 
                                     for pos in portfolio.positions if pos.current_price.currency == 'rub')
                    positions = {}
                    for pos in portfolio.positions:
                        price = pos.current_price.units + pos.current_price.nano / 1e9
                        quantity = pos.quantity.units + pos.quantity.nano / 1e9
                        instrument = await client.instruments.get_instrument_by(id_type=InstrumentIdType.INSTRUMENT_ID_TYPE_FIGI, id=pos.figi)
                        positions[pos.figi] = {
                            "name": instrument.instrument.name,
                            "ticker": instrument.instrument.ticker,
                            "quantity": quantity,
                            "avg_price": (pos.average_position_price.units + pos.average_position_price.nano / 1e9) if pos.average_position_price else 0,
                            "current_value": f"{price * quantity:.2f}"
                        }
                    return {
                        "account_id": ACCOUNT_ID,
                        "name": account.name or "Без названия",
                        "token_status": "Действителен",
                        "balance": f"{real_balance:.2f} ₽",
                        "timezone": timezone,
                        "mode": "real",
                        "positions": positions
                    }
                else:
                    virtual_balance = virtual_portfolio["balance"]
                    positions = {}
                    for figi, pos in virtual_portfolio["positions"].items():
                        instrument = await client.instruments.get_instrument_by(id_type=InstrumentIdType.INSTRUMENT_ID_TYPE_FIGI, id=figi)
                        positions[figi] = {
                            "name": instrument.instrument.name,
                            "ticker": instrument.instrument.ticker,
                            "quantity": pos["quantity"],
                            "avg_price": pos["avg_price"],
                            "current_value": f"{pos['quantity'] * pos['avg_price']:.2f}"
                        }
                    return {
                        "account_id": ACCOUNT_ID,
                        "name": account.name or "Без названия",
                        "token_status": "Действителен (Обучение)",
                        "balance": f"{virtual_balance:.2f} ₽",
                        "timezone": timezone,
                        "mode": "training",
                        "initial_balance": virtual_portfolio["initial_balance"],
                        "positions": positions
                    }
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(fetch_account_info())
        logger.info(f"Данные для {mode}: balance={result.get('balance')}")
        return jsonify(result)
    except Exception as e:
        logger.error(f"Ошибка аккаунта: {e}")
        return jsonify({"error": str(e)})

@app.route('/set_timezone', methods=['POST'])
def set_timezone():
    data = request.json
    new_timezone = data.get('timezone')
    if new_timezone:
        save_config(new_timezone)
        global timezone
        timezone = new_timezone
        logger.info("Часовой пояс обновлён")
        return jsonify({"status": "success", "message": "Часовой пояс сохранён"})
    logger.error("Часовой пояс не указан")
    return jsonify({"status": "error", "error": "Часовой пояс не указан"})

@app.route('/get_indicator_settings', methods=['GET'])
def get_indicator_settings():
    default_settings = {'indicators': {'sma': True, 'rsi': True, 'macd': False, 'bollinger': False, 'vwap': False, 'stochastic': False}, 'strategySettings': {'scalping': {'period': 5, 'profitTarget': 0.5, 'stopLoss': 0.2, 'volume': 1}}}
    try:
        with open(SETTINGS_FILE, 'r') as f:
            settings = json.load(f)
            logger.info("Настройки индикаторов загружены")
            return jsonify(settings)
    except FileNotFoundError:
        with open(SETTINGS_FILE, 'w') as f:
            json.dump(default_settings, f)
        logger.info("Созданы настройки по умолчанию")
        return jsonify(default_settings)
    except Exception as e:
        logger.error(f"Ошибка чтения/создания настроек: {e}")
        return jsonify(default_settings)

@app.route('/save_settings', methods=['POST'])
def save_settings():
    settings = request.get_json()
    try:
        with open(SETTINGS_FILE, 'w') as f:
            json.dump(settings, f)
        logger.info("Настройки сохранены")
        return jsonify({'status': 'success'})
    except Exception as e:
        logger.error(f"Ошибка сохранения настроек: {e}")
        return jsonify({'status': 'error', 'error': str(e)})

@app.route('/set_virtual_balance', methods=['POST'])
def set_virtual_balance():
    data = request.json
    new_balance = float(data.get('balance', 1000000))
    virtual_portfolio["balance"] = new_balance
    virtual_portfolio["initial_balance"] = new_balance
    virtual_portfolio["positions"] = {}
    save_json(VIRTUAL_PORTFOLIO_FILE, virtual_portfolio)
    logger.info(f"Баланс установлен: {new_balance}")
    return jsonify({"status": "success", "message": f"Баланс: {new_balance} ₽"})

@app.route('/place_order', methods=['POST'])
def place_order():
    data = request.json
    ticker, figi, action = data.get('ticker'), data.get('figi'), data.get('action')
    quantity = int(data.get('quantity', 1))
    mode = data.get('mode', 'real')
    
    try:
        async def get_price():
            async with AsyncClient(TOKEN) as client:
                price_data = await client.market_data.get_last_prices(figi=[figi])
                return price_data.last_prices[0].price.units + price_data.last_prices[0].price.nano / 1e9
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        price = loop.run_until_complete(get_price())
        total_cost = price * quantity
        
        if mode == 'real':
            logger.info(f"Реальная заявка: {action} {quantity} {ticker}")
            return jsonify({"status": "success", "message": f"{action} {quantity} {ticker} (заглушка)"})
        else:
            global virtual_portfolio, trade_history
            if action == 'buy':
                if virtual_portfolio['balance'] >= total_cost:
                    virtual_portfolio['balance'] -= total_cost
                    virtual_portfolio['positions'][figi] = virtual_portfolio['positions'].get(figi, {"quantity": 0, "avg_price": 0})
                    pos = virtual_portfolio['positions'][figi]
                    pos["quantity"] += quantity
                    pos["avg_price"] = ((pos["avg_price"] * (pos["quantity"] - quantity)) + total_cost) / pos["quantity"]
                    save_json(VIRTUAL_PORTFOLIO_FILE, virtual_portfolio)
                    trade_history.append({"ticker": ticker, "figi": figi, "action": "buy", "quantity": quantity, "price": price, "total_cost": total_cost, "timestamp": int(time.time())})
                    save_json(TRADE_HISTORY_FILE, trade_history)
                    logger.info(f"Покупка: {quantity} {ticker} за {total_cost}")
                    return jsonify({"status": "success", "message": f"Куплено {quantity} {ticker} за {total_cost}"})
                logger.error("Недостаточно средств")
                return jsonify({"status": "error", "error": "Недостаточно средств"})
            elif action == 'sell':
                if virtual_portfolio['positions'].get(figi, {"quantity": 0})["quantity"] >= quantity:
                    virtual_portfolio['balance'] += total_cost
                    virtual_portfolio['positions'][figi]["quantity"] -= quantity
                    if virtual_portfolio['positions'][figi]["quantity"] <= 0:
                        del virtual_portfolio['positions'][figi]
                    save_json(VIRTUAL_PORTFOLIO_FILE, virtual_portfolio)
                    trade_history.append({"ticker": ticker, "figi": figi, "action": "sell", "quantity": quantity, "price": price, "total_cost": total_cost, "timestamp": int(time.time())})
                    save_json(TRADE_HISTORY_FILE, trade_history)
                    logger.info(f"Продажа: {quantity} {ticker} за {total_cost}")
                    return jsonify({"status": "success", "message": f"Продано {quantity} {ticker} за {total_cost}"})
                logger.error("Недостаточно лотов")
                return jsonify({"status": "error", "error": "Недостаточно лотов"})
    except Exception as e:
        logger.error(f"Ошибка заявки для {ticker}: {e}")
        return jsonify({"status": "error", "error": str(e)})

@app.route('/portfolio_stats')
def portfolio_stats():
    mode = request.args.get('mode', 'training')
    if mode != 'training':
        logger.error("Статистика только для training")
        return jsonify({"error": "Только для тренировочного режима"}), 400
    
    try:
        async def fetch_portfolio_stats():
            async with AsyncClient(TOKEN) as client:
                global trade_history, virtual_portfolio
                if not trade_history:
                    logger.info("История сделок пуста")
                    return {"volatility": 0, "max_drawdown": 0, "sharpe_ratio": 0}
                prices = []
                for trade in trade_history:
                    if trade["figi"] in virtual_portfolio["positions"]:
                        price_data = await client.market_data.get_last_prices(figi=[trade["figi"]])
                        price = price_data.last_prices[0].price.units + price_data.last_prices[0].price.nano / 1e9
                        prices.append(price * virtual_portfolio["positions"][trade["figi"]]["quantity"])
                if len(prices) < 2:
                    logger.info("Недостаточно данных")
                    return {"volatility": 0, "max_drawdown": 0, "sharpe_ratio": 0}
                returns = np.diff(prices) / prices[:-1]
                volatility = np.std(returns) * np.sqrt(252) if returns.size else 0
                max_drawdown = np.max(np.maximum.accumulate(prices) - prices) / max(np.maximum.accumulate(prices), 1) if prices else 0
                sharpe_ratio = (np.mean(returns) / np.std(returns) * np.sqrt(252)) if np.std(returns) else 0
                return {"volatility": float(volatility), "max_drawdown": float(max_drawdown), "sharpe_ratio": float(sharpe_ratio)}
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(fetch_portfolio_stats())
        logger.info(f"Статистика: {result}")
        return jsonify(result)
    except Exception as e:
        logger.error(f"Ошибка статистики: {e}")
        return jsonify({"error": str(e)})

@app.route('/trading_schedule')
def trading_schedule():
    current_time_utc = datetime.utcnow()
    msk_offset = timedelta(hours=3)
    current_time_msk = current_time_utc + msk_offset
    logger.info(f"Время MSK: {current_time_msk.strftime('%H:%M:%S')}")
    print(f"Время MSK (print): {current_time_msk.strftime('%H:%M:%S')}")

    opening_auction_start = current_time_msk.replace(hour=9, minute=50, second=0, microsecond=0)
    trading_session_start = current_time_msk.replace(hour=10, minute=0, second=0, microsecond=0)
    trading_session_end = current_time_msk.replace(hour=18, minute=39, second=0, microsecond=0)

    is_weekend = current_time_msk.weekday() >= 5

    try:
        if is_weekend:
            logger.info("Выходной")
            days_to_monday = (7 - current_time_msk.weekday()) % 7 or 7
            next_opening = (current_time_msk + timedelta(days=days_to_monday)).replace(hour=9, minute=50, second=0)
            time_to_open = (next_opening - current_time_msk).total_seconds()
            result = {"is_open": False, "time_to_open": max(time_to_open, 0), "time_to_close": 0, "opening_time": next_opening.isoformat(), "closing_time": (next_opening + timedelta(hours=8, minutes=49)).isoformat(), "message": "Биржа закрыта (выходной)"}
        elif opening_auction_start <= current_time_msk < trading_session_start:
            time_to_open = (trading_session_start - current_time_msk).total_seconds()
            logger.info("Аукцион открытия")
            result = {"is_open": False, "time_to_open": max(time_to_open, 0), "time_to_close": 0, "opening_time": trading_session_start.isoformat(), "closing_time": trading_session_end.isoformat(), "message": "Аукцион открытия"}
        elif trading_session_start <= current_time_msk <= trading_session_end:
            time_to_close = (trading_session_end - current_time_msk).total_seconds()
            logger.info("Торговая сессия")
            result = {"is_open": True, "time_to_open": 0, "time_to_close": max(time_to_close, 0), "opening_time": trading_session_start.isoformat(), "closing_time": trading_session_end.isoformat(), "message": "Биржа открыта"}
        else:
            if current_time_msk < opening_auction_start:
                time_to_open = (opening_auction_start - current_time_msk).total_seconds()
                next_opening = opening_auction_start
                logger.info("До открытия")
                result = {"is_open": False, "time_to_open": max(time_to_open, 0), "time_to_close": 0, "opening_time": next_opening.isoformat(), "closing_time": trading_session_end.isoformat(), "message": "Биржа закрыта, до открытия"}
            else:
                next_opening = (current_time_msk + timedelta(days=1)).replace(hour=9, minute=50, second=0)
                while next_opening.weekday() >= 5:
                    next_opening += timedelta(days=1)
                time_to_open = (next_opening - current_time_msk).total_seconds()
                logger.info("Биржа закрыта")
                result = {"is_open": False, "time_to_open": max(time_to_open, 0), "time_to_close": 0, "opening_time": next_opening.isoformat(), "closing_time": (next_opening + timedelta(hours=8, minutes=49)).isoformat(), "message": "Биржа закрыта"}

        logger.info(f"Расписание: {result['message']}")
        print(f"Результат (print): {result['message']}")
        return jsonify(result)
    except Exception as e:
        logger.error(f"Ошибка расписания: {e}")
        return jsonify({"error": str(e)})

@app.route('/trade_history')
def trade_history_route():
    try:
        logger.info(f"История: {len(trade_history)} записей")
        return jsonify({"trades": trade_history})
    except Exception as e:
        logger.error(f"Ошибка истории: {e}")
        return jsonify({"error": str(e)})

def run_flask():
    try:
        logger.info("Flask сервер запущен")
        flask_app.run(host='127.0.0.1', port=5002, debug=False, use_reloader=False)
    except Exception as e:
        logger.error(f"Ошибка Flask: {e}")
        sys.exit(1)

class TradingWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setGeometry(100, 100, 1300, 700)
        self.setWindowTitle("Торговый Бот - Торговля")
        self.setWindowIcon(QIcon('static/icon.png'))
        os.environ["QTWEBENGINE_REMOTE_DEBUGGING"] = "9224"
        os.environ["QTWEBENGINE_CHROMIUM_FLAGS"] = "--disable-gpu-shader-disk-cache"
        self.browser = QWebEngineView(self)
        self.setCentralWidget(self.browser)
        QTimer.singleShot(1000, self.load_url)
        self.shortcut_f12 = QShortcut(QKeySequence("F12"), self)
        self.shortcut_f12.activated.connect(self.open_dev_tools)
        logger.info("F12 настроена")

    def load_url(self):
        try:
            self.browser.setUrl(QUrl("http://127.0.0.1:5002/trading"))
            logger.info("Окно TradingWindow инициализировано")
        except Exception as e:
            logger.error(f"Ошибка окна: {e}")

    def open_dev_tools(self):
        logger.info("DevTools открыт")
        webbrowser.open("http://localhost:9224")

    def closeEvent(self, event):
        logger.info("Закрытие окна")
        if stream_loop:
            stream_loop.call_soon_threadsafe(stream_loop.stop)
        event.accept()

def run_qt_app(qt_app):
    try:
        window = TradingWindow()
        window.show()
        logger.info("PyQt5 запущен в основном потоке")
        qt_app.aboutToQuit.connect(lambda: stream_loop.call_soon_threadsafe(stream_loop.stop) if stream_loop else None)
        sys.exit(qt_app.exec_())
    except Exception as e:
        logger.error(f"Ошибка PyQt5: {e}")
        sys.exit(1)

if __name__ == "__main__":
    flask_app = app  # Flask приложение
    qt_app = QApplication(sys.argv)  # PyQt5 приложение

    ws_server = start_websocket_server()
    stream_thread = Thread(target=start_stream, args=(ws_server,), daemon=True)
    stream_thread.start()
    flask_thread = Thread(target=run_flask, daemon=True)
    flask_thread.start()

    run_qt_app(qt_app)  # Запускаем PyQt5 в основном потоке