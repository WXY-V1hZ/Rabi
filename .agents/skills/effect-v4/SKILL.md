---
name: effect-v4
description: 核对 Rabi 的 Effect 4 API、类型和执行语义。用于实现、审查、调试或讲解 Effect 代码。
---

# 查阅 Effect 4 源码

1. 从目标包的 Effect 依赖和 [参考约定](../../../repos/AGENTS.md) 确定源码版本。版本有疑问时查锁文件或已安装的包。参考树与 Rabi 版本不一致时，以 Rabi 安装版本核验公开 API。
2. 用 `rg` 在对应模块定位公开声明和实现。核对导入路径、返回类型、错误和所需服务。理解执行行为时继续追踪 `src/internal/`。
3. 遇到超时、时钟、取消或资源作用域时，查对应测试和底层适配。确认哪个时钟生效、失败如何传播、取消到达哪里以及资源何时释放。
4. 涉及服务组装、协议或运行时集成时，按下方索引查对应示例。应用示例用于理解职责和接线。迁移前以 Rabi 安装版本复核 API。

本地材料不足时，查同版本的官方文档。

## 源码与示例索引

| 要核对的内容                             | 参考位置                                                                                                               |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 核心 API、CLI、HTTP、HttpApi             | `repos/effect/packages/effect/src/`，公开子路径见该包的 `exports`                                                      |
| 执行行为与虚拟时钟                       | `repos/effect/packages/effect/test/`、`repos/effect/packages/effect/src/testing/`                                      |
| Node 运行时与平台适配                    | `repos/effect/packages/platform/node/`、`repos/effect/packages/platform/node-shared/`                                  |
| `@effect/vitest` 测试运行时              | `repos/effect/packages/vitest/`                                                                                        |
| 官方 Layer、Schema、HttpApi 和测试示例   | [Effect 示例索引](../../../repos/effect/LLMS.md)                                                                       |
| 应用的 HTTP 契约、错误与持久化边界       | `repos/effect-worker-mono/packages/{contracts,domain,db}/src/`、`repos/effect-worker-mono/apps/effect-worker-api/src/` |
| 小型 Node 应用的入口、业务编排与资源管理 | `repos/notion-discord-notifications/src/`，该示例使用 Effect 3                                                         |

## 讲解与验收

- 先讲要解决的问题，再给最小例子，最后定位到 Rabi 的调用处。区分 JavaScript 执行时机、Effect 运行时行为和业务约定。
- 给出可复制的实现时，按授权核对类型和相关行为。标明实际完成的验证，引用支撑结论的源码或测试位置。
