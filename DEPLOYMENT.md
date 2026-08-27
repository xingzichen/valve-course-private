# 部署与运维手册

## 1. 部署边界

本项目只应部署在可信家庭局域网或通过可信 VPN 访问的网络中。不要把 Caddy 端口直接映射到公网，也不要在路由器上配置公网端口转发。

架构由以下容器组成：

- `caddy`：唯一入口，反向代理 Web 与 API；
- `web`：Vue 3 静态页面；
- `api`：认证、业务接口和文件读取；
- `worker`：调用本地 oMLX，执行文档解析和问答；
- `migrate`：每次发布前幂等执行数据库迁移；
- `postgres`、`redis`：结构化数据和后台任务；
- `backup-db`、`backup`：按需执行的数据库转储与加密 Restic 备份。

## 2. oMLX 网络准备

oMLX 运行在 Mac Studio，NAS 上的 Worker 需要通过局域网 IP 访问它：

1. 确认 oMLX 监听局域网接口，而不是只监听 `127.0.0.1`；
2. 在 macOS 防火墙中仅允许 NAS 的局域网 IP 访问 TCP 5008；
3. 将 NAS `.env` 中 `OMLX_BASE_URL` 设置为 `http://<Mac-Studio-LAN-IP>:5008/v1`；
4. 从 NAS 执行 `/v1/models` 健康检查；
5. API Key 只保存在 NAS 的 `.env` 中，不写入 Git。

模型不可用不会阻止档案记录、报告查看和医嘱管理；只会使新建的 AI 任务进入失败状态，可在模型恢复后重新提交。

## 3. 群晖部署

本机已确认数据卷为 `/volume2`，本项目部署到
`/volume2/docker/valve-course-private`。

```bash
git clone git@github.com:xingzichen/valve-course-private.git
cd valve-course-private
cp .env.example .env
chmod 600 .env
docker compose config --quiet
docker compose up -d --build
docker compose ps
```

必须替换 `.env` 中的数据库密码、备份密码、oMLX API Key 和 oMLX 地址。生产环境建议：

```dotenv
NODE_ENV=production
APP_BASE_URL=http://<NAS-LAN-IP>:8080
SESSION_COOKIE_SECURE=false
HTTP_PORT=8080
```

如果使用群晖反向代理提供 HTTPS，则把外部域名写入 `APP_BASE_URL`，设置 `SESSION_COOKIE_SECURE=true`，只保留 HTTPS 入口。

首次打开页面会要求创建至少 12 位管理密码。初始化成功后，`/auth/setup` 会永久关闭。

## 4. 发布更新

```bash
git pull --ff-only
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 api worker migrate
```

`migrate` 容器成功退出后 API 和 Worker 才会启动。不要手工开启 TypeORM `synchronize`。

## 5. 备份与恢复演练

执行完整备份：

```bash
docker compose --profile backup run --rm backup-db
docker compose --profile backup run --rm backup
```

建议在 DSM“控制面板 → 任务计划”中每天执行上述两条命令。备份包括：

- PostgreSQL 自定义格式转储与全局角色；
- 原始病例、报告和 ECG 文件；
- Restic 加密、保留策略和抽样一致性检查。

至少每季度在隔离环境做一次恢复演练。恢复前先停止 `api` 和 `worker`，从 Restic 恢复 `/staging/database.dump` 与 `/data/medical`，再使用 `pg_restore --clean --if-exists` 导入数据库。恢复是破坏性操作，必须先另存当前数据。

## 6. Apple 功能使用路径

P1 支持 Apple Watch ECG PDF 与元数据导入：在 iPhone 健康 App 中打开对应 ECG，导出 PDF 后从系统分享菜单上传。设备原始分类、用户症状和医生判读分别保存。

后续原生桥接可接入 HealthKit 增量同步，优先同步 ECG、静息心率、心率、血氧、体重与房颤历史。由于浏览器/PWA 不能直接读取 HealthKit，原生桥需要单独签名的 iOS App，并且每一种数据类型都必须由用户显式授权。

## 7. 故障检查

```bash
docker compose ps
docker compose logs --tail=200 api worker migrate postgres redis
curl -fsS http://127.0.0.1:8080/api/v1/health/live
curl -fsS http://127.0.0.1:8080/api/v1/health/ready
```

文档长时间停在 `QUEUED` 时先检查 Worker 与 Redis，再检查 NAS 到 Mac Studio 的 5008 端口。不要通过降低来源校验或自动确认高风险字段来“修复”任务失败。
