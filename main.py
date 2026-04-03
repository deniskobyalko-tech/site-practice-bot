import asyncio
import os
import uvicorn
from fastapi.staticfiles import StaticFiles
from config import TELEGRAM_TOKEN, ADMIN_TELEGRAM_ID, DATABASE_PATH
from db import get_connection, seed_sites
from seeds import SITES
from api import create_app
from bot import create_bot


async def main():
    conn = await get_connection(DATABASE_PATH)
    await seed_sites(conn, SITES)

    fastapi_app = create_app(conn, bot_token=TELEGRAM_TOKEN, admin_telegram_id=ADMIN_TELEGRAM_ID)

    # Mount static files for Mini App
    webapp_dir = os.path.join(os.path.dirname(__file__), "webapp")
    fastapi_app.mount("/", StaticFiles(directory=webapp_dir, html=True), name="webapp")

    # Run FastAPI in background
    config = uvicorn.Config(fastapi_app, host="0.0.0.0", port=8080, log_level="info")
    server = uvicorn.Server(config)
    api_task = asyncio.create_task(server.serve())

    # Run bot
    bot_app = create_bot()
    async with bot_app:
        await bot_app.start()
        # Pass bot instance to FastAPI for completion notifications
        fastapi_app.state.bot = bot_app.bot
        await bot_app.updater.start_polling()
        print("Bot started. Press Ctrl+C to stop.")
        try:
            await asyncio.Event().wait()
        except (KeyboardInterrupt, SystemExit):
            pass
        finally:
            await bot_app.updater.stop()
            await bot_app.stop()
            server.should_exit = True
            await api_task
            await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
