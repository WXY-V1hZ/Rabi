# Server 设计约束

本文件记录已确定的设计，按任务逐步实现。身份、会话绑定和并发约定见[全局架构](../../docs/ARCHITECTURE.md#跨模块约定)。

## 目录结构

- `src/index.ts` 装配服务和 Layer，并启动 HTTP Server。`src/handlers/` 放 HTTP 处理器和路由适配，每个模块公开装配所需的处理器 Layer。
- `src/handlers/auth.ts` 接入用户认证，`src/handlers/oauth.ts` 适配设备授权的 OAuth 端点。授权申请及其状态由 `src/services/OAuthService.ts` 管理。
- `src/auth/` 放认证配置和可供运行时与工具共用的认证代码。
- `src/db/schema/` 放 Drizzle 表、索引和关系定义。包根目录的 `db/` 放数据库工具配置与迁移文件。

## 程序组织与资源生命周期

- HTTP 入口采用 Effect HTTP，业务操作表达为 Effect。HTTP 契约与跨端 Schema 从 `packages/protocol` 引用。
- 数据库池及运行管理器属于应用作用域；请求、SSE 订阅、Executor 连接和 Agent 运行分别管理作用域。HTTP 请求或浏览器订阅结束不取消已发起的运行，取消由显式业务操作处理。
- 数据库模型、事务及数据访问服务留在 Server 内部；按业务操作划定事务，数据库失败不转换为成功空结果。连接池随应用关闭释放，不照搬 Worker 的每请求建池方式。
- Pi 的 Promise、事件和取消接口通过适配层接入；传播取消并清理监听器，预期错误与程序缺陷分别处理。Effect 内存任务不替代运行持久化与恢复协议。

## 账号与设备授权

- Rabi 维护自己的账号体系，Executor、会话等资源归属于 Rabi 的 `userId`。GitHub 可作为登录／注册选项，具体接入后续设计，不作为 Executor 绑定的前提。
- Better Auth 为账号认证候选，具体采用待确认；若采用，将其标准 Request/Response 处理器及数据库适配封装在认证边界内，管理注册、登录与会话，Rabi 负责资源归属和业务权限。
- Server 承担 Rabi 设备授权服务器的职责，云端提供申请授权、网页确认和领取令牌的接口；协议遵循 [RFC 8628](https://www.rfc-editor.org/rfc/rfc8628.html)，字段与凭据语义见[共享协议](../../packages/protocol/AGENTS.md#设备授权)。
- 若采用 Better Auth，优先评估 OAuth Provider 与 Device Authorization 集成签发限定权限和资源范围的 access token；不能将独立设备插件返回的用户 session token 直接用作 Executor 专用凭据。逐实例绑定与撤销仍需 Rabi 实现并验证。
- 临时授权申请在创建时尚未归属账号；Server 校验网页登录身份与明确的批准操作后，才能确定绑定的 Rabi 用户。已登录用户可直接确认，未登录用户先完成 Rabi 登录，登录方式对 CLI 透明。
- 用户批准后，为对应 Executor 建立账号归属并签发独立、可撤销的专用凭据。网页登录会话与 Executor 凭据分别管理，退出网页登录不隐式撤销 Executor 授权。
- 本地开发的设备授权契约见 [`RabiApi`](../../packages/protocol/src/http/index.ts)。对外端点路径、申请有效期、账号登录方式、Executor 凭据有效期及续期策略待定。

## 身份与连接管理

- 分别校验 Client 与 Executor 身份，以及其对会话、运行和执行器的访问权限。Server 管理账号归属、Executor 注册记录和独立连接凭据；用户解绑时使对应凭据与当前连接失效，其他 Executor 不受影响。
- 按 `executorId` 维护当前有效连接。新连接认证成功后接管旧连接，仅向当前连接下发新请求；旧连接关闭或迟到消息不得清除或覆盖新连接状态，工具结果仍需校验调用归属。
- 将连接接管通知旧端，使其停止自动重连；接管不代表原工具调用停止，其执行状态独立核对。Executor 侧生命周期见 [Executor 设计](../executor/AGENTS.md#服务与连接生命周期)。

## 调度与恢复

- Server 推进 Agent Loop、管理持久化与调度，远程工具实现通过绑定的 Executor 执行。Pi 的内存状态不替代会话、运行和工具调用的持久化记录。
- 通过 SSE 向同账号的 Web 客户端发布已授权的运行事件；浏览器重连后的补发与去重策略单独设计，事件订阅不拥有运行的生命周期。
- Executor 离线时不启动依赖它的新运行；运行中断线时，暂停向它下发新工具调用。
- 断线不直接判定已下发调用失败，也不自动重新执行。重连后先核对原调用状态，确认结果后再继续；超过等待期限仍无法确认时，显示“执行结果未知”，由用户处理。初期不承诺自动恢复所有执行状态。
- 连接可用性、运行状态与工具调用状态分别管理；等待超时与迟到结果的处理须保持调用归属一致。
- 状态核对协议、等待期限及调度实现待定，沿用全局技术选型。
