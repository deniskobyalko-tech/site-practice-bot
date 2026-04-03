import hmac
import hashlib
from urllib.parse import quote
import pytest
from auth import validate_init_data, parse_init_data

BOT_TOKEN = "test-token-123:ABC"


def make_init_data(data_dict: dict, token: str) -> str:
    data_check = "\n".join(
        f"{k}={v}" for k, v in sorted(data_dict.items()) if k != "hash"
    )
    secret = hmac.new(b"WebAppData", token.encode(), hashlib.sha256).digest()
    hash_val = hmac.new(secret, data_check.encode(), hashlib.sha256).hexdigest()
    parts = [f"{k}={quote(str(v))}" for k, v in data_dict.items()]
    parts.append(f"hash={hash_val}")
    return "&".join(parts)


def test_valid_init_data():
    data = {"user": '{"id":123,"first_name":"Test"}', "auth_date": "1234567890"}
    init_data = make_init_data(data, BOT_TOKEN)
    result = validate_init_data(init_data, BOT_TOKEN)
    assert result is True


def test_invalid_hash():
    init_data = "user=%7B%22id%22%3A123%7D&auth_date=123&hash=invalidhash"
    result = validate_init_data(init_data, BOT_TOKEN)
    assert result is False


def test_parse_telegram_id():
    data = {"user": '{"id":456,"first_name":"Bob"}', "auth_date": "1234567890"}
    init_data = make_init_data(data, BOT_TOKEN)
    telegram_id = parse_init_data(init_data)
    assert telegram_id == 456
