# Rabi

云端协同的 Agent Harness，本科毕业设计项目。

## 本地开发

首次配置时，将 `apps/server/.env.example` 复制为 `apps/server/.env`，并将 `openssl rand -hex 32` 的输出填入 `BETTER_AUTH_SECRET`。Server 启动、迁移和测试都会读取该文件，同名的进程环境变量优先。

### 启动 PostgreSQL

在仓库根目录用 Podman Compose 启动 [compose.yaml](compose.yaml) 中的 `postgres` 服务。服务已经运行时直接复用。

```sh
podman-compose up -d postgres
podman-compose exec -T postgres pg_isready -h 127.0.0.1 -U rabi -d rabi
```

等 `pg_isready` 显示 `accepting connections` 后，再执行迁移或 PostgreSQL 集成测试。使用 Docker Compose 时，将命令中的 `podman-compose` 换成 `docker compose`。宿主机默认端口是 `5432`。如果通过 `RABI_POSTGRES_PORT` 修改了端口，同时更新 `DATABASE_URL` 和 `TEST_POSTGRES_URL`。

### 启动 Server

安装依赖后，在仓库根目录运行以下命令。

```sh
pnpm build:type
pnpm --filter server db:migrate
pnpm serve
```

### 运行测试

在仓库根目录运行 `pnpm test`。设置 `TEST_POSTGRES_URL` 即启用 PostgreSQL 集成测试，测试会在 Compose 实例中自行创建、迁移和清理临时数据库。

- `ECONNREFUSED` 表示目标地址拒绝连接。先确认 Compose 服务已就绪，再检查 `TEST_POSTGRES_URL` 的宿主机端口。
