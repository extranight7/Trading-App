# /start.py
import sys
import os
import json
import logging
import webbrowser
import subprocess
from PyQt5.QtWidgets import QApplication, QMainWindow, QShortcut
from PyQt5.QtWebEngineWidgets import QWebEngineView
from PyQt5.QtCore import QUrl, Qt
from PyQt5.QtGui import QKeySequence
from flask import Flask, jsonify, render_template, request
from dotenv import load_dotenv
from addons.start.find_figi import find_figi
from tinkoff.invest import Client, InstrumentIdType, RequestError
from datetime import datetime, timezone
from threading import Thread

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

app_flask = Flask(__name__, static_folder='static', template_folder='templates')

TOKEN = None
ACCOUNT_ID = None
CACHE_FILE = 'assets/json/find_figi.json'
ENV_FILE = os.path.join(os.getcwd(), ".env")
CONFIG_FILE = os.path.join(os.getcwd(), "config.ini")
TRADING_SCHEDULE = None

def load_config():
    global TOKEN, ACCOUNT_ID, TRADING_SCHEDULE
    load_dotenv()
    TOKEN = os.getenv("TINKOFF_TOKEN")
    ACCOUNT_ID = os.getenv("ACCOUNT_ID")
    if not TOKEN or not ACCOUNT_ID:
        logger.error("Токен или Account ID не найден в .env файле.")
        sys.exit(1)
    try:
        with Client(TOKEN) as client:
            client.users.get_accounts()  # Проверка токена
            exchanges = client.instruments.trading_schedules(exchange="MOEX", from_=datetime.now(timezone.utc)).exchanges
            TRADING_SCHEDULE = exchanges[0].days if exchanges else []
        logger.info("Конфигурация загружена успешно")
    except Exception as e:
        logger.error(f"Ошибка при инициализации: {e}")
        sys.exit(1)

def load_cache():
    try:
        os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)
        if os.path.exists(CACHE_FILE):
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        return []
    except Exception as e:
        logger.error(f"Ошибка при загрузке кеша: {e}")
        return []

def save_cache(cache):
    try:
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(cache, f, ensure_ascii=False, indent=4)
    except Exception as e:
        logger.error(f"Ошибка при сохранении кеша: {e}")

@app_flask.route('/trading_status', methods=['GET'])
def trading_status():
    try:
        return jsonify({
            "schedule": [{"date": day.date.isoformat(), "is_trading_day": day.is_trading_day} for day in TRADING_SCHEDULE]
        })
    except Exception as e:
        logger.error(f"Ошибка в /trading_status: {e}")
        return jsonify({"status": "error", "message": str(e), "time_until_next_event": 0, "next_event": "Неизвестно"})

@app_flask.route('/find_ticker/<ticker>', methods=['GET'])
def find_ticker(ticker):
    cache = load_cache()
    ticker_upper = ticker.upper()
    for item in cache:
        if item['ticker'] == ticker_upper:
            with Client(TOKEN) as client:
                price_data = client.market_data.get_last_prices(figi=[item['figi']]).last_prices[0]
                instrument = client.instruments.get_instrument_by(id_type=InstrumentIdType.INSTRUMENT_ID_TYPE_FIGI, id=item['figi']).instrument
                price = price_data.price.units + price_data.price.nano / 1e9
                item['price'] = f"{price:.2f} {instrument.currency.upper()}"
            return jsonify(item)
    result = find_figi(TOKEN, ticker)
    if "error" not in result:
        with Client(TOKEN) as client:
            price_data = client.market_data.get_last_prices(figi=[result['figi']]).last_prices[0]
            instrument = client.instruments.get_instrument_by(id_type=InstrumentIdType.INSTRUMENT_ID_TYPE_FIGI, id=result['figi']).instrument
            price = price_data.price.units + price_data.price.nano / 1e9
            result['price'] = f"{price:.2f} {instrument.currency.upper()}"
        cache.insert(0, result)
        cache = cache[:10]
        save_cache(cache)
    logger.info(f"Найден инструмент: {result.get('ticker', ticker)} - {result.get('name', 'N/A')}")
    return jsonify(result)

@app_flask.route('/get_cache', methods=['GET'])
def get_cache():
    cache = load_cache()
    with Client(TOKEN) as client:
        figi_list = [item['figi'] for item in cache]
        if figi_list:
            price_data = client.market_data.get_last_prices(figi=figi_list).last_prices
            price_dict = {price.figi: price for price in price_data}
            for item in cache:
                price_info = price_dict.get(item['figi'])
                if price_info:
                    instrument = client.instruments.get_instrument_by(id_type=InstrumentIdType.INSTRUMENT_ID_TYPE_FIGI, id=item['figi']).instrument
                    price = price_info.price.units + price_info.price.nano / 1e9
                    item['price'] = f"{price:.2f} {instrument.currency.upper()}"
                else:
                    item['price'] = "N/A"
    return jsonify(cache)

@app_flask.route('/clear_cache', methods=['POST'])
def clear_cache():
    save_cache([])
    logger.info("Кеш очищен")
    return jsonify({"status": "success", "message": "Кеш очищен"})

@app_flask.route('/order_book/<ticker>', methods=['GET'])
def order_book(ticker):
    try:
        cache = load_cache()
        figi = next((item['figi'] for item in cache if item['ticker'] == ticker.upper()), None)
        if not figi:
            result = find_figi(TOKEN, ticker)
            if "error" in result:
                return jsonify({"error": result["error"]})
            figi = result['figi']
        
        with Client(TOKEN) as client:
            order_book = client.market_data.get_order_book(figi=figi, depth=10)
            return jsonify({
                "figi": order_book.figi,
                "bids": [{"price": f"{bid.price.units + bid.price.nano / 1e9:.2f}", "quantity": bid.quantity} for bid in order_book.bids],
                "asks": [{"price": f"{ask.price.units + ask.price.nano / 1e9:.2f}", "quantity": ask.quantity} for ask in order_book.asks]
            })
    except Exception as e:
        logger.error(f"Ошибка в /order_book: {e}")
        return jsonify({"error": str(e)})

@app_flask.route('/portfolio', methods=['GET'])
def portfolio():
    try:
        with Client(TOKEN) as client:
            portfolio = client.operations.get_portfolio(account_id=ACCOUNT_ID)
            positions = []
            for pos in portfolio.positions:
                price = pos.current_price.units + pos.current_price.nano / 1e9
                quantity = pos.quantity.units + pos.quantity.nano / 1e9
                total_value = price * quantity
                instrument = client.instruments.get_instrument_by(id_type=InstrumentIdType.INSTRUMENT_ID_TYPE_FIGI, id=pos.figi).instrument
                positions.append({
                    "figi": pos.figi,
                    "ticker": instrument.ticker,
                    "name": instrument.name,
                    "quantity": quantity,
                    "price": f"{price:.2f} {pos.current_price.currency.upper()}",
                    "total_value": f"{total_value:.2f} {pos.current_price.currency.upper()}"
                })
            return jsonify({"positions": positions})
    except Exception as e:
        logger.error(f"Ошибка в /portfolio: {e}")
        return jsonify({"error": str(e)})

@app_flask.route('/account_info', methods=['GET'])
def account_info():
    try:
        with Client(TOKEN) as client:
            accounts = client.users.get_accounts().accounts
            account = next((acc for acc in accounts if acc.id == ACCOUNT_ID), None)
            if not account:
                return {"error": "Аккаунт не найден"}
            portfolio = client.operations.get_portfolio(account_id=ACCOUNT_ID)
            balance = 0
            for pos in portfolio.positions:
                price = pos.current_price.units + pos.current_price.nano / 1e9
                quantity = pos.quantity.units + pos.quantity.nano / 1e9
                if pos.current_price.currency == 'rub':
                    balance += price * quantity
            return jsonify({
                "account_id": ACCOUNT_ID,
                "name": account.name if account.name else "Без названия",
                "token_status": "Действителен",
                "balance": f"{balance:.2f} RUB",
                "timezone": "Europe/Moscow"
            })
    except RequestError as e:
        logger.error(f"Ошибка токена в /account_info: {e}")
        return jsonify({"error": f"Ошибка токена: {str(e)}"})
    except Exception as e:
        logger.error(f"Ошибка в /account_info: {e}")
        return jsonify({"error": f"Неизвестная ошибка: {str(e)}"})

@app_flask.route('/start_trading', methods=['POST'])
def start_trading():
    data = request.json
    ticker = data.get('ticker')
    figi = data.get('figi')
    logger.info(f"Запуск trading.py с ticker={ticker}, figi={figi}")
    try:
        subprocess.Popen([sys.executable, os.path.join(os.getcwd(), "trading.py"), ticker, figi])
        return jsonify({"status": "success", "message": "Торговля запущена"})
    except Exception as e:
        logger.error(f"Ошибка при запуске trading.py: {e}")
        return jsonify({"status": "error", "message": str(e)})

@app_flask.route('/close_app', methods=['POST'])
def close_app():
    logger.info("Закрытие приложения")
    QApplication.instance().quit()
    return jsonify({"status": "success", "message": "Приложение закрыто"})

@app_flask.route('/start')
def start():
    return render_template('start.html')

def run_flask():
    app_flask.run(host='127.0.0.1', port=5001, debug=False, use_reloader=False)

class StartWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowFlags(Qt.FramelessWindowHint)
        self.setAttribute(Qt.WA_TranslucentBackground)
        self.setFixedSize(1300, 650)
        
        os.environ["QTWEBENGINE_REMOTE_DEBUGGING"] = "9223"
        
        self.browser = QWebEngineView(self)
        self.browser.setUrl(QUrl("http://127.0.0.1:5001/start"))
        self.setCentralWidget(self.browser)
        self.setWindowTitle("Торговый Бот Тинькофф")

        logger.info("Настройка горячей клавиши F12")
        self.shortcut_f12 = QShortcut(QKeySequence("F12"), self)
        self.shortcut_f12.activated.connect(self.open_dev_tools)
        logger.info("Горячая клавиша F12 настроена")

    def open_dev_tools(self):
        logger.info("Попытка открытия инструментов разработчика на http://localhost:9223")
        try:
            webbrowser.open("http://localhost:9223")
        except Exception as e:
            logger.error(f"Ошибка при открытии инструментов разработчика: {e}")

if __name__ == "__main__":
    load_config()
    
    flask_thread = Thread(target=run_flask, daemon=True)
    flask_thread.start()
    
    app = QApplication(sys.argv)
    window = StartWindow()
    window.show()
    logger.info("Приложение запущено")
    exit_code = app.exec_()
    
    import time
    time.sleep(2)  # Задержка для завершения потоков
    sys.exit(exit_code)