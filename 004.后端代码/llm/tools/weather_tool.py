"""Weather query tool backed by the key-free Open-Meteo API."""

from __future__ import annotations

import json
from urllib.parse import urlencode
from urllib.request import urlopen

WEATHER_TOOL = {
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "查询指定城市的当前天气",
        "parameters": {
            "type": "object",
            "properties": {"city": {"type": "string", "description": "城市名称，如上海"}},
            "required": ["city"],
            "additionalProperties": False,
        },
    },
}

WEATHER_CODES = {
    0: "晴",
    1: "大部晴朗",
    2: "局部多云",
    3: "阴",
    45: "雾",
    48: "雾凇",
    51: "小毛毛雨",
    53: "毛毛雨",
    55: "强毛毛雨",
    61: "小雨",
    63: "中雨",
    65: "大雨",
    71: "小雪",
    73: "中雪",
    75: "大雪",
    80: "小阵雨",
    81: "阵雨",
    82: "强阵雨",
    95: "雷暴",
}


def _get_json(url: str) -> dict:
    with urlopen(url, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def get_weather(city: str) -> dict:
    """Return current weather for a city."""
    city = str(city).strip()
    if not city or len(city) > 80:
        raise ValueError("city 必须是 1-80 个字符的城市名称")

    places = _get_json(
        "https://geocoding-api.open-meteo.com/v1/search?"
        + urlencode({"name": city, "count": 1, "language": "zh", "format": "json"})
    ).get("results", [])
    if not places:
        raise ValueError(f"未找到城市：{city}")

    place = places[0]
    current = _get_json(
        "https://api.open-meteo.com/v1/forecast?"
        + urlencode(
            {
                "latitude": place["latitude"],
                "longitude": place["longitude"],
                "current": "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m",
                "timezone": "auto",
            }
        )
    )["current"]
    return {
        "city": place.get("name", city),
        "country": place.get("country", ""),
        "weather": WEATHER_CODES.get(current.get("weather_code"), "未知"),
        "temperature_c": current.get("temperature_2m"),
        "feels_like_c": current.get("apparent_temperature"),
        "humidity_percent": current.get("relative_humidity_2m"),
        "wind_speed_kmh": current.get("wind_speed_10m"),
        "observed_at": current.get("time"),
    }
