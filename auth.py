import hmac
import hashlib
import json
from urllib.parse import unquote


def validate_init_data(init_data: str, bot_token: str) -> bool:
    parsed = dict(pair.split("=", 1) for pair in init_data.split("&"))
    received_hash = parsed.pop("hash", "")

    data_check = "\n".join(
        f"{k}={unquote(v)}" for k, v in sorted(parsed.items())
    )
    secret = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    computed = hmac.new(secret, data_check.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed, received_hash)


def parse_init_data(init_data: str) -> int:
    parsed = dict(pair.split("=", 1) for pair in init_data.split("&"))
    user_data = json.loads(unquote(parsed["user"]))
    return user_data["id"]
