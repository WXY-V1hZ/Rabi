import { upgradeWebSocket } from "@hono/node-server";
import { Hono } from "hono";
import type { WSContext } from "hono/ws";

const app = new Hono();
let executor: WSContext | undefined;
const pending = new Map<string, (result: string | Error) => void>();

export function getCurrentTime(signal?: AbortSignal): Promise<string> {
    const socket = executor;
    if (!socket || socket.readyState !== 1) {
        return Promise.reject(new Error("Executor 未连接"));
    }
    if (signal?.aborted) {
        return Promise.reject(new Error("工具调用已取消"));
    }
    if (pending.size >= 1) {
        return Promise.reject(new Error("Executor 正忙"));
    }

    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
        const finish = (result: string | Error) => {
            clearTimeout(timeout);
            signal?.removeEventListener("abort", onAbort);
            pending.delete(id);
            if (result instanceof Error) reject(result);
            else resolve(result);
        };
        const onAbort = () => finish(new Error("工具调用已取消"));
        const timeout = setTimeout(() => finish(new Error("工具调用超时")), 10000);
        pending.set(id, finish);
        signal?.addEventListener("abort", onAbort, { once: true });
        try {
            console.log(`请求 Executor 执行 get_current_time (${id})`);
            socket.send(JSON.stringify({ id, tool: "get_current_time" }));
        } catch {
            finish(new Error("无法发送工具请求"));
        }
    });
}

function disconnect(socket: WSContext) {
    if (executor !== socket) return;
    executor = undefined;
    for (const finish of pending.values()) {
        finish(new Error("Executor 连接已断开"));
    }
}

app.get(
    "/",
    upgradeWebSocket(() => ({
        onOpen() {
            console.log("Executor 已连接");
        },
        onMessage(event, ws) {
            if (event.data === "hello") {
                if (executor && executor !== ws) {
                    ws.close(1008, "Executor already connected");
                    return;
                }
                executor = ws;
                ws.send("connected");
                return;
            }
            if (executor !== ws || typeof event.data !== "string") {
                ws.close(1008, "Expected hello or tool result");
                return;
            }
            try {
                const result: unknown = JSON.parse(event.data);
                if (
                    typeof result !== "object" ||
                    result === null ||
                    !("id" in result) ||
                    typeof result.id !== "string" ||
                    result.id.length > 128 ||
                    !("time" in result) ||
                    typeof result.time !== "string" ||
                    result.time.length > 64 ||
                    !Number.isFinite(Date.parse(result.time))
                ) {
                    ws.close(1008, "Invalid tool result");
                    return;
                }
                pending.get(result.id)?.(result.time);
            } catch {
                ws.close(1008, "Invalid JSON");
            }
        },
        onClose(_event, ws) {
            disconnect(ws);
            console.log("Executor 已断开");
        },
        onError(_event, ws) {
            disconnect(ws);
            ws.close(1011, "Connection error");
            console.error("Executor 连接发生错误");
        },
    })),
);

export default app;
