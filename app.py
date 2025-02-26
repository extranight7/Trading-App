# /app.py
import sys
import os
import subprocess
import logging
import webbrowser
from PyQt5.QtWidgets import QApplication, QMainWindow, QShortcut
from PyQt5.QtWebEngineWidgets import QWebEngineView
from PyQt5.QtCore import QUrl, Qt, pyqtSignal, QObject, QPoint
from PyQt5.QtGui import QKeySequence
from flask import Flask, render_template, request, jsonify
from threading import Thread
from tinkoff.invest import Client, RequestError
from dotenv import load_dotenv

# Настройка логирования
logging.basicConfig(level=logging.DEBUG)
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)  # Отключаем логирование Flask

# Инициализация Flask
app = Flask(__name__)

# Глобальные переменные
TOKEN = None
ACCOUNT_ID = None

# Путь к .env файлу
ENV_FILE = os.path.join(os.getcwd(), ".env")

# Класс для связи между Flask и PyQt5
class Communicator(QObject):
    close_signal = pyqtSignal()

communicator = Communicator()

# Функция проверки токена и получения Account ID
def check_tinkoff_credentials(token: str) -> str:
    try:
        with Client(token) as client:
            user_service = client.users
            accounts = user_service.get_accounts().accounts
            if not accounts:
                raise ValueError("Нет доступных аккаунтов")
            account_id = accounts[0].id
            return account_id
    except RequestError as e:
        raise Exception(f"Ошибка при проверке токена: {e}")
    except Exception as e:
        raise Exception(f"Неизвестная ошибка: {e}")

# Маршруты Flask

@app.route('/')
def index():
    """Главная страница с формой ввода токена"""
    return render_template('index.html')

@app.route('/check_token', methods=['POST'])
def check_token():
    """Проверка токена"""
    global TOKEN, ACCOUNT_ID
    token = request.json.get('token')
    
    try:
        account_id = check_tinkoff_credentials(token)
        TOKEN = token
        ACCOUNT_ID = account_id

        # Сохраняем токен в .env файл
        with open(ENV_FILE, "w") as f:
            f.write(f"TINKOFF_TOKEN={TOKEN}\n")
            f.write(f"ACCOUNT_ID={ACCOUNT_ID}\n")
            logging.info("Токен и Account ID успешно сохранены в файле .env.")

        # Запускаем start.py и закрываем текущее окно
        subprocess.Popen([sys.executable, os.path.join(os.getcwd(), "start.py")], shell=True)
        communicator.close_signal.emit()

        return jsonify({
            'status': 'success',
            'message': 'Токен действителен. Бот запущен.',
            'account_id': account_id,
            'alert_type': 'success'
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e),
            'alert_type': 'danger'
        })

@app.route('/close', methods=['POST'])
def close_app():
    """Закрытие приложения"""
    communicator.close_signal.emit()
    return jsonify({'status': 'success'})

def run_flask():
    """Запуск Flask-сервера"""
    app.run(host='127.0.0.1', port=5000, debug=False, use_reloader=False)

# Основное окно PyQt5

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        
        # Убираем стандартные границы окна и делаем фон прозрачным
        self.setWindowFlags(Qt.FramelessWindowHint)
        self.setAttribute(Qt.WA_TranslucentBackground)
        
        # Устанавливаем заголовок окна
        self.setWindowTitle("Торговый Бот Тинькофф")
        
        # Фиксированный размер окна
        self.setFixedSize(1000, 520)
        
        # Включаем удаленную отладку
        os.environ["QTWEBENGINE_REMOTE_DEBUGGING"] = "9222"
        
        # Создаем браузер
        self.browser = QWebEngineView(self)
        self.browser.setUrl(QUrl("http://127.0.0.1:5000/"))
        self.setCentralWidget(self.browser)
        
        # Подключаем сигналы
        communicator.close_signal.connect(self.close)
    
    def open_dev_tools(self):
        """Открытие инструментов разработчика в системном браузере"""
        webbrowser.open("http://localhost:9222")

# Проверка наличия .env файла и токена

if not os.path.exists(ENV_FILE):
    logging.warning("Файл .env не найден. Создание нового...")
else:
    # Загрузка переменных окружения
    load_dotenv()

    # Получение токена и ACCOUNT_ID из .env
    TOKEN = os.getenv("TINKOFF_TOKEN")
    ACCOUNT_ID = os.getenv("ACCOUNT_ID")

    if TOKEN and ACCOUNT_ID:
        try:
            # Проверяем валидность токена
            with Client(TOKEN) as client:
                user_service = client.users
                accounts = user_service.get_accounts().accounts
                if ACCOUNT_ID in [acc.id for acc in accounts]:
                    logging.info("Токен и Account ID валидны. Запуск start.py...")
                    subprocess.Popen([sys.executable, os.path.join(os.getcwd(), "start.py")], shell=True)
                    sys.exit(0)  # Завершаем работу main.py
                else:
                    logging.warning("Account ID из .env недействителен. Пользователь должен повторно ввести токен.")
        except Exception as e:
            logging.error(f"Ошибка при проверке токена из .env: {e}")
            TOKEN = None
            ACCOUNT_ID = None

# Запуск приложения

if __name__ == '__main__':
    # Запуск Flask в отдельном потоке
    flask_thread = Thread(target=run_flask)
    flask_thread.daemon = True
    flask_thread.start()
    
    # Запуск PyQt5 приложения
    qt_app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(qt_app.exec_())