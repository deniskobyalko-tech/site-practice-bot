from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import Application, CommandHandler, ContextTypes
from config import TELEGRAM_TOKEN, BASE_URL, ADMIN_TELEGRAM_ID


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if user_id == ADMIN_TELEGRAM_ID:
        text = "Панель преподавателя:"
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


def create_bot() -> Application:
    app = Application.builder().token(TELEGRAM_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    return app
