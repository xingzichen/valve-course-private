# Valve Course Private

私人单患者二尖瓣狭窄病程管理、病例记录和共同决策辅助系统。

## 当前范围

- Vue 3 响应式 Web：手机、平板和 PC。
- NestJS + Fastify API 与后台 Worker。
- PostgreSQL + pgvector、Redis/BullMQ、NAS 文件存储。
- 患者档案、来源、病程时间线、医嘱、用药、检查、ECG 和审计。
- PDF/JPEG/PNG/HEIC 多文件上传与拍摄，上传后自动排队、分类、识别报告时间及结构化字段。
- Qwen3.8-27B-6bit 多模态提取、文档专属分析建议、病程时间线归档和逐字段人工确认。
- Apple Watch ECG PDF 导入；HealthKit 原生同步桥在后续阶段实现。
- 网络科普与患者本人医嘱强制分源；只有已确认的经治医生医嘱可以建立服药计划。
- 胸痛、晕厥、严重呼吸困难、卒中表现和大出血等由确定性规则优先拦截，不依赖模型判断。

本系统仅作私人病程整理和医疗共同决策辅助，不替代医生诊疗，不自动调药。

## 本地启动

1. 复制 `.env.example` 为 `.env` 并填写本地 Secret。
2. 执行 `pnpm install`。
3. 执行 `docker compose up -d postgres redis`。
4. 执行 `pnpm db:migrate`。
5. 分别执行 `pnpm dev:api`、`pnpm dev:worker` 和 `pnpm dev:web`。

浏览器开发地址默认是 `http://localhost:5173`，API 默认是 `http://localhost:3000/api/v1`。

完整容器启动：

```bash
docker compose config --quiet
docker compose up -d --build
curl -fsS http://localhost:8080/api/v1/health/ready
```

## 校验

```bash
pnpm format:check
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

`scripts/smoke-e2e.sh` 会在一个尚未初始化的测试实例中创建一次性管理员和测试记录，覆盖来源隔离、抗凝选择硬门槛、医嘱确认、危急症状与本地模型 Worker。传入无真实患者信息的 PNG/JPEG/PDF 可额外测试多模态抽取：

```bash
SMOKE_DOCUMENT=/path/to/synthetic-report.png ./scripts/smoke-e2e.sh
```

不要对正式档案运行该脚本。

## 文档

- [需求规格说明书](./REQUIREMENTS.md)
- [技术设计文档](./TECHNICAL_DESIGN.md)
- [部署与运维手册](./DEPLOYMENT.md)
