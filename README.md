# Rabi

云端协同的 Agent Harness，本科毕业设计项目。

## 本地开发

首次配置时，将 `apps/server/.env.example` 复制为 `apps/server/.env`，并将 `openssl rand -hex 32` 的输出填入 `BETTER_AUTH_SECRET`。需要运行 PostgreSQL 集成测试时，在同一文件中设置 `TEST_POSTGRES_URL`。

安装依赖后，在仓库根目录运行以下命令。PostgreSQL 就绪后再执行迁移。

```sh
docker compose up -d postgres
pnpm build:type
pnpm --filter server db:migrate
pnpm serve
```

用 `pnpm test` 运行测试。Server 启动、迁移和测试都会读取 `apps/server/.env`，同名的进程环境变量优先。
