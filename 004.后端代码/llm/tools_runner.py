"""Minimal ReAct loop using OpenAI-compatible native tool calls."""

from __future__ import annotations

import json
import re
from collections.abc import Callable, Iterable, Mapping
from typing import Any

from core.llm_client import create_completion

from .tools_registry import run_tool, tool_definitions

WEATHER_INTENT = re.compile(r"天气|气温|温度|下雨|降雨|风速|湿度")


def _first_tool_choice(messages: list[dict[str, Any]]) -> str | dict[str, Any]:
    """Force reliable routing for explicit weather queries; keep all else automatic."""
    user_text = next(
        (str(item.get("content", "")) for item in reversed(messages) if item.get("role") == "user"),
        "",
    )
    if WEATHER_INTENT.search(user_text):
        return {"type": "function", "function": {"name": "get_weather"}}
    return "auto"


def _weather_response(response: dict[str, Any], data: dict[str, Any]) -> dict[str, Any]:
    """Render tool data deterministically so provider formatting cannot leak into the UI."""
    city = data.get("city") or "当地"
    weather = data.get("weather") or "天气状况未知"
    temperature = data.get("temperature_c")
    feels_like = data.get("feels_like_c")
    humidity = data.get("humidity_percent")
    wind = data.get("wind_speed_kmh")
    observed_at = str(data.get("observed_at") or "").replace("T", " ")
    temperature_text = f"，{temperature}℃" if temperature is not None else ""
    feels_text = f"（体感 {feels_like}℃）" if feels_like is not None else ""
    detail = " · ".join(
        item
        for item in (
            f"湿度 {humidity}%" if humidity is not None else "",
            f"风速 {wind} km/h" if wind is not None else "",
        )
        if item
    )
    lines = [f"{city}当前{weather}{temperature_text}{feels_text}"]
    if detail:
        lines.append(detail)
    if observed_at:
        lines.append(f"数据时间：{observed_at}")
    if temperature is not None and temperature >= 35:
        tip = "高温时减少正午外出并及时补水；出现头晕、恶心等中暑表现应尽快转移到阴凉处。"
    elif temperature is not None and temperature <= 5:
        tip = "低温时注意保暖，心脑血管或呼吸系统疾病人群外出需加强防护。"
    elif humidity is not None and humidity >= 80:
        tip = "湿度较高，体感可能闷热；适量补水并保持室内通风。"
    elif humidity is not None and humidity <= 30:
        tip = "空气较干燥，注意补水和皮肤保湿，鼻咽不适者可适当增加室内湿度。"
    elif any(word in str(weather) for word in ("雨", "雪")):
        tip = "雨雪天气路面湿滑，老年人和行动不便者外出注意防滑。"
    elif "晴" in str(weather):
        tip = "晴天外出注意防晒；长时间户外活动应适时补水。"
    else:
        tip = "天气变化时注意及时增减衣物，慢性病人群按医嘱做好日常管理。"
    lines.append(f"健康提示：{tip}")
    return {
        **response,
        "choices": [
            {
                "index": 0,
                "finish_reason": "stop",
                "message": {"role": "assistant", "content": "\n".join(lines)},
            }
        ],
    }


def run_react(
    messages: Iterable[Mapping[str, Any]],
    *,
    max_steps: int = 4,
    completion: Callable[..., dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Ask the model, execute requested actions, and feed observations back."""
    call_llm = completion or create_completion
    conversation = [dict(message) for message in messages]

    for step in range(max_steps):
        tool_choice = _first_tool_choice(conversation) if step == 0 else "auto"
        response = call_llm(conversation, tools=tool_definitions(), tool_choice=tool_choice)
        message = response["choices"][0]["message"]
        tool_calls = message.get("tool_calls") or []
        if not tool_calls:
            return response

        conversation.append(message)
        weather_data = None
        for tool_call in tool_calls:
            function = tool_call.get("function", {})
            try:
                arguments = json.loads(function.get("arguments") or "{}")
                data = run_tool(function.get("name", ""), arguments)
                observation = {"ok": True, "data": data}
                if function.get("name") == "get_weather" and isinstance(data, dict):
                    weather_data = data
            except Exception as error:
                observation = {"ok": False, "error": str(error) or "工具执行失败"}
            conversation.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call.get("id", ""),
                    "content": json.dumps(observation, ensure_ascii=False),
                }
            )

        if weather_data is not None:
            return _weather_response(response, weather_data)

    # 达到上限后禁止继续调用工具，要求模型基于已有 observation 收束回答。
    return call_llm(conversation, tools=tool_definitions(), tool_choice="none")
