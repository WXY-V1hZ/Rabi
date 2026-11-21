# 001 · 让 Executor 连接本地 Server

## 目标

让 `rabi login` 通过 HTTP 向本地 Server 申请设备授权，并按 Server 提供的有效期等待授权。

## 起点

Server 已支持申请待确认的设备码，并在轮询时返回待确认或过期结果。Executor 登录仍使用模拟 HTTP 响应。

## 验收条件

- 启动本地 Server 后，运行 `pnpm rabi login`，CLI 展示该 Server 签发的授权网址和用户码。
- 申请保持待确认直到到期时，CLI 提示授权已过期并以非零状态退出。

## 提交记录

暂无。
