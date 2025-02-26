import logging
from tinkoff.invest import Client, RequestError, InstrumentIdType

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def find_figi(token: str, ticker: str) -> dict:
    try:
        with Client(token) as client:
            instruments = client.instruments.find_instrument(query=ticker).instruments
            if instruments:
                instrument_short = instruments[0]
                # Дополнительный запрос для получения полной информации
                instrument_full = client.instruments.get_instrument_by(
                    id_type=InstrumentIdType.INSTRUMENT_ID_TYPE_FIGI,
                    id=instrument_short.figi
                ).instrument
                logger.info(f"Найден инструмент: {instrument_short.ticker} - {instrument_short.name}")
                return {
                    "figi": instrument_short.figi,
                    "ticker": instrument_short.ticker,
                    "name": instrument_short.name,
                    "currency": instrument_full.currency
                }
            logger.warning(f"Инструмент с тикером '{ticker}' не найден")
            return {"error": f"Инструмент с тикером '{ticker}' не найден"}
    except RequestError as e:
        logger.error(f"Ошибка API при поиске инструмента: {e}")
        return {"error": f"Ошибка API: {str(e)}"}
    except Exception as e:
        logger.error(f"Неизвестная ошибка при поиске инструмента: {e}")
        return {"error": f"Неизвестная ошибка: {str(e)}"}

if __name__ == "__main__":
    import os
    from dotenv import load_dotenv

    load_dotenv()
    token = os.getenv("TINKOFF_TOKEN")
    if not token:
        logger.error("Токен не найден в .env файле")
        exit(1)

    result = find_figi(token, "VKCO")
    print(result)