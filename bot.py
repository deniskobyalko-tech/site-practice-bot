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


def create_bot(conn: aiosqlite.Connection) -> Application:
    app = Application.builder().token(TELEGRAM_TOKEN).build()
    app.bot_data["db_conn"] = conn
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("pause", pause))
    app.add_handler(CommandHandler("resume", resume))
    return app
