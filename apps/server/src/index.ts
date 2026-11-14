import { Agent } from "@earendil-works/pi-agent-core";
import { createModels } from "@earendil-works/pi-ai";
import { deepseekProvider } from "@earendil-works/pi-ai/providers/deepseek";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";

const app = new Hono();
const models = createModels();
models.setProvider(deepseekProvider());
let busy = false;

app.get("/", (c) => c.text("Rabi Server"));

app.post("/chat", bodyLimit({ maxSize: 16000 }), async (c) => {
    const text = (await c.req.text()).trim();
    if (!text) {
        return c.text("消息不能为空", 400);
    }
    if (busy) {
        return c.text("正在处理消息，请稍后再试", 503);
    }
    if (!process.env.DEEPSEEK_API_KEY) {
        return c.text("服务端尚未配置 DeepSeek API Key", 503);
    }

    const model = models.getModel("deepseek", "deepseek-flash");
    if (!model) {
        return c.text("服务端未找到 DeepSeek 模型", 503);
    }

    // 每个请求创建独立上下文；会话接续后续再实现。
    const agent = new Agent({
        initialState: {
            systemPrompt: "你是 Rabi 的编程助手，请用中文简洁回答。",
            model,
            thinkingLevel: "off",
        },
        streamFn: (model, context, options) =>
            models.streamSimple(model, context, { ...options, maxTokens: 1024 }),
    });

    busy = true;
    const timeout = setTimeout(() => agent.abort(), 120000);
    try {
        await agent.prompt(text);
        const message = agent.state.messages.findLast((message) => message.role === "assistant");
        if (message?.role === "assistant" && message.stopReason === "aborted") {
            return c.text("模型响应超时", 504);
        }
        if (agent.state.errorMessage || message?.role !== "assistant") {
            return c.text("模型请求失败", 502);
        }

        const reply = message.content
            .filter((block) => block.type === "text")
            .map((block) => block.text)
            .join("");
        if (!reply.trim()) {
            return c.text("模型未返回正文", 502);
        }
        return c.text(reply);
    } catch {
        return c.text("模型请求失败", 502);
    } finally {
        clearTimeout(timeout);
        busy = false;
    }
});

const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 3000 }, (info) => {
    console.log(`Rabi Server: http://127.0.0.1:${info.port}`);
});

process.once("SIGINT", () => server.close());
process.once("SIGTERM", () => server.close());
