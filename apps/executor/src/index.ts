import { toolRequestSchema } from "protocol";

const socket = new WebSocket(process.env.SERVER_URL ?? "ws://127.0.0.1:3000/executor");

const timeout = setTimeout(() => {
    console.error("等待 Server 确认超时");
    process.exitCode = 1;
    socket.close();
}, 10000);

socket.addEventListener("open", () => {
    console.log("已连接 Server，发送 hello");
    socket.send("hello");
});

function rejectRequest() {
    console.error("Server 返回了无效的工具请求");
    process.exitCode = 1;
    socket.close(1008, "Invalid tool request");
}

socket.addEventListener("message", (event) => {
    if (event.data === "connected") {
        clearTimeout(timeout);
        console.log("Server: connected");
        return;
    }
    try {
        if (typeof event.data !== "string" || event.data.length > 1024) {
            rejectRequest();
            return;
        }
        const data: unknown = JSON.parse(event.data);
        const request = toolRequestSchema.safeParse(data);
        if (!request.success) {
            rejectRequest();
            return;
        }
        const time = new Date().toISOString();
        socket.send(JSON.stringify({ id: request.data.id, time }));
        console.log(`执行 get_current_time (${request.data.id}): ${time}`);
    } catch {
        rejectRequest();
    }
});

socket.addEventListener("error", () => {
    clearTimeout(timeout);
    console.error("无法连接 Server 或连接发生错误");
    process.exitCode = 1;
});

socket.addEventListener("close", (event) => {
    clearTimeout(timeout);
    console.log(`与 Server 的连接已关闭 (${event.code})`);
    if (event.code !== 1000 && event.code !== 1001) {
        process.exitCode = 1;
    }
});

process.once("SIGINT", () => socket.close(1000, "Executor shutting down"));
process.once("SIGTERM", () => socket.close(1000, "Executor shutting down"));
