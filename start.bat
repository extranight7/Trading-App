@echo off
REM Установка кодировки UTF-8 для корректного отображения символов
chcp 65001 > nul

REM Запуск основного скрипта Python
python app.py

REM Ожидание нажатия клавиши перед закрытием окна
pause