import os
from dotenv import load_dotenv

load_dotenv()

TELEGRAM_TOKEN = os.environ["TELEGRAM_TOKEN"]
ADMIN_TELEGRAM_ID = int(os.environ["ADMIN_TELEGRAM_ID"])
BASE_URL = os.environ["BASE_URL"]
DATABASE_PATH = os.environ.get("DATABASE_PATH", "data/practice.db")

GROUPS = ["МДК01", "МДК02", "МДК03", "МДК04"]
