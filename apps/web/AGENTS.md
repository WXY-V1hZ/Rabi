# Web Client 设计约束

本文件记录已确定的设计，按任务逐步实现。身份、会话绑定和并发约定见[全局架构](../../docs/ARCHITECTURE.md#跨模块约定)。

## 目录结构

- `src/main.tsx` 负责浏览器挂载，`src/App.tsx` 负责装配根界面。
- 页面和专用组件、交互状态按功能放在一起。功能拆成多个实现文件时，在 `src/` 下为该功能建立子目录。
- HTTP 请求和 SSE 订阅放在独立的数据访问模块，通过共享协议处理网络数据。

## 页面与数据访问

- Web 采用 React + Vite SPA，通过 HTTP 提交操作和查询，通过 SSE 接收运行事件。
- TanStack Router 与 TanStack Query 为候选，采用待确认；前者管理 URL、页面及路由参数，后者管理服务端数据的获取、缓存和失效。输入框等本地交互状态保留在 React 中。
- 若采用 Query，SSE 事件更新对应缓存或触发重新查询，避免缓存与界面各保存一份互相漂移的业务状态；采用 Router 不意味着引入 TanStack Start、SSR 或服务端函数。

## 登录与设备授权

- Web 提供 Rabi 自身的登录／注册入口；账号与第三方身份的关系见 [Server 设计](../server/AGENTS.md#账号与设备授权)，不要求用户必须通过 GitHub 登录。
- 用户通过 CLI 展示的网址进入授权页面，输入或通过完整授权链接带入 `user_code`；未登录时先登录 Rabi，完成后返回原授权申请。
- 确认页面展示当前 Rabi 账号、申请信息与确认码，由用户明确批准或拒绝；打开链接或登录成功本身不代表批准绑定。设备名称等客户端报告的信息只作辅助展示。
- 浏览器通过 Server 完成确认，不直接连接 Executor，也不接收 CLI 的 `device_code` 或最终 Executor 凭据。CLI 行为见 [Executor 设计](../executor/AGENTS.md#设备授权与绑定)。

## Executor 与会话交互

- 通过 Server 展示当前账号已绑定的 Executor；离线实例保留在列表中并显示离线状态，避免把断线表现为注销。
- 创建会话时选择在线 Executor，随后保持绑定；GUI 的选择操作使用已有连接，浏览器通过 Server 间接操作本地执行端。
- 展示工作目录冲突并阻止对应运行，不提供自动排队或自动迁移到其他 Executor 的交互。
- 用户可通过 GUI 解绑指定 Executor，由 Server 撤销其凭据与连接。本地设备授权由 [Executor CLI](../executor/AGENTS.md#设备授权与绑定) 发起。

## 运行状态

- 展示会话、进度与结果，向 Server 提交用户输入、取消和审批等操作；运行推进由 Server 承担。
- 将 Executor 在线状态与运行、工具调用状态分开展示，按 [Server 的恢复规则](../server/AGENTS.md#调度与恢复) 呈现等待或“执行结果未知”，保留用户处理入口。
- 跨终端访问同一会话时沿用 Server 保存的状态和执行环境，浏览器关闭不作为取消运行的信号。
