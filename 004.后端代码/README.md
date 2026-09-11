# 医小知后端

```text
api/                 HTTP / SSE 边界层
  server.py          路由、参数解析、CORS、流转发
core/                可复用业务底层
  config.py          环境变量的统一配置入口
  chat_service.py    医疗助手提示词与上下文处理
  llm_client.py      通用 OpenAI 兼容调用入口
llm/                 Agent 工具层
  tools/             独立工具（示例：weather_tool.py）
  tools_registry.py  工具 schema 与函数注册
  tools_runner.py    tool_calls / observation ReAct 循环
```

切换 DeepSeek、OpenAI、通义千问或其他 OpenAI 兼容服务时，只需修改 `.env.local` 中的
`LLM_BASE_URL`、`LLM_API_KEY` 和 `LLM_MODEL`，无需改动代码。超时、温度、最大输出 token、
扩展请求头和扩展请求体也由配置统一管理。原有 `OPENAI_BASE_URL`、`OPENAI_API_KEY`、
`OPENAI_MODEL` 仍作为兼容别名可用。

启动：

```bash
cp .env.example .env.local
npm start
```

接口：`GET /health`、`POST /api/chat`。`stream: true` 时原样转发 OpenAI 兼容 SSE 数据流。

```json
{
  "history": [{ "role": "user", "content": "上一轮问题" }],
  "context": { "page": "医疗百科问答", "userName": "用户" },
  "message": { "role": "user", "content": "本轮问题" },
  "stream": false
}
```

`core/chat_service.py` 会对 history 做角色白名单、文本清洗、连续角色合并、最近 N 轮截断及总字符预算控制，再与 context 和当前 message 共同组装 Prompt。

普通 JSON 请求会启用 Agent 工具层。例如询问“上海今天天气怎么样”，模型会调用
`get_weather`，服务端执行工具并将 observation 回填给模型后返回最终回答。天气数据来自免密的
Open-Meteo API。明确的天气、气温、降雨、风速或湿度问题会固定路由到天气工具，避免部分
兼容模型在 `tool_choice=auto` 时跳过工具。流式请求仍保持原有 SSE 直连模式。
