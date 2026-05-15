import aiosqlite
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import Application, CommandHandler, MessageHandler, ContextTypes, filters
from config import TELEGRAM_TOKEN, BASE_URL, ADMIN_TELEGRAM_ID
from db import is_paused, set_paused, add_to_whitelist


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
            [InlineKeyboardButton("Практика на пару 16.05", web_app=WebAppInfo(url=BASE_URL + "/express.html"))],
            [InlineKeyboardButton("Пройти тест по метрикам", web_app=WebAppInfo(url=BASE_URL + "/quiz.html"))],
            [InlineKeyboardButton("Тренажёр метрик", web_app=WebAppInfo(url=BASE_URL + "/metrics.html"))],
        ])
    else:
        conn: aiosqlite.Connection = context.bot_data["db_conn"]
        paused = await is_paused(conn)
        if paused:
            text = "Бот отдыхает 😴\nОсновная практика временно закрыта.\n\nДоступны:"
            keyboard = InlineKeyboardMarkup([
                [InlineKeyboardButton("Практика на пару 16.05", web_app=WebAppInfo(url=BASE_URL + "/express.html"))],
                [InlineKeyboardButton("Тренажёр метрик", web_app=WebAppInfo(url=BASE_URL + "/metrics.html"))],
            ])
        else:
            text = "Практика: Метрики сайта\n\nВыбери что открыть:"
            keyboard = InlineKeyboardMarkup([
                [InlineKeyboardButton("Пройти практику", web_app=WebAppInfo(url=BASE_URL))],
                [InlineKeyboardButton("Практика на пару 16.05", web_app=WebAppInfo(url=BASE_URL + "/express.html"))],
                [InlineKeyboardButton("Пройти тест по метрикам", web_app=WebAppInfo(url=BASE_URL + "/quiz.html"))],
                [InlineKeyboardButton("Тренажёр метрик", web_app=WebAppInfo(url=BASE_URL + "/metrics.html"))],
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
    # МДК04
    815080383,    # Разживина Ирина
    191439014,    # Богородицкая Ольга
    993070247,    # Иманова Алина
    1109039695,   # Казанова Анна
    1286615308,   # Козлова Софья
    858990589,    # Проскурина Мария
    798891633,    # Киселев Александр
    908826694,    # Мусатов Андрей
    1126073677,   # Пепеляева Софья
    5177823459,   # лабадина александра
    1056135259,   # Гурьева Карина
    1175867847,   # Захарина Елизавета
    953066674,    # Лазаренко Вероника
    810383432,    # Лысенкова Олеся
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


async def allow(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_TELEGRAM_ID:
        return
    if not context.args:
        await update.message.reply_text("Использование: /allow <telegram_id>")
        return
    try:
        tg_id = int(context.args[0])
    except ValueError:
        await update.message.reply_text("ID должен быть числом.")
        return
    conn: aiosqlite.Connection = context.bot_data["db_conn"]
    await add_to_whitelist(conn, tg_id)
    await update.message.reply_text(f"Пользователь {tg_id} добавлен в белый список. Может проходить практику.")


async def reset_tests(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_TELEGRAM_ID:
        return
    if not context.args:
        await update.message.reply_text("Использование: /reset_tests <telegram_id>")
        return
    try:
        tg_id = int(context.args[0])
    except ValueError:
        await update.message.reply_text("ID должен быть числом.")
        return
    conn: aiosqlite.Connection = context.bot_data["db_conn"]
    cursor = await conn.execute(
        "SELECT id, name, group_name FROM students WHERE telegram_id = ?", (tg_id,)
    )
    row = await cursor.fetchone()
    if not row:
        await update.message.reply_text(f"Студент с telegram_id {tg_id} не найден.")
        return
    student_id, name, group_name = row[0], row[1], row[2]
    await conn.execute("DELETE FROM express_submissions WHERE student_id = ?", (student_id,))
    await conn.execute("DELETE FROM submissions WHERE student_id = ?", (student_id,))
    await conn.execute("DELETE FROM quiz_submissions WHERE student_id = ?", (student_id,))
    await conn.commit()
    await update.message.reply_text(
        f"Тесты сброшены для {name} ({group_name}, tg_id={tg_id}).\n"
        f"Студент может пройти все практики заново."
    )


async def fallback_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id == ADMIN_TELEGRAM_ID:
        return
    await update.message.reply_text("Бот отдыхает 😴\nНе нужно его беспокоить!")


def create_bot(conn: aiosqlite.Connection) -> Application:
    app = Application.builder().token(TELEGRAM_TOKEN).build()
    app.bot_data["db_conn"] = conn
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("pause", pause))
    app.add_handler(CommandHandler("resume", resume))
    app.add_handler(CommandHandler("congrats", congrats))
    app.add_handler(CommandHandler("send_results", send_results))
    app.add_handler(CommandHandler("allow", allow))
    app.add_handler(CommandHandler("reset_tests", reset_tests))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, fallback_message))
    return app
