import { createAdaptorServer } from "@hono/node-server";
import { Hono } from "hono";
import { WebSocketServer } from "ws";
import { logger } from "hono/logger";

import chat from "./chat.ts";
import executor from "./executor.ts";

const app = new Hono();

app.use(logger());

app.get("/", (ctx) => ctx.text("Rabi Server"));

app.route("/chat", chat);
app.route("/executor", executor);

const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });
const server = createAdaptorServer({ fetch: app.fetch, websocket: { server: wss } });
const development = process.argv.includes("--dev");
let port = 3000;

server.on("error", (error: NodeJS.ErrnoException) => {
    if (development && error.code === "EADDRINUSE" && port < 3010) {
        console.warn(`端口 ${port} 已占用，尝试 ${port + 1}`);
        port += 1;
        server.listen(port, "127.0.0.1");
        return;
    }
    console.error(`服务启动失败：${error.message}`);
    process.exitCode = 1;
    wss.close();
});

server.on("listening", () => {
    console.log(`Rabi Server: http://127.0.0.1:${port}`);
});

server.listen(port, "127.0.0.1");

function shutdown() {
    console.log("\nShutting down");
    for (const client of wss.clients) {
        client.terminate();
    }
    wss.close();
    server.close();
    console.log("bye");
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
