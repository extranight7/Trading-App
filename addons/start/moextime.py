from datetime import datetime, timedelta
import pytz
import logging
from tinkoff.invest import Client, RequestError, TradingSchedule

# Настройка логирования
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class MOEXTime:
    def __init__(self, token: str):
        """
        Инициализация класса MOEXTime.
        :param token: API-токен Тинькофф Инвестиций.
        """
        self.token = token
        self.moscow_tz = pytz.timezone('Europe/Moscow')
        self.exchange = "MOEX"  # Код биржи MOEX в Tinkoff API

    def get_current_time(self) -> datetime:
        """
        Получение текущего локального времени с учетом часового пояса Москвы.
        :return: Время в формате datetime с временной зоной UTC+3 (Московское время).
        """
        try:
            current_time = datetime.now(self.moscow_tz)
            logger.info(f"Получено текущее время: {current_time}")
            return current_time
        except Exception as e:
            logger.error(f"Ошибка при получении времени: {e}")
            raise

    def get_trading_schedule(self, from_time: datetime, to_time: datetime) -> list[TradingSchedule]:
        """
        Получение расписания торгов с Tinkoff API.
        :param from_time: Начало периода.
        :param to_time: Конец периода.
        :return: Список объектов TradingSchedule.
        """
        try:
            with Client(self.token) as client:
                schedules = client.instruments.trading_schedules(
                    exchange=self.exchange,
                    from_=from_time,
                    to=to_time
                ).exchanges
                if not schedules:
                    logger.warning(f"Расписание для {self.exchange} не найдено")
                return schedules
        except RequestError as e:
            if e.code == '30003':  # Ошибка "from can't be less than the current date"
                logger.warning(f"Ошибка 30003: from_time ({from_time}) раньше текущей даты сервера. Используем текущее время.")
                return self.get_trading_schedule(datetime.now(self.moscow_tz), to_time)
            logger.error(f"Ошибка API при получении расписания: {e}")
            raise
        except Exception as e:
            logger.error(f"Неизвестная ошибка при получении расписания: {e}")
            raise

    def get_trading_status(self) -> dict:
        """
        Получение статуса торгов на бирже MOEX.
        :return: Словарь с информацией о статусе торгов и времени до следующего события.
        """
        try:
            # Получаем текущее время
            now = self.get_current_time()
            logger.debug(f"Текущее время: {now}")

            # Запрашиваем расписание с текущего момента до конца следующего дня
            day_end = now + timedelta(days=1)
            schedules = self.get_trading_schedule(now, day_end)

            if not schedules or not schedules[0].days:
                return {
                    "status": "closed",
                    "message": "Расписание торгов недоступно",
                    "time_until_next_event": 0,
                    "next_event": "Неизвестно"
                }

            trading_day = schedules[0].days[0]  # Берем первый день из расписания
            logger.debug(f"Расписание торгов: {trading_day}")

            # Проверяем, является ли день торговым
            if trading_day.is_trading_day:
                sessions = [
                    (trading_day.start_time.astimezone(self.moscow_tz), trading_day.end_time.astimezone(self.moscow_tz))
                ]
                # Проверяем текущую сессию
                for session_start, session_end in sessions:
                    if session_start <= now < session_end:
                        time_until_close = (session_end - now).total_seconds()
                        return {
                            "status": "open",
                            "message": "Биржа открыта",
                            "time_until_next_event": int(time_until_close),
                            "next_event": f"Закрытие сессии в {session_end.strftime('%H:%M')}"
                        }

                # Если не в сессии, ищем следующее событие
                next_event_time = None
                if now < sessions[0][0]:
                    next_event_time = sessions[0][0]
                    event_name = "Открытие сессии"
                else:
                    # Проверяем следующий торговый день
                    next_day_start = now + timedelta(days=1)
                    next_schedules = self.get_trading_schedule(next_day_start, next_day_start + timedelta(days=1))
                    if next_schedules and next_schedules[0].days and next_schedules[0].days[0].is_trading_day:
                        next_event_time = next_schedules[0].days[0].start_time.astimezone(self.moscow_tz)
                        event_name = "Открытие следующей сессии"
                    else:
                        return {
                            "status": "closed",
                            "message": "Биржа закрыта, следующий торговый день неизвестен",
                            "time_until_next_event": 0,
                            "next_event": "Неизвестно"
                        }

                time_until_next_event = (next_event_time - now).total_seconds()
                return {
                    "status": "closed",
                    "message": "Биржа закрыта",
                    "time_until_next_event": int(time_until_next_event),
                    "next_event": f"{event_name} в {next_event_time.strftime('%H:%M %d.%m.%Y')}"
                }
            else:
                # День не торговый (выходной или праздник), ищем следующий торговый день
                next_day = now + timedelta(days=1)
                for _ in range(7):  # Проверяем до недели вперед
                    next_schedules = self.get_trading_schedule(next_day, next_day + timedelta(days=1))
                    if next_schedules and next_schedules[0].days and next_schedules[0].days[0].is_trading_day:
                        next_start = next_schedules[0].days[0].start_time.astimezone(self.moscow_tz)
                        time_until_next_event = (next_start - now).total_seconds()
                        return {
                            "status": "closed",
                            "message": "Биржа закрыта (выходной или праздник)",
                            "time_until_next_event": int(time_until_next_event),
                            "next_event": f"Открытие сессии в {next_start.strftime('%H:%M %d.%m.%Y')}"
                        }
                    next_day += timedelta(days=1)
                return {
                    "status": "closed",
                    "message": "Биржа закрыта, следующий торговый день не найден",
                    "time_until_next_event": 0,
                    "next_event": "Неизвестно"
                }

        except Exception as e:
            logger.error(f"Ошибка в get_trading_status: {e}")
            return {
                "status": "error",
                "message": f"Ошибка: {str(e)}",
                "time_until_next_event": 0,
                "next_event": "Неизвестно"
            }

if __name__ == "__main__":
    import os
    from dotenv import load_dotenv

    load_dotenv()
    token = os.getenv("TINKOFF_TOKEN")
    if not token:
        logger.error("Токен не найден в .env файле")
        exit(1)

    moex = MOEXTime(token)
    status = moex.get_trading_status()
    print(status)