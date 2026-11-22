# 002 · 在浏览器确认设备授权

## 目标

让已登录的 Rabi 用户通过 CLI 展示的授权网址和用户码找到申请，并明确批准或拒绝。前置条件是 Server 能从网页登录会话识别当前登录的 Rabi 账号。

## 验收条件

- 已登录用户输入有效用户码并明确批准后，Server 为对应申请记录批准结果与当前账号。
- 用户拒绝后，对应的 CLI 轮询得到拒绝结果。过期申请无法批准。

## 提交记录

2026-11-22 · Server 接入 Better Auth 的邮箱注册、登录和会话查询接口，使用内存适配器进行本地验证。`pnpm build` 通过。

2026-11-22 · Server 将 Better Auth 的账号与会话存储切换到 PostgreSQL，提供本地 Compose 配置和 `pnpm --filter server db:migrate` 迁移入口。用户已确认本地库有四张认证表，`pnpm build` 通过。原会话 Cookie 在 Server 重启后能否继续识别同一账号，待验收。

2026-11-22 · Server 从配置读取数据库地址、签名密钥和认证公开地址。真实 PostgreSQL 集成测试验证重新创建认证路由和连接池后，原会话 Cookie 仍能查询同一账号。Server 两项测试通过。
