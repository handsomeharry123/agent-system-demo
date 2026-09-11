"""Central tool schema and callable registry."""

from __future__ import annotations

from typing import Any

from .tools.weather_tool import WEATHER_TOOL, get_weather

TOOLS = {"get_weather": (WEATHER_TOOL, get_weather)}


def tool_definitions() -> list[dict[str, Any]]:
    return [schema for schema, _ in TOOLS.values()]


def run_tool(name: str, arguments: dict[str, Any]) -> Any:
    if name not in TOOLS:
        raise ValueError(f"未注册的工具：{name}")
    if not isinstance(arguments, dict):
        raise ValueError("工具参数必须是 JSON 对象")
    return TOOLS[name][1](**arguments)
