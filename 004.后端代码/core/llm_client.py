"""Provider-neutral client for OpenAI-compatible Chat Completions APIs."""

from __future__ import annotations

import json
from collections.abc import Iterable, Mapping
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .config import LLMConfig


class LLMClientError(RuntimeError):
    """Raised when configuration, transport, or the upstream API fails."""


class LLMClient:
    def __init__(self, config: LLMConfig | None = None) -> None:
        self.config = config or LLMConfig.from_env()

    @property
    def endpoint(self) -> str:
        return f"{self.config.base_url.rstrip('/')}/chat/completions"

    def create_completion(
        self,
        messages: Iterable[Mapping[str, Any]],
        *,
        stream: bool = False,
        **overrides: Any,
    ) -> dict[str, Any] | Any:
        """Create a completion; streaming calls return the upstream byte response."""
        try:
            self.config.validate()
        except (TypeError, ValueError) as error:
            raise LLMClientError(str(error)) from error

        body: dict[str, Any] = {
            **self.config.extra_body,
            "model": self.config.model,
            "messages": list(messages),
            "stream": stream,
            "temperature": self.config.temperature,
        }
        if self.config.max_tokens is not None:
            body["max_tokens"] = self.config.max_tokens
        body.update({key: value for key, value in overrides.items() if value is not None})

        headers = {
            "Content-Type": "application/json",
            "Accept": "text/event-stream" if stream else "application/json",
            "Authorization": f"Bearer {self.config.api_key}",
            **self.config.extra_headers,
        }
        request = Request(
            self.endpoint,
            data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        try:
            response = urlopen(request, timeout=self.config.timeout)
            if stream:
                return response
            with response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace").strip()
            raise LLMClientError(detail or f"LLM 接口返回 {error.code}") from error
        except (URLError, TimeoutError) as error:
            reason = getattr(error, "reason", error)
            raise LLMClientError(f"无法连接 LLM 接口：{reason}") from error
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise LLMClientError("LLM 接口返回了无效 JSON") from error


def create_completion(
    messages: Iterable[Mapping[str, Any]], *, stream: bool = False, **overrides: Any
) -> dict[str, Any] | Any:
    """Convenience entry point using the current environment configuration."""
    return LLMClient().create_completion(messages, stream=stream, **overrides)
