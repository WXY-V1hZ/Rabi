# 共享协议设计约束

本文件记录已确定的设计，按任务逐步实现。交互语义见[全局架构](../../docs/ARCHITECTURE.md#跨模块约定)，连接接管与恢复语义见 [Server 设计](../../apps/server/AGENTS.md)。

## 边界与校验

- 本包承载 HTTP 契约、SSE 运行事件、Executor 消息与运行时 Effect Schema，从 Schema 推导 TypeScript 类型，供发送端与接收端共用；HTTP 接口使用 HttpApi 描述。
- 消息只表达网络交互所需数据，与 Server 数据库模型、Pi 内部类型和各端实现解耦；数据库服务标识与驱动留在 Server，不通过共享契约引入服务端实现依赖。
- 接收端在消息入口完成数据形状、大小与范围校验；身份权限、本地授权和状态转换是否合法仍由对应业务模块校验。
- 同一协议以一份 Schema 为准，明确内存值与网络编码的差异；第三方认证及 OAuth 端点遵循各自协议，不为适配内部接口生成方式改写标准字段、编码或错误语义。

## 设备授权

- Executor 获取 Server 凭据采用 [OAuth 2.0 Device Authorization Grant（RFC 8628）](https://www.rfc-editor.org/rfc/rfc8628.html)；网络参数、编码及错误语义遵循标准，不只复用类似的网页交互。该流程不引入授权码流程的 PKCE 参数。
- `client_id` 标识 CLI 应用，是公开标识；`executorId` 标识稳定的执行器实例，两者不互相替代。CLI 按公共客户端设计，不嵌入所有安装副本共用的 `client_secret`。
- `device_code` 是 Server 通过 HTTPS 直接返回 CLI 的临时秘密，用于轮询和领取令牌，不展示或写入日志；`user_code` 用于用户在网页找到并核对申请，不能用于领取令牌。两者均在用户批准前签发，不等于批准后产生的 `authorization_code`。
- 授权响应沿用 `device_code`、`user_code`、`verification_uri`、`expires_in` 等标准字段；`verification_uri_complete` 与 `interval` 按标准处理可选性，未提供 `interval` 时默认等待 5 秒。
- 领取令牌使用 `grant_type=urn:ietf:params:oauth:grant-type:device_code`。`authorization_pending` 表示继续等待，`slow_down` 要求后续轮询间隔增加 5 秒；`access_denied`、`expired_token` 等其他错误终止轮询。
- 领取到的 access token（及可选 refresh token）由 Rabi 签发，服务于 Executor 接入；临时申请代码、网页登录凭据和 Executor 连接凭据分别建模。账号归属与签发策略见 [Server 设计](../../apps/server/AGENTS.md#账号与设备授权)。

## 关联与状态语义

- 工具请求与结果支持按会话、运行和工具调用标识关联，满足多会话复用连接及并发执行的需求。
- 区分稳定的 Executor 身份、当前连接与工具调用身份；重连和连接接管不改变原调用归属，也不构成重新执行的依据。
- 恢复交互须能表达已确认的原调用状态及无法确认的情况，避免把断线或未收到结果直接解释为执行失败。
- 设备授权接口的具体约束、连接认证与状态核对消息尚待设计；按实际功能增量扩展 Schema，不预先固定完整消息集合。
