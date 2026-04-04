import aiosqlite
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import Application, CommandHandler, ContextTypes
from config import TELEGRAM_TOKEN, BASE_URL, ADMIN_TELEGRAM_ID
from db import is_paused, set_paused


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if user_id == ADMIN_TELEGRAM_ID:
        conn: aiosqlite.Connection = context.bot_data["db_conn"]
        paused = await is_paused(conn)
        status = "На паузе" if paused else "Активна"
        text = f"Панель преподавателя:\nПрактика: {status}"
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("Результаты", web_app=WebAppInfo(url=BASE_URL + "/admin.html"))],
            [InlineKeyboardButton("Пройти как студент", web_app=WebAppInfo(url=BASE_URL))],
        ])
    else:
        text = (
            "Практика: Бизнес-задачи сайтов\n\n"
            "Нажмите кнопку ниже, чтобы открыть задание:"
        )
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("Начать практику", web_app=WebAppInfo(url=BASE_URL))],
        ])
    await update.message.reply_text(text, reply_markup=keyboard)


async def pause(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_TELEGRAM_ID:
        return
    conn: aiosqlite.Connection = context.bot_data["db_conn"]
    await set_paused(conn, True)
    await update.message.reply_text("Практика поставлена на паузу. Новые студенты не смогут начать.")


async def resume(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_TELEGRAM_ID:
        return
    conn: aiosqlite.Connection = context.bot_data["db_conn"]
    await set_paused(conn, False)
    await update.message.reply_text("Практика возобновлена. Новые студенты могут начинать.")


CONGRATS_TEXT = (
    "🎉🎉🎉\n\n"
    "<b>Поздравляю!</b>\n\n"
    "Ваша практическая работа проверена.\n\n"
    "🏆 <b>Ваш результат: 20 из 20 баллов</b>\n\n"
    "Вы продемонстрировали глубокое понимание фреймворка, "
    "качественный анализ и зрелое маркетинговое мышление.\n\n"
    "Так держать!"
)


WINNERS_TG_IDS = [
    # МДК01
    1328375923,   # Ермакова Виктория
    595358714,    # Лаврищева Валентина
    966042469,    # Гресева Вероника
    1008353515,   # Стукалов Степан
    804574288,    # Трунова Мария
    761871223,    # Большакова Елизавета
    1024138321,   # Сизова Дарья
    # МДК02
    849193316,    # Чечель Ирина
    976931751,    # Белова Дарья
    889527411,    # Садовничая Арина
    746467112,    # Арслангареева Карина
    1052024215,   # Шевалкина Татьяна
    946609480,    # Ополонец Мария
    618726927,    # Панов Глеб
    1029533605,   # Очередниченко Мария
    # МДК03
    879730759,    # Третьякова Алина
    1622597675,   # Шайдуллин Арсений
    994659127,    # Иванова Анастасия
    911027699,    # Калиновская Ульяна
    1133681626,   # Собакова Валерия
    5994024429,   # Молоканова Елизавета
    920793904,    # Наумов Александр
    591051029,    # Щокало Ангелина
    1073118773,   # Шейкина Анастасия
    1080593197,   # Сидоркина Елизавета
]


async def congrats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_TELEGRAM_ID:
        return
    await context.bot.send_message(
        chat_id=ADMIN_TELEGRAM_ID,
        text=CONGRATS_TEXT,
        parse_mode="HTML",
    )
    await update.message.reply_text("Тестовое сообщение отправлено тебе.")


async def send_results(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_TELEGRAM_ID:
        return
    sent = 0
    failed = 0
    for tg_id in WINNERS_TG_IDS:
        try:
            await context.bot.send_message(
                chat_id=tg_id,
                text=CONGRATS_TEXT,
                parse_mode="HTML",
            )
            sent += 1
        except Exception as e:
            failed += 1
    await update.message.reply_text(
        f"Рассылка завершена.\nОтправлено: {sent}\nНе удалось: {failed}"
    )


def create_bot(conn: aiosqlite.Connection) -> Application:
    app = Application.builder().token(TELEGRAM_TOKEN).build()
    app.bot_data["db_conn"] = conn
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("pause", pause))
    app.add_handler(CommandHandler("resume", resume))
    app.add_handler(CommandHandler("congrats", congrats))
    app.add_handler(CommandHandler("send_results", send_results))
    return app
