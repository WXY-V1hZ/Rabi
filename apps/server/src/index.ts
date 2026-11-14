import { createModels } from "@earendil-works/pi-ai";
import { deepseekProvider } from "@earendil-works/pi-ai/providers/deepseek";
import { Agent } from "@earendil-works/pi-agent-core";

if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error("请设置 DEEPSEEK_API_KEY");
}

const models = createModels();
models.setProvider(deepseekProvider());

const model = models.getModel("deepseek", "deepseek-flash");

if (!model) {
    throw new Error("未找到 DeepSeek 模型");
}

const agent = new Agent({
    initialState: {
        systemPrompt: "你是 Rabi 的编程助手，请用中文简洁回答。",
        model,
        thinkingLevel: "off",
    },
    streamFn: models.streamSimple.bind(models),
});

const unsubscribe = agent.subscribe((event) => {
    if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
        process.stdout.write(event.assistantMessageEvent.delta);
    }
});

try {
    await agent.prompt("你好，请用一句话介绍你能做什么。");

    if (agent.state.errorMessage) {
        throw new Error(agent.state.errorMessage);
    }

    console.log();
} finally {
    unsubscribe();
}
