"""Application configuration loaded from environment variables."""

from __future__ import annotations

import json
import os
from pathlib import Path
from dataclasses import dataclass, field
from typing import Any


def _load_local_env() -> None:
    """Load the backend .env.local without overriding process variables."""
    env_file = Path(__file__).resolve().parents[1] / ".env.local"
    if not env_file.is_file():
        return
    for raw_line in env_file.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip()
        if value[:1] == value[-1:] and value[:1] in {'"', "'"}:
            value = value[1:-1]
        if key:
            os.environ.setdefault(key, value)


_load_local_env()


def _optional_int(name: str) -> int | None:
    value = os.getenv(name, "").strip()
    return int(value) if value else None


def _json_object(name: str) -> dict[str, Any]:
    value = os.getenv(name, "").strip()
    if not value:
        return {}
    parsed = json.loads(value)
    if not isinstance(parsed, dict):
        raise ValueError(f"{name} 必须是 JSON 对象")
    return parsed


@dataclass(frozen=True)
class LLMConfig:
    """Configuration shared by every OpenAI-compatible provider."""

    api_key: str = ""
    base_url: str = "https://api.openai.com/v1"
    model: str = ""
    temperature: float = 0.6
    max_tokens: int | None = None
    timeout: float = 60.0
    extra_headers: dict[str, str] = field(default_factory=dict)
    extra_body: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_env(cls) -> "LLMConfig":
        # OPENAI_* aliases preserve compatibility with existing deployments.
        return cls(
            api_key=os.getenv("LLM_API_KEY", os.getenv("OPENAI_API_KEY", "")).strip(),
            base_url=os.getenv(
                "LLM_BASE_URL", os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
            ).strip(),
            model=os.getenv("LLM_MODEL", os.getenv("OPENAI_MODEL", "")).strip(),
            temperature=float(os.getenv("LLM_TEMPERATURE", "0.6")),
            max_tokens=_optional_int("LLM_MAX_TOKENS"),
            timeout=float(os.getenv("LLM_TIMEOUT", "60")),
            extra_headers={str(k): str(v) for k, v in _json_object("LLM_EXTRA_HEADERS").items()},
            extra_body=_json_object("LLM_EXTRA_BODY"),
        )

    def validate(self) -> None:
        if not self.api_key:
            raise ValueError("服务端尚未配置 LLM_API_KEY")
        if not self.base_url:
            raise ValueError("服务端尚未配置 LLM_BASE_URL")
        if not self.model:
            raise ValueError("服务端尚未配置 LLM_MODEL")
        if self.timeout <= 0:
            raise ValueError("LLM_TIMEOUT 必须大于 0")


@dataclass(frozen=True)
class AppConfig:
    port: int = 3002
    context_turns: int = 6

    @classmethod
    def from_env(cls) -> "AppConfig":
        return cls(
            port=int(os.getenv("PORT", "3002")),
            context_turns=max(1, int(os.getenv("LLM_CONTEXT_TURNS", "6"))),
        )
