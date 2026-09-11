"""Prompt construction for the medical assistant."""

from __future__ import annotations

import re
from typing import Any

from .config import AppConfig
from .llm_client import create_completion
from llm.tools_runner import run_react

SYSTEM_PROMPT = """你是医小知，一名可信、严谨、易懂的医疗百科助手。提供健康科普，不替代医生诊断；遇到急症风险时明确建议立即就医。
回答规范：
1. 先给结论，再补充必要信息；简单问题控制在 3-5 行。
2. 默认使用短段落或项目列表，禁止使用 Markdown 表格。
3. 不重复用户称呼或问题，不写“随时问我”等客套收尾。
4. Emoji 最多使用 1 个；避免过度加粗、标题堆叠和装饰性符号。
5. 工具查询应忠实呈现结果；可补充一条与结果直接相关、简短且有依据的健康科普。"""
MAX_MESSAGE_CHARS = 4000
MAX_CONTEXT_CHARS = 3000
MAX_PROMPT_CHARS = 24000


def _clean_text(value: Any, limit: int) -> str:
    text = re.sub(r"<think>[\s\S]*?</think>\s*", "", str(value or ""))
    return re.sub(r"\s+", " ", text).strip()[:limit]


def normalize_history(history: Any) -> list[dict[str, str]]:
    if not isinstance(history, list):
        return []
    result: list[dict[str, str]] = []
    for item in history:
        if not isinstance(item, dict) or item.get("role") not in {"user", "assistant"}:
            continue
        content = _clean_text(item.get("content"), MAX_MESSAGE_CHARS)
        if not content:
            continue
        if result and result[-1]["role"] == item["role"]:
            result[-1]["content"] = _clean_text(
                f'{result[-1]["content"]}\n{content}', MAX_MESSAGE_CHARS
            )
        else:
            result.append({"role": item["role"], "content": content})
    return result


def _recent_turns(history: list[dict[str, str]], turns: int) -> list[dict[str, str]]:
    users = 0
    start = len(history)
    while start > 0 and users < turns:
        start -= 1
        users += history[start]["role"] == "user"
    return history[start:]


def _normalize_context(context: Any) -> str:
    if not isinstance(context, dict):
        return ""
    lines = []
    for key, value in context.items():
        if isinstance(value, (str, int, float, bool)):
            line = f"{_clean_text(key, 40)}：{_clean_text(value, 500)}"
            if not line.endswith("："):
                lines.append(line)
    return "\n".join(lines)[:MAX_CONTEXT_CHARS]


def build_prompt_messages(payload: dict[str, Any]) -> list[dict[str, str]]:
    message = payload.get("message") or {}
    current = _clean_text(message.get("content"), MAX_MESSAGE_CHARS)
    if not current:
        raise ValueError("message.content 不能为空")
    context = _normalize_context(payload.get("context"))
    system = SYSTEM_PROMPT
    if context:
        system += f"\n\n以下是本次请求的业务上下文，仅作为回答参考：\n{context}"
    prompt = [
        {"role": "system", "content": system},
        *_recent_turns(normalize_history(payload.get("history")), AppConfig.from_env().context_turns),
        {"role": "user", "content": current},
    ]
    while len(prompt) > 2 and sum(len(item["content"]) for item in prompt) > MAX_PROMPT_CHARS:
        prompt.pop(1)
    return prompt


def chat(payload: dict[str, Any], *, stream: bool = False) -> Any:
    messages = build_prompt_messages(payload)
    # 工具调用需要在服务端完成多轮 observation 回填；原始 SSE 模式维持直连兼容。
    return create_completion(messages, stream=True) if stream else run_react(messages)
