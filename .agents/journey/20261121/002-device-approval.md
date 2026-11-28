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

2026-11-22 · 区分网页登录与 Executor 的 OAuth 设备授权，统一协议组、路由和服务命名。CLI 继续使用 `rabi login`。Server、Executor 和 Protocol 的源码类型检查及 lint 通过。

2026-11-22 · Server 将网页登录身份查询和设备授权申请分别集中到 `AuthService` 与 `OAuthService`，Executor 统一 OAuth 服务的 Layer 装配。补充集成测试断言，覆盖有效 Cookie 对应的用户 ID 和匿名请求。Server、Executor 类型检查及仓库 lint、格式检查通过，PostgreSQL 集成测试待运行。

2026-11-22 · Server 启动、Drizzle 迁移和 Vitest 统一读取 `apps/server/.env`，保留进程环境变量的优先级。`pnpm build` 通过，已验证三个入口读取配置，Vitest 无需手动导出变量即可收集 PostgreSQL 集成用例。

2026-11-22 · Server 集中声明数据库地址、认证密钥与公开 URL。已验证 Drizzle 从包内 `.env` 读取数据库地址，并遵循进程环境变量的优先级。

2026-11-22 · Server 校验网页请求来源与登录会话后，允许用户按用户码拒绝有效的设备授权。CLI 轮询被拒申请时收到 `access_denied`。Server 类型检查、仓库 lint 和格式检查通过，浏览器与 CLI 联调待验收。

2026-11-24 · Server 允许已登录用户按用户码批准有效申请，并记录会话账号。批准或拒绝后，后续决定返回冲突。使用模拟登录会话的设备授权与 OAuth 测试共 5 项通过，覆盖账号传递、来源校验、未登录、冲突、拒绝轮询与过期边界。`pnpm build` 通过，浏览器联调待验收。

2026-11-26 · 设备授权区分无会话与会话查询故障，分别返回 `401` 与通用 `500`。Server 使用共享 `BaseError` 保留并遮蔽原始原因，HTTP 入口记录一次安全诊断。`pnpm build` 通过，设备授权与 OAuth 测试共 7 项通过。

2026-11-26 · Server 和 Executor 将认证与设备授权失败统一为类型化错误。Server 在 HTTP 入口保留原有响应，等待授权由服务返回状态。Executor 保留 CLI 提示，并验证单次轮询超时后按加倍的间隔重试。`pnpm build` 通过，`pnpm test` 共 17 项通过，包含本地 PostgreSQL 会话集成测试。

2026-11-28 · Web 通过公开授权链接接入邮箱登录和设备确认。使用真实 PostgreSQL 会话的 HTTP 联调验证批准、拒绝及拒绝后的轮询结果，Server 相关 11 项测试通过。仓库构建通过。

2026-11-28 · 确定 Executor 凭据自签发起有效 30 天，新增并发领取验收用例。截至本次提交，两个并发请求均返回 400，与预期的一次成功领取有差异，签发待实现。

2026-11-28 · 设备授权的 PostgreSQL 用例验证登录、批准、拒绝和拒绝后的轮询结果。并发领取验收随凭据签发实现引入。`pnpm test` 共 18 项通过，包含真实 PostgreSQL 集成测试。

2026-11-28 · 保存首次签发接线前的审阅基线，包含本地 Executor 身份密钥、Executor 数据库迁移和注册服务。本地迁移已应用。快照内的 CLI 接线尚未完成，并发签发验收待实现。
