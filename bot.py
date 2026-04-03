from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import Application, CommandHandler, ContextTypes
from config import TELEGRAM_TOKEN, BASE_URL, ADMIN_TELEGRAM_ID


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if user_id == ADMIN_TELEGRAM_ID:
        webapp_url = BASE_URL + "/admin.html"
        text = "Панель преподавателя:"
        btn_text = "Открыть результаты"
    else:
        webapp_url = BASE_URL
        text = (
            "Практика: Бизнес-задачи сайтов\n\n"
            "Нажмите кнопку ниже, чтобы открыть задание:"
        )
        btn_text = "Начать практику"

    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton(btn_text, web_app=WebAppInfo(url=webapp_url))],
    ])
    await update.message.reply_text(text, reply_markup=keyboard)


def create_bot() -> Application:
    app = Application.builder().token(TELEGRAM_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    return app
