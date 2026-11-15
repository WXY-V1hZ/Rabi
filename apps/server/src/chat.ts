import { Agent } from "@earendil-works/pi-agent-core";
import { createModels } from "@earendil-works/pi-ai";
import { deepseekProvider } from "@earendil-works/pi-ai/providers/deepseek";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { getCurrentTime } from "./executor.ts";

const app = new Hono();
const models = createModels();
models.setProvider(deepseekProvider());
// 当前只有一个 Executor，且只接受一个待处理工具调用；暂时串行处理聊天请求。
let busy = false;
const messageSchema = z.string().trim().min(1, "消息不能为空").max(16000, "消息过长");

app.post("/", bodyLimit({ maxSize: 16000 }), async (ctx) => {
    const result = messageSchema.safeParse(await ctx.req.text());
    if (!result.success) {
        return ctx.text(result.error.issues[0]?.message ?? "消息格式不正确", 400);
    }
    const text = result.data;
    if (busy) {
        return ctx.text("正在处理消息，请稍后再试", 503);
    }
    if (!process.env.DEEPSEEK_API_KEY) {
        return ctx.text("服务端尚未配置 DeepSeek API Key", 503);
    }

    const model = models.getModel("deepseek", "deepseek-flash");
    if (!model) {
        return ctx.text("服务端未找到 DeepSeek 模型", 503);
    }

    // 每个请求创建独立上下文；会话接续后续再实现。
    const agent = new Agent({
        initialState: {
            systemPrompt:
                "你是 Rabi 的编程助手，请用中文简洁回答。查询当前时间时必须调用 get_current_time，不要猜测；工具失败时如实说明。",
            model,
            thinkingLevel: "off",
            tools: [
                {
                    name: "get_current_time",
                    label: "获取执行设备时间",
                    description: "读取 Executor 所在设备的当前时间，返回带时区的 ISO 时间。",
                    parameters: { type: "object", properties: {}, additionalProperties: false },
                    execute: async (_callId, _params, signal) => ({
                        content: [{ type: "text", text: await getCurrentTime(signal) }],
                        details: undefined,
                    }),
                },
            ],
        },
        toolExecution: "sequential",
        streamFn: (model, context, options) =>
            models.streamSimple(model, context, { ...options, maxTokens: 1024 }),
    });

    busy = true;
    const timeout = setTimeout(() => agent.abort(), 120000);
    try {
        await agent.prompt(text);
        // 工具调用会产生中间 assistant 消息，取最后一条作为本轮回复。
        const message = agent.state.messages.findLast((message) => message.role === "assistant");
        if (message?.role === "assistant" && message.stopReason === "aborted") {
            return ctx.text("模型响应超时", 504);
        }
        if (agent.state.errorMessage || message?.role !== "assistant") {
            return ctx.text("模型请求失败", 502);
        }

        const reply = message.content
            .filter((block) => block.type === "text")
            .map((block) => block.text)
            .join("");
        if (!reply.trim()) {
            return ctx.text("模型未返回正文", 502);
        }
        return ctx.text(reply);
    } catch {
        return ctx.text("模型请求失败", 502);
    } finally {
        clearTimeout(timeout);
        busy = false;
    }
});

export default app;
