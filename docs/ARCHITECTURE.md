# 架构设计

本文记录 Rabi 的目标架构与技术选型，不代表相关功能或依赖迁移已实现；候选项明确标注，实际安装版本以各包配置与锁文件为准。

## 系统组成

| 部分                 | 职责                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| Client（交互客户端） | 接收用户输入，展示会话、进度与结果，提供取消和审批等操作；首个实现为 Web UI，也可扩展为 TUI、Qt GUI 等 |
| Server（服务端）     | 校验身份与权限，管理会话和运行状态，推进 Agent Loop，调度工具执行                                      |
| Executor（执行端）   | 主动连接 Server，在本地授权的工作目录和工具范围内执行请求并返回结果                                    |

Web 前端静态资源与 Server 部署在云端，用户通过网址访问，前端界面在浏览器中运行。Executor 留在开发机，操作本地仓库与工具链；三者是逻辑职责，可独立部署，也可由同一程序承载。

Web 通过 HTTPS 向 Server 提交操作和查询，通过 SSE 接收运行事件；Executor 通过主动建立的 WSS 交换工具请求和结果。各入口分别校验身份与权限，Executor 还需校验服务端身份并落实本地执行授权。

浏览器关闭不影响已发起任务的推进。

Server 初期作为常驻的模块化单体部署，在进程内划分账号、会话、运行调度、Executor 连接和事件分发模块。数据库池归属于应用生命周期；HTTP 请求、事件订阅、Executor 连接与 Agent 运行各有独立的生命周期，结束请求或订阅不隐式取消运行。

## 模块文档

各包的 `AGENTS.md` 记录模块设计约束，不代表相关功能已实现。修改模块或跨模块交互前，阅读对应文档。

| 包                                                  | 设计内容                                        |
| --------------------------------------------------- | ----------------------------------------------- |
| [apps/server](../apps/server/AGENTS.md)             | 身份与连接管理、Agent 运行、任务调度及断线恢复  |
| [apps/executor](../apps/executor/AGENTS.md)         | CLI 与 daemon、本地凭据、服务生命周期及工具执行 |
| [apps/web](../apps/web/AGENTS.md)                   | Executor 选择、会话操作与运行状态展示           |
| [packages/protocol](../packages/protocol/AGENTS.md) | 跨端消息、运行时校验、调用关联及共享错误基类    |

## 跨模块约定

每个 Executor 实例具有稳定的 `executorId`，初期只归属一个账号，不支持跨账号共享。同一设备可以运行多个独立注册的 Executor。注册记录长期保留，断线只改变在线状态，重连沿用原身份。

用户从本地完成账号绑定与执行范围授权后，同账号下的 Client 才能看到和选用该 Executor。每个 Executor 使用独立、可撤销的连接凭据，`executorId` 仅用于标识；连接凭据与 Client 的用户登录凭据分开。

Executor 由 CLI 和 daemon 组成。CLI 负责发起 OAuth 设备授权、绑定 Executor 和管理本地配置。daemon 负责连接 Server 与执行工具，由平台服务管理器托管并配置开机自启。两者以对应的本地用户身份运行。凭据检查、绑定后启动及多实例配置规则见 [Executor 设计](../apps/executor/AGENTS.md)。

Server 通过已有 WSS 双向连接下发工具请求并接收结果，无需主动连接私人设备。连接使用 Ping/Pong 心跳与断线重连；同一 `executorId` 同时只有一条有效连接。Client 选用 Executor 表示绑定已有执行端，不触发新的物理连接；Client 关闭不影响 daemon 的连接。

用户创建会话时选择 Executor，初期会话固定绑定一个 Executor，不支持中途切换或离线时自动切换。跨终端访问同一会话时，执行环境保持不变。多个会话复用同一条 Executor 连接，请求与结果通过会话、运行和工具调用标识区分归属。

一个 Executor 支持多个会话并发运行。初期不同工作目录可并发，同一工作目录已有运行时，后一个运行提示冲突，不自动排队或创建 worktree。工作目录限制用于减少并发修改冲突，不提供完整的资源隔离。

Executor 离线时暂停相关调度，已下发工具调用的状态由 Server 与 Executor 核对。连接接管或断线本身均不能证明调用失败或停止，也不能据此自动重新执行。具体连接接管与恢复规则见 [Server 设计](../apps/server/AGENTS.md)。

## 技术栈

| 层次           | 选型                                 | 职责                                          |
| -------------- | ------------------------------------ | --------------------------------------------- |
| 开发语言       | TypeScript 严格模式                  | 统一浏览器、云端与本地执行器的开发语言        |
| 工程组织       | pnpm workspace                       | 管理应用与共享协议包                          |
| 运行时         | Node.js 24 LTS                       | 运行 Server 与 Executor                       |
| 前端           | React + Vite SPA                     | 构建跨终端访问的 Web 界面                     |
| 前端配套候选   | TanStack Router + TanStack Query     | 页面路由、服务端数据获取与缓存，待确认        |
| 后端与执行模型 | Effect 4 + Effect HTTP / HttpApi     | HTTP 契约、业务操作、依赖、并发与资源生命周期 |
| 运行时校验     | Effect Schema                        | 校验、编解码并推导跨端类型                    |
| 账号认证候选   | Better Auth                          | 注册、登录、会话与第三方身份关联，待确认      |
| Agent 运行内核 | pi-agent-core + pi-ai                | 复用 Agent Loop、工具接口与模型接入           |
| 数据库         | PostgreSQL 18                        | 持久保存账号、会话、运行和工具调用等业务数据  |
| 数据访问与迁移 | Drizzle ORM + Drizzle Kit            | 数据库模型、查询、事务与迁移                  |
| 验证           | Vitest + @effect/vitest + Playwright | 业务、异步生命周期与端到端验证                |
| 云端部署       | Linux + Docker Compose + Caddy       | 常驻服务、数据库、HTTPS 与反向代理            |

### 选择理由与使用范围

**TypeScript 与共享契约。** HTTP 契约、运行事件与 Executor 消息集中在 `packages/protocol`，使用 Effect Schema 推导类型并完成运行时校验；HTTP 接口通过 HttpApi 描述。数据库模型、Pi 内部类型和服务端依赖不作为跨端协议，不为同一协议重复维护 Zod 定义。

**Effect。** Server 采用 Effect HTTP 替代 Hono；Server 与 Executor 的业务操作统一使用 Effect 表达预期错误、依赖、取消与资源管理，在明确入口通过服务与 Layer 装配。第三方 Promise、回调和取消接口在适配边界连接；包装为 Effect 不自动提供底层取消、幂等性或跨进程恢复。Schema 校验负责数据形状，业务模块校验权限与状态转换。

**前端与账号候选。** TanStack Router 负责 URL 与页面匹配，TanStack Query 管理服务端数据的获取、缓存和失效；仍为 React SPA。Better Auth 是部署在 Rabi Server 内的认证库，账号数据留在 Rabi 数据库中。候选的使用范围与确认状态见对应模块文档；不因选用其中一个组件而引入整套生态。

**pi-agent-core + pi-ai。** 复用模型调用与基础 Loop，由 Rabi 提供远程工具实现，并管理持久化、执行器通信和故障恢复。Pi 的运行接口通过适配层接入 Effect，不为统一执行模型重写 Agent Loop；任务状态与去重仍由 Rabi 明确设计。

**PostgreSQL + Drizzle。** 关系模型表达账号、会话、运行、工具调用和设备之间的关联及一致性约束。Drizzle 查询通过兼容的 Effect 原生接口或适配层执行，事务边界由业务操作明确；认证库按其数据库适配接口单独接入，不假定 Effect 原生数据库对象与 Promise 接口可互换。数据库模型留在后端，迁移文件纳入版本管理并审查生成的 SQL。

**通信。** Web 的操作和查询使用 HTTP，进度与运行事件通过 SSE 推送；Executor 使用 WSS 双向通信。事件补发、工具去重与结果核对依赖持久化及业务协议，SSE 或 WebSocket 重连本身不保证恢复。OAuth 与认证库端点保持其标准请求、响应语义。

### 版本、运行环境与待定事项

当前方案使用 Effect 4 正式版本线，不沿用参考仓库的 beta.70。HTTP 等部分模块仍标为 `unstable`，API 可能在次版本或补丁版本变更；使用精确版本和锁文件，升级时核对同版本文档、类型及发行说明，并验证协议、取消、连接释放和集成行为。Effect 3 是可评估的替代版本线，不在业务中混用两代 API。

云端采用常驻 Node.js 服务，初期单实例部署；本地 daemon 首先以 Linux systemd 托管，其他平台服务适配后续扩展。参考项目中的 Cloudflare 绑定、请求级数据库池和 Worker 入口不作为本项目运行约定。

TanStack 与 Better Auth 是否采用、Drizzle 驱动及各依赖的兼容版本组合、具体协议、设备授权接口与令牌生命周期、心跳和超时参数、状态核对与事件补发策略仍待确认或设计。Effect 4 与 Drizzle、认证库等组合须经集成验证；文档选型不代表当前依赖已迁移或兼容性已验证。

### 参考

- [Effect 4 与稳定性说明](https://effect.website/blog/releases/effect/40)、[HttpApi](https://effect.website/docs/v4/api/effect/http-api/HttpApi)
- [TanStack Router](https://tanstack.com/router/latest/docs/framework/react/overview)、[TanStack Query](https://tanstack.com/query/latest/docs/framework/react/overview)
- [Better Auth](https://better-auth.com/docs/introduction)与[设备授权](https://better-auth.com/docs/plugins/device-authorization)
- [Pi Agent Core](https://github.com/earendil-works/pi/tree/main/packages/agent)与[Pi AI](https://github.com/earendil-works/pi/tree/main/packages/ai)
- [Drizzle：Effect PostgreSQL 接入](https://orm.drizzle.team/docs/connect-effect-postgres)
