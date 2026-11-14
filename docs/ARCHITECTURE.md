# 架构设计

本文记录 Rabi 已确定的技术选型及其理由。目前仅覆盖技术栈，不代表相关依赖已安装或功能已实现。

## 技术栈

| 层次           | 选型                  | 职责                                                  |
| -------------- | --------------------- | ----------------------------------------------------- |
| 开发语言       | TypeScript            | 统一浏览器、云端与本地执行器的开发语言                |
| 工程组织       | pnpm workspace        | 管理应用与共享协议包，沿用现有 monorepo 结构          |
| 前端           | React + Vite          | 沿用现有基础，构建跨终端访问的 Web 界面               |
| 后端框架       | Hono                  | HTTP 路由、中间件及网络入口处理                       |
| 运行时校验     | Zod                   | 校验外部数据，并从 Schema 推导 TypeScript 类型        |
| Agent 运行内核 | pi-agent-core + pi-ai | 复用 Agent Loop、工具执行接口、运行事件与模型接入能力 |
| 数据库         | PostgreSQL            | 持久保存会话、运行和工具调用等业务数据                |
| 数据访问       | Drizzle ORM           | 定义数据库模型，编写类型化查询与事务                  |
| 数据库迁移     | Drizzle Kit           | 生成和管理数据库迁移                                  |

### 选择理由与使用范围

**TypeScript 全栈。** 共享协议集中在 `packages/protocol`，由 Zod Schema 推导类型，减少三端各自维护消息定义造成的不一致。类型检查不能替代运行时校验；数据库模型、Pi 内部类型和应用实现不直接作为跨端协议。

**Hono + Zod。** Hono 的路由和中间件组织方式简洁，符合当前项目规模；业务逻辑通过普通 TypeScript 模块组织。HTTP 输入可通过 `@hono/zod-validator` 接入 Zod；连接建立后的消息和配置等外部数据也需在各自入口校验。Schema 校验负责数据形状与约束，身份、资源权限和状态转换是否合法由业务逻辑判断。

**pi-agent-core + pi-ai。** 复用模型调用与基础 Loop，由 Rabi 提供远程工具实现，并管理持久化、执行器通信和故障恢复。Pi 的内存状态与事件接口不等于持久化任务引擎。先通过包依赖集成，确有接口限制时再评估修改上游源码。

**PostgreSQL + Drizzle。** 会话、运行、工具调用和设备之间具有明确关联，关系型存储便于表达这些关系及一致性约束。Drizzle 的查询方式接近 SQL，便于明确事务与条件更新；数据库约束和业务逻辑共同保证数据一致性，ORM 类型检查不能代替它们。数据库模型留在后端，网络协议独立定义。迁移文件纳入版本管理并审查生成的 SQL。

### 运行环境与待定事项

当前服务端与执行器工程以 Node.js 为运行基础。Hono 可以适配不同运行时，但部署平台尚未确定；部署到 Cloudflare Workers 仍需验证 Pi 及模型 Provider 的兼容性，并设计后台任务生命周期和连接协调。

数据库驱动、具体依赖版本、通信协议、鉴权方案和任务调度机制待后续设计确定。安装依赖时核对运行版本与包之间的兼容性。技术选型本身不保证断线接续、执行去重或跨进程恢复，这些能力需要独立设计与验证。

### 参考

- [Hono：Node.js 运行方式](https://hono.dev/docs/getting-started/nodejs)与[输入校验](https://hono.dev/docs/guides/validation)
- [Zod：Schema 与类型推导](https://zod.dev/)
- [Pi Agent Core](https://github.com/earendil-works/pi/tree/main/packages/agent)与[Pi AI](https://github.com/earendil-works/pi/tree/main/packages/ai)
- [Drizzle：PostgreSQL 接入](https://orm.drizzle.team/docs/get-started-postgresql)
