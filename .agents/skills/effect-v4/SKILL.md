---
name: effect-v4
description: 编写、审查、调试或讲解 Rabi 的 Effect 4 代码时使用，参考本地官方源码、测试和应用示例，核对 API、类型及执行语义。
---

# Effect 4 源码工作流

以下路径均相对于 Rabi 工作区根目录。

## 查阅流程

1. 阅读 [Effect 参考约定](../../../repos/AGENTS.md) 和 `repos/effect/LLMS.md`，按其中索引选择与任务相关的示例。
2. 核对目标包的 `package.json`、锁文件与参考源码的版本。若不一致，以实际安装版本核对 API，说明差异；参考树的更新遵循参考约定。
3. 在对应包的 `package.json` 中确认导出路径，再查符号声明、JSDoc、实现及相关测试。确认参数、返回类型、错误和所需服务，避免套用其他版本的 API。
4. 涉及模块划分、服务组装、HTTP API、Schema、持久化或运行时集成时，按下文索引选取应用示例。通过示例仓库的依赖声明和锁文件核对版本，用 Rabi 实际安装版本的公开 API 核验用法。
5. 涉及异步操作时，核对取消如何传到底层、资源何时释放及失败如何传播；讲解时区分 JavaScript 语义、Effect 运行时行为与业务约定，并给出相关源码位置。

本地材料不足时，再用同版本官方文档补充。将参考示例适配到 [Rabi 编码规范](../../../docs/CODING_STANDARDS.md) 与 [架构](../../../docs/ARCHITECTURE.md)，按当前任务实现，不因示例引入额外框架或重构。

## 源码定位

| 内容                                                    | 路径                                                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `effect` 核心模块                                       | `repos/effect/packages/effect/src/<Module>.ts`                                                   |
| `effect/cli`、`effect/http`、`effect/http-api` 等子模块 | `repos/effect/packages/effect/src/<子目录>/`，以包的 `exports` 为准                              |
| 核心库测试                                              | `repos/effect/packages/effect/test/`                                                             |
| Node 平台包                                             | `repos/effect/packages/platform/node/`；共享实现见 `repos/effect/packages/platform/node-shared/` |
| `@effect/vitest`                                        | `repos/effect/packages/vitest/`                                                                  |
| 按主题组织的示例                                        | `repos/effect/ai-docs/src/`，由 `LLMS.md` 索引                                                   |

先按模块缩小范围，再搜索符号。例如查询 `Effect.gen`：

```bash
rg -n 'export (const|function) gen' repos/effect/packages/effect/src/Effect.ts
rg -n 'Effect\.gen' repos/effect/packages/effect/test/Effect.test.ts
```

公开模块可能转发到 `src/internal/`，理解执行语义时继续追踪实现；业务导入仍使用公开导出。

## 应用示例定位

- HTTP API 和 RPC 契约见 `repos/effect-worker-mono/packages/contracts/src/`，处理器和运行时组装见 `repos/effect-worker-mono/apps/effect-worker-api/src/`。
- Schema 和领域错误见 `repos/effect-worker-mono/packages/domain/src/`。
- 数据库服务和查询见 `repos/effect-worker-mono/packages/db/src/`。
- 服务端中间件和运行时集成见 `repos/effect-worker-mono/apps/tanstack-start/src/server/`。
- 小型 Node 应用的入口装配、业务编排及 SDK 封装见 `repos/notion-discord-notifications/`（Effect 3.12.11）。入口与流程分别见 `src/index.ts` 和 `src/main.ts`，SDK 响应解码见 `src/notion.ts`，连接获取与释放见 `src/redis.ts`。
