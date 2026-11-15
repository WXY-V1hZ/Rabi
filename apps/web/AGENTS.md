# Web Client 设计约束

本文件记录已确定的设计，按任务逐步实现。身份、会话绑定和并发约定见[全局架构](../../docs/ARCHITECTURE.md#跨模块约定)。

## Executor 与会话交互

- 通过 Server 展示当前账号已绑定的 Executor；离线实例保留在列表中并显示离线状态，避免把断线表现为注销。
- 创建会话时选择在线 Executor，随后保持绑定；GUI 的选择操作使用已有连接，浏览器通过 Server 间接操作本地执行端。
- 展示工作目录冲突并阻止对应运行，不提供自动排队或自动迁移到其他 Executor 的交互。
- 用户可通过 GUI 解绑指定 Executor，由 Server 撤销其凭据与连接；本地登录绑定流程由 [Executor CLI](../executor/AGENTS.md#cli-与-daemon) 承担。

## 运行状态

- 展示会话、进度与结果，向 Server 提交用户输入、取消和审批等操作；运行推进由 Server 承担。
- 将 Executor 在线状态与运行、工具调用状态分开展示，按 [Server 的恢复规则](../server/AGENTS.md#调度与恢复) 呈现等待或“执行结果未知”，保留用户处理入口。
- 跨终端访问同一会话时沿用 Server 保存的状态和执行环境，浏览器关闭不作为取消运行的信号。
