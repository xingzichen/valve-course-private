# 私人二尖瓣狭窄病程管理与医疗建议系统技术设计文档

- 文档版本：0.3
- 文档状态：技术方案基线草案
- 更新日期：2026-08-27
- 需求依据：[REQUIREMENTS.md](./REQUIREMENTS.md)
- 前端：Vue 3 + TypeScript
- 后端：NestJS + Fastify + TypeORM
- 部署目标：家庭 NAS Docker Compose + 局域网 oMLX

## 1. 技术目标

本技术方案将需求文档转化为一个可渐进实施的本地 Web 系统。设计重点不是高并发，而是：

1. 医疗资料长期保存可靠。
2. 所有事实、医嘱、建议和 AI 输出具备来源追溯。
3. 前端在手机、平板和 PC 上均可高效使用。
4. 即使 oMLX 离线，手动档案、医嘱和原始资料仍可访问。
5. 无监管大模型只负责提取、分析和表达，不直接修改医疗事实或执行用药决定。
6. 系统可在单台 NAS 上以较少容器稳定运行，并支持备份和恢复。
7. 技术栈保持成熟、可维护，避免为了单用户项目引入不必要的微服务复杂度。
8. Apple Watch ECG 与 Apple Health 数据可先通过文件导入，后续通过最小原生 iPhone 组件安全增量同步。

## 2. 核心技术决策

### 2.1 采用模块化单体

首期采用模块化单体，而不是微服务：

- 一个 Vue Web 应用。
- 一个 NestJS API 进程。
- 一个由同一后端代码构建的 Worker 进程。
- 一个 PostgreSQL 数据库。
- 一个 Redis/Valkey 任务队列服务。
- 可选的独立 OCR Sidecar。
- NAS 外部的 oMLX 模型服务。

理由：

- 单用户负载无需微服务横向扩展。
- 医嘱、来源、用药计划和审计需要强事务一致性。
- 模块化单体便于测试、备份和家庭环境运维。
- API 与 Worker 可以独立运行，避免多模态识别、可选 OCR 和 AI 任务阻塞请求进程。

### 2.2 后端选择 NestJS

推荐 NestJS，原因如下：

- TypeScript 原生支持。
- 成熟的模块、依赖注入、Guard、Pipe、Interceptor 和异常过滤体系。
- 官方覆盖认证、授权、校验、队列、文件上传、SSE、OpenAPI 和健康检查。
- 容易按领域模块组织大型业务代码。
- 测试替身和依赖隔离机制成熟。
- 可通过 HTTP Adapter 使用 Fastify。

不选择纯 Fastify/Hono 直接开发的原因不是性能不足，而是本系统的复杂度主要来自医疗来源、状态机、审计和后台任务，成熟的应用框架比少量运行时开销更重要。

### 2.3 HTTP 运行时选择 Fastify

NestJS 使用 `@nestjs/platform-fastify`：

- Fastify 5 是 NestJS 11 官方支持的运行时。
- 文件上传、Cookie、Session、CSRF、Helmet 等必须使用对应的 Fastify 插件。
- 不依赖 Express 专用 Middleware。
- API 监听容器内 `0.0.0.0`，但仅由反向代理访问。

### 2.4 ORM 选择 TypeORM

推荐 `TypeORM + @nestjs/typeorm`：

- NestJS 官方提供紧密集成。
- Entity、Repository、事务和迁移方案成熟。
- PostgreSQL 支持完整。
- 当前可直接映射 pgvector 的 `vector` 和 `halfvec` 字段。
- 便于将复杂相似度查询保留为显式 SQL，而普通领域数据继续使用 Repository。

生产环境必须设置：

```text
synchronize = false
migrationsRun = false
```

数据库结构只通过版本化 Migration 更新，容器启动不得自动猜测并修改生产 Schema。

### 2.5 数据库选择 PostgreSQL + pgvector

选择 PostgreSQL 18 和 pgvector：

- 业务数据需要强事务、外键、JSONB、审计和复杂关联查询。
- pgvector 可在同一数据库保存文档向量，减少额外部署 Qdrant/Milvus。
- 单患者数据规模下，PostgreSQL 完全足够。
- 首期优先精确向量检索；数据规模增长后再启用 HNSW。

不得为了方便把所有业务字段塞入 JSONB。JSONB 只用于原始提取结果、模型参数快照和非稳定扩展字段；核心查询字段必须结构化。

### 2.6 API 选择 REST + OpenAPI + SSE

- 普通业务采用 `/api/v1` REST API。
- NestJS 生成 OpenAPI 文档。
- 前端客户端和 TypeScript 类型由 OpenAPI 自动生成。
- AI 流式响应和后台任务状态采用 SSE。
- 首期不使用 GraphQL 和 WebSocket。

SSE 足以处理单向的模型流式输出、任务进度和通知，连接管理比 WebSocket 简单。

### 2.7 前端选择 Vue 3 + Vite

前端采用：

- Vue 3 Composition API。
- `<script setup lang="ts">`。
- Vite。
- Vue Router。
- Pinia。
- TanStack Vue Query。
- Element Plus。
- Tailwind CSS。
- ECharts。

Pinia 只保存客户端状态，例如导航、主题、当前筛选和编辑草稿状态；服务端数据、缓存、加载和失效由 TanStack Vue Query 管理，避免同一数据维护两套缓存。

### 2.8 PWA 仅提供安装能力

首期支持把 Web 安装到手机桌面，但不缓存医疗 API 响应：

- Service Worker 只缓存静态应用资源。
- 医疗数据响应使用 `Cache-Control: no-store`。
- 不将完整病历、Token 或 AI 上下文放入 `localStorage`。
- 首期不提供离线查看病历。
- 未提交表单草稿如需本地保存，必须明确提示并支持一键清除。

### 2.9 同时建设结构化数据库和分层知识库

数据库与知识库解决不同问题，因此不做二选一：

- 结构化数据库保存经确认、需要精确查询和事务保护的内容，例如诊断、超声指标、INR、医嘱、药物、来源类型、决策状态和审计。
- 知识库保存需要语义检索的原始文档片段、页面图像、医生解释、指南/说明书和网络科普。
- 知识库中的内容始终关联 `Source`，检索结果不能脱离来源等级进入模型上下文。
- AI 历史回答独立保存，默认不进入医学知识检索空间。
- 结构化事实与知识库内容冲突时，不自动选择一方，而是创建 `ConflictRecord`。

知识库在物理上仍使用 PostgreSQL + pgvector，首期不增加独立向量数据库。

### 2.10 HealthKit 必须通过原生 iPhone 同步桥

HealthKit 不向普通网页或 PWA 提供读取接口，因此技术上分为两条路径：

- Vue Web 负责 ECG PDF、房颤历史 PDF 和 Apple Health 导出文件的手动上传、核对与展示。
- 一个轻量 SwiftUI iPhone App 负责 HealthKit 授权、查询、增量游标、后台唤醒和向 NAS 同步。

不为首期单独开发 watchOS App。Apple Watch 继续把数据写入配对 iPhone 的 Apple Health，同步桥只从 HealthKit 读取用户明确授权的数据。NAS 无法也不得绕过 iPhone 直接查询 HealthKit。

## 3. 技术栈基线

| 层级          | 选择                    | 用途                                             |
| ------------- | ----------------------- | ------------------------------------------------ |
| Runtime       | Node.js 24 LTS          | API、Worker、构建工具                            |
| 包管理        | pnpm Workspace          | Monorepo 依赖和脚本                              |
| 前端框架      | Vue 3                   | 响应式 Web UI                                    |
| 构建工具      | Vite                    | 开发、构建和静态资源                             |
| 路由          | Vue Router              | 页面和访问控制                                   |
| 客户端状态    | Pinia                   | UI 状态和临时交互状态                            |
| 服务端状态    | TanStack Vue Query      | 请求缓存、失效和后台刷新                         |
| UI 组件       | Element Plus            | 表单、对话框、上传、桌面表格                     |
| 布局样式      | Tailwind CSS            | Mobile-first 布局和响应式规则                    |
| 表单          | vee-validate + Zod      | 前端表单校验                                     |
| 图表          | Apache ECharts          | 超声、INR、症状和生命体征趋势                    |
| API 客户端    | OpenAPI Generator/Orval | 从 OpenAPI 生成类型化请求代码                    |
| iPhone 同步桥 | SwiftUI + HealthKit     | Apple Health 授权、增量读取和本地队列            |
| iOS 快捷操作  | App Intents             | Siri、快捷指令、小组件和操作按钮入口             |
| 后端框架      | NestJS                  | 模块化 API 和 Worker                             |
| HTTP Adapter  | Fastify                 | HTTP 运行时                                      |
| ORM           | TypeORM                 | PostgreSQL 映射、事务和迁移                      |
| 数据库        | PostgreSQL 18           | 业务数据、审计和检索元数据                       |
| 向量扩展      | pgvector                | 文档 Embedding 和相似度检索                      |
| 队列          | BullMQ                  | 多模态识别、可选 OCR、Embedding、AI 和导出任务   |
| 队列存储      | Redis 或 Valkey         | Job、重试、延迟任务和锁                          |
| 文件存储      | NAS 本地卷              | 原始医疗附件和导出文件                           |
| 模型服务      | oMLX                    | Qwen3.8-27B-6bit 多模态模型、Embedding、Reranker |
| 反向代理      | Caddy                   | HTTPS、静态资源和 API 路由                       |
| API 测试      | Jest + Supertest        | 单元和集成测试                                   |
| 前端测试      | Vitest + Vue Test Utils | 组件和组合函数测试                               |
| 端到端测试    | Playwright              | 手机、平板和 PC 工作流                           |
| 日志          | Pino                    | 结构化日志和敏感字段脱敏                         |

所有依赖在实施阶段锁定精确版本并提交 `pnpm-lock.yaml`。容器镜像除版本标签外，应在稳定部署后记录镜像 Digest。

## 4. 总体架构

```text
Apple Watch → Apple Health → SwiftUI iPhone 同步桥
                                      │ HealthKit 逐项授权
                                      │ 增量/删除同步 + 离线队列
                                      │ HTTPS/VPN + Device Token
手机 / 平板 / PC 浏览器或 PWA          │
              │ HTTPS                 │
              └─────────────┬─────────┘
                            ▼
┌──────────────────────── NAS ───────────────────────────────┐
│ Caddy                                                       │
│ ├── /              → Vue 静态资源                           │
│ ├── /api/v1        → NestJS API                             │
│ └── /api/v1/events → SSE                                    │
│                                                              │
│ NestJS API             NestJS Worker                         │
│ ├── 领域服务           ├── 文档处理                          │
│ ├── 认证与审计         ├── 多模态视觉/可选 OCR                │
│ ├── OpenAPI            ├── 结构化提取                        │
│ └── Job Producer       ├── Embedding/Rerank                  │
│                       ├── AI 分析                            │
│                       └── 导出/备份辅助                       │
│                                                              │
│ PostgreSQL + pgvector    Redis/Valkey     文件存储卷           │
│ ├── 领域数据            ├── Queue         ├── originals       │
│ ├── 审计                ├── Retry         ├── previews        │
│ ├── 文档/ECG 元数据     └── Progress      ├── ecg-waveforms   │
│ └── Embedding                           └── exports         │
└─────────────────────────┬───────────────────────────────────┘
                          │ 局域网 + API Key
                          ▼
┌──────────────────── Apple Silicon Mac ──────────────────────┐
│ oMLX                                                        │
│ ├── Qwen3.8-27B-6bit（文字 + 图片）                          │
│ ├── Embedding Model                                         │
│ └── Reranker（按实际配置）                                   │
└────────────────────────────────────────────────────────────┘
```

## 5. Monorepo 结构

推荐使用 pnpm Workspace：

```text
case-management/
├── apps/
│   ├── web/                       # Vue 3 前端
│   │   ├── src/
│   │   │   ├── api/               # 生成的 API Client 和适配器
│   │   │   ├── assets/
│   │   │   ├── components/
│   │   │   │   ├── base/
│   │   │   │   ├── domain/
│   │   │   │   └── responsive/
│   │   │   ├── composables/
│   │   │   ├── layouts/
│   │   │   ├── pages/
│   │   │   ├── router/
│   │   │   ├── stores/
│   │   │   ├── styles/
│   │   │   └── types/
│   │   └── tests/
│   ├── api/                       # NestJS HTTP API
│   │   ├── src/
│   │   │   ├── common/
│   │   │   ├── config/
│   │   │   ├── database/
│   │   │   ├── modules/
│   │   │   └── main.ts
│   │   └── test/
│   ├── worker/                    # NestJS Worker 入口
│   │   └── src/main.ts
│   └── ios-bridge/                # SwiftUI + HealthKit Xcode Project
│       ├── App/
│       ├── HealthKit/
│       ├── Sync/
│       ├── Intents/
│       └── Tests/
├── packages/
│   ├── contracts/                 # 共享枚举、OpenAPI 辅助和事件定义
│   ├── clinical-rules/            # 确定性医疗/安全规则及测试
│   ├── eslint-config/
│   └── tsconfig/
├── migrations/                    # TypeORM Migration
├── infra/
│   ├── compose/
│   ├── caddy/
│   ├── docker/
│   ├── backup/
│   └── scripts/
├── docs/
├── REQUIREMENTS.md
└── TECHNICAL_DESIGN.md
```

API 和 Worker 共享领域模块与数据库层，但使用不同的 Bootstrap 入口。Worker 不暴露 HTTP 业务端口，仅提供容器健康检查。`ios-bridge` 与 pnpm 应用同仓管理但使用 Xcode/Swift Package Manager 构建，不进入 Docker 镜像。

## 6. 前端架构

### 6.1 页面结构

首期页面：

```text
/login
/dashboard
/timeline
/documents
/documents/:id/review
/symptoms
/observations
/echo
/ecg
/ecg/:id
/medications
/anticoagulation
/medical-orders
/medical-orders/:id
/advice
/advice/:id
/conflicts
/decisions
/decisions/:id
/assistant
/visit-pack
/tasks
/settings
/settings/backup
/settings/models
/settings/apple-health
```

### 6.2 状态分工

#### TanStack Vue Query

负责：

- 患者档案。
- 时间线。
- 文档和任务状态。
- 医嘱、建议和冲突。
- 趋势数据。
- AI 分析列表。
- 数据更新后的缓存失效。

#### Pinia

只负责：

- 登录用户的轻量显示状态。
- 导航栏展开状态。
- 字体和主题偏好。
- 当前患者视图筛选条件。
- 未提交表单的内存草稿。
- 当前 SSE 连接状态。

禁止把整套患者档案复制进 Pinia。

### 6.3 API 类型

流程：

```text
NestJS DTO
  → OpenAPI JSON
  → 生成 TypeScript Client
  → TanStack Query Composable
  → Vue 页面
```

生成代码放入独立目录，不手工修改。业务层通过薄适配器调用生成 Client，方便处理统一错误、CSRF、请求 ID 和取消请求。

### 6.4 表单策略

- 简单表单使用 Element Plus + vee-validate。
- 校验 Schema 使用 Zod。
- 所有高风险字段显示来源和确认状态。
- 医嘱、剂量、INR、MVA 和平均压差修改前显示原值与新值。
- 保存关键医疗字段时，服务端要求 `version`，避免手机和 PC 同时编辑互相覆盖。
- 长表单自动保存仅限服务端草稿记录，不默认放入浏览器持久存储。

### 6.5 响应式设计原则

前端采用 Mobile-first。基础样式针对手机，随后逐级增强。

推荐断点：

| 设备形态 | 宽度            | 主要布局                       |
| -------- | --------------- | ------------------------------ |
| 手机     | `< 768px`       | 单列、底部导航、全屏抽屉       |
| 平板     | `768px–1023px`  | 折叠侧栏、双栏详情、横竖屏适配 |
| PC       | `1024px–1439px` | 固定侧栏、主内容 + 辅助面板    |
| 大屏 PC  | `≥ 1440px`      | 限宽内容、三栏或并排原件核对   |

Tailwind 负责视口断点，组件内部使用 CSS Container Query，根据组件实际可用宽度切换布局。

### 6.6 各设备导航

#### 手机

- 底部保留 4–5 个最高频入口：首页、时间线、上传、助手、更多。
- 次级模块放入“更多”。
- 新增记录使用底部 Sheet 或全屏页面。
- 主要操作按钮靠近拇指可达区域。

#### 平板

- 左侧导航可折叠。
- 支持列表 + 详情双栏。
- 横屏优先展示原件和提取结果并排核对。

#### PC

- 左侧固定导航。
- 中间主内容区。
- 右侧可选来源、AI 依据或待办面板。
- 页面内容设置最大宽度，避免超宽屏文字行过长。

### 6.7 响应式组件规则

#### 表格

- PC 使用 Element Plus Table。
- 手机不得简单横向压缩完整表格。
- 手机将每行转换为信息卡，仅显示关键字段和异常状态。
- 次要字段进入展开区域或详情页。
- 平板根据列数在表格与卡片之间切换。
- 只有医学上必须横向对比的内容才允许横向滚动。

实现统一的 `ResponsiveCollection` 组件，接收同一数据源和列定义，在桌面渲染表格，在移动端渲染卡片，避免业务页面各自实现不同逻辑。

#### 文档核对

- 手机：原件和提取表单上下切换，提供“查看原文”快捷按钮。
- 平板横屏：原件 45%，提取结果 55%。
- PC：原件和提取结果 50/50，可拖动分隔线。
- 点击字段时原件滚动并高亮对应区域。

#### 趋势图

- 手机默认显示最近 3–6 个点。
- 支持横向拖动和时间范围切换。
- Tooltip 可点击，避免仅依赖 Hover。
- 图例不得只依赖颜色区分。
- 表格视图作为图表的无障碍替代。

#### ECG

- 手机显示采集时间、Apple 分类、平均心率、症状、关联病程事件和原件入口。
- PC/平板可显示单导联波形、时间标尺和关联记录侧栏。
- Apple 分类、AI 解读和医生判读使用固定且不同的标签样式。
- 波形图支持缩放和导出，但页面始终提示其为 Apple Watch 单导联记录。
- 不用红/绿颜色单独表达“异常/正常”，避免把设备分类呈现成诊断结论。

#### AI 助手

- 手机为全屏会话页面。
- 平板可作为详情右侧面板。
- PC 可并排显示回答、来源和病历原文。
- 来源引用必须可点击，不能折叠到不可见位置。

### 6.8 可用性与无障碍

- 正文字号默认不小于 16px。
- 关键按钮触控区域至少约 44×44px。
- 支持浏览器字体缩放至 200% 后完成核心流程。
- 异常状态同时使用图标、文字和颜色。
- 键盘可完成上传、编辑、确认和对话框操作。
- 表单错误同时显示字段提示和页面摘要。
- 避免低对比度灰字承载关键医嘱。
- 为年龄较大的患者视图预留“大字模式”。

### 6.9 PWA 与敏感数据

- Manifest 提供安装名称、图标和启动页。
- Service Worker 只缓存版本化 JS、CSS、字体和图标。
- `/api/*`、附件和导出文件始终 Network-only。
- 注销时清除 Query Cache、内存草稿和可清除的浏览器缓存。
- 不在通知正文显示疾病或药名等敏感内容。

## 7. 后端模块设计

### 7.1 模块列表

| 模块                    | 职责                                         |
| ----------------------- | -------------------------------------------- |
| `AuthModule`            | 单账户登录、Session、密码和 CSRF             |
| `ProfileModule`         | 患者档案和专病基线                           |
| `SourceModule`          | 来源类型、作者、链接和来源继承               |
| `DocumentModule`        | 上传、文件元数据、版本和访问                 |
| `ExtractionModule`      | 多模态视觉、可选 OCR、分类、结构化提取和确认 |
| `TimelineModule`        | 统一病程事件投影和筛选                       |
| `ObservationModule`     | 检验检查和单位处理                           |
| `EchoModule`            | 心脏超声专病数据和趋势                       |
| `EcgModule`             | ECG 原件、元数据、波形、判读层次和事件关联   |
| `AppleHealthModule`     | HealthKit 配对、同步批次、设备样本和冲突核对 |
| `SymptomModule`         | 症状、活动耐量和生命体征                     |
| `MedicationModule`      | 药品、计划、变更和依从性                     |
| `AnticoagulationModule` | 抗凝方案、INR 和出血事件                     |
| `MedicalOrderModule`    | 医嘱原文、备选方案和执行状态                 |
| `AdviceModule`          | 科普、指南、患者经验和 AI 建议               |
| `ConflictModule`        | 来源冲突、事实冲突和处理闭环                 |
| `PreferenceModule`      | 患者习惯、价值观和确认状态                   |
| `DecisionModule`        | 医学门槛、方案比较和最终决定                 |
| `ClinicalRuleModule`    | 确定性规则、版本和命中记录                   |
| `AiModule`              | 模型适配、RAG、Prompt 和审查                 |
| `TaskModule`            | 复诊、复查、核验和待办                       |
| `ExportModule`          | 病程摘要、复诊包和完整导出                   |
| `AuditModule`           | 关键操作审计                                 |
| `HealthModule`          | 存活、就绪和依赖状态                         |

### 7.2 模块内部结构

每个业务模块建议使用：

```text
module/
├── application/       # Use Case 和事务边界
├── domain/            # Entity、Value Object、状态机和规则
├── infrastructure/    # TypeORM Repository、外部服务 Adapter
├── presentation/      # Controller、DTO 和 OpenAPI
└── module.ts
```

不要求机械套用完整 DDD，但必须做到：

- Controller 不直接操作 Repository。
- 大模型调用不写在 Entity 或 Controller 中。
- 医疗状态变更集中在 Use Case。
- 来源继承和执行权限不能由前端单独决定。

### 7.3 事务边界

以下操作必须使用数据库事务：

- 确认提取事实并生成结构化记录。
- 从正式医嘱创建用药计划。
- 医嘱变更并结束旧用药计划。
- 完成共同决策并回填医生最终确认。
- 处理冲突并更新关联记录状态。
- 删除或归档文档及其派生引用。

### 7.4 状态机

#### 提取事实

```text
PENDING → CONFIRMED
PENDING → REJECTED
CONFIRMED → SUPERSEDED
```

确认后不直接覆盖旧内容；修改生成新版本并将旧版本标记为 `SUPERSEDED`。

#### 医嘱

```text
DRAFT → RECORDED → CONFIRMED
CONFIRMED → ACTIVE → COMPLETED
CONFIRMED/ACTIVE → REVOKED
```

#### 建议

```text
CAPTURED → ANALYZED → NEEDS_VERIFICATION
ANALYZED → REFERENCE_ONLY
NEEDS_VERIFICATION → CONFIRMED_NOT_APPLICABLE
NEEDS_VERIFICATION → CONFIRMED_BY_DOCTOR
```

#### 共同决策

```text
DRAFT
  → WAITING_FOR_DATA
  → ELIGIBILITY_CHECKED
  → PREFERENCE_REVIEWED
  → PROVISIONAL_RECOMMENDATION
  → WAITING_FOR_DOCTOR
  → FINALIZED
```

`PROVISIONAL_RECOMMENDATION` 不得创建正式用药计划。

## 8. 数据库设计约定

### 8.1 通用字段

主要表统一包含：

```text
id              uuid primary key
created_at      timestamptz
updated_at      timestamptz
version         integer
created_by      uuid nullable
archived_at     timestamptz nullable
```

- 时间戳以 UTC 保存，前端按 Asia/Shanghai 显示。
- 只有纯日期含义的就诊日、生日使用 PostgreSQL `date`。
- 医疗事件分别保存 `observed_at`、`reported_at` 和 `recorded_at`，不得混为一个时间。
- 数值使用 PostgreSQL `numeric`，同时保留 `original_value_text`。

### 8.2 核心表

#### 身份与患者

- `users`
- `sessions` 或 Session 版本信息
- `patient_profiles`
- `conditions`
- `encounters`

#### 来源和原件

- `sources`
- `source_relations`
- `knowledge_collections`
- `knowledge_collection_memberships`
- `documents`
- `document_pages`
- `document_regions`
- `document_chunks`
- `document_embeddings`
- `extraction_runs`
- `extracted_facts`

#### 病程与专病

- `timeline_events`
- `symptom_records`
- `vital_records`
- `observations`
- `echo_studies`
- `ecg_records`
- `ecg_waveforms`
- `ecg_interpretations`
- `ecg_event_links`

#### 设备与健康平台

- `health_connections`
- `health_sync_batches`
- `health_sync_cursors`
- `health_device_sources`
- `health_samples`
- `health_sample_tombstones`
- `medication_external_mappings`

#### 用药与医嘱

- `medications`
- `medication_plans`
- `medication_events`
- `inr_records`
- `bleeding_events`
- `medical_orders`
- `order_options`

#### 建议与共同决策

- `advice_records`
- `preference_profiles`
- `preference_statements`
- `decision_records`
- `decision_options`
- `decision_criteria_results`
- `conflict_records`
- `clinical_rules`
- `clinical_rule_hits`

#### AI、任务和审计

- `ai_models`
- `ai_prompt_versions`
- `ai_runs`
- `ai_citations`
- `ai_review_results`
- `tasks`
- `exports`
- `audit_events`

### 8.3 来源模型

`sources` 至少包含：

```text
source_type
title
author_name
organization
specialty
platform
url
published_at
captured_at
is_patient_specific
has_full_record_context
identity_verification_status
commercial_interest_status
original_quote
attachment_document_id
device_source_id
source_record_identifier
data_nature
algorithm_version
```

所有 `MedicalOrder`、`AdviceRecord`、`ExtractedFact`、`Observation` 和 `AIAnalysis` 必须关联来源。来源继承使用明确关联表，不靠复制一段文本维持。

设备来源的 `data_nature` 使用明确枚举：`MEASURED`、`USER_ENTERED`、`ALGORITHM_ESTIMATE`、`ALGORITHM_CLASSIFICATION`、`NOTIFICATION`。界面和 AI 上下文不得省略该性质。

### 8.4 医疗观察值

`observations` 建议包含：

```text
code_system
code
name_original
name_normalized
value_numeric
value_text
unit_original
unit_normalized
reference_low
reference_high
reference_text
abnormal_flag
specimen
method
observed_at
reported_at
source_id
verification_status
```

在没有可靠转换规则时，不生成 `unit_normalized`，也不跨单位画趋势图。

### 8.5 心脏超声

`echo_studies` 使用独立结构化列保存高频关键字段：

```text
study_date
rhythm
heart_rate
mva_value
mva_method
mean_mitral_gradient
spap
la_diameter
la_volume_index
lvef
rv_function
mr_grade
tr_grade
leaflet_description
subvalvular_description
calcification_description
la_thrombus_status
anatomical_score
original_conclusion
source_id
verification_status
```

无法稳定结构化的细节可补充在 JSONB，但不能代替上述核心列。

### 8.6 文档不可变性

- 上传后计算 SHA-256。
- 相同哈希默认提示重复，而不是再次保存相同二进制。
- 文件名只作为显示信息，存储路径不使用患者姓名或报告标题。
- 推荐路径：`originals/{hash-prefix}/{sha256}`。
- 替换文档创建新版本，不覆盖旧文件。
- 删除默认进入归档；物理清除需要独立明确操作和审计。

### 8.7 向量空间

- 首期固定一个 Embedding 模型和维度。
- 每条向量记录 `embedding_model_id`、维度、文本哈希和生成时间。
- 不同模型或不同维度的向量不得混用。
- 更换 Embedding 模型时创建新向量空间并后台重建。
- 单患者早期使用精确相似度检索；数据量达到评估阈值后再创建 HNSW 索引。

### 8.8 分层知识库

知识库至少划分为以下逻辑集合：

| 集合                       | 内容                             | 默认检索权重 | 是否可作为患者事实           |
| -------------------------- | -------------------------------- | ------------ | ---------------------------- |
| `patient-confirmed-facts`  | 经人工确认的结构化事实投影       | 最高         | 是                           |
| `patient-original-records` | 病历、报告、处方和医嘱原件       | 高           | 需引用原文并结合确认状态     |
| `doctor-orders`            | 针对患者本人的正式医嘱及解释     | 高           | 医嘱可执行，解释不可自动执行 |
| `medical-reference`        | 获准使用的指南、说明书和机构资料 | 中           | 否，仅作通用依据             |
| `online-education`         | 网络医生视频、直播和文章         | 低           | 否                           |
| `patient-experience`       | 患者群、亲友和个体经验           | 很低         | 否                           |
| `ai-history`               | 以往 AI 分析                     | 默认不检索   | 否                           |

实现要求：

- 一个文档可以进入多个集合，但每个 Membership 必须带用途、权重和确认状态。
- `patient-confirmed-facts` 由结构化数据库生成只读检索投影，不能由模型直接写入。
- 检索 API 必须显式指定允许访问的知识集合，不能查询后再依靠 Prompt 忽略低等级来源。
- 回答“目前正在服什么药”等事实型问题时，优先查询结构化数据库，而不是向量检索。
- 回答“这份报告原文如何描述”等问题时，检索原始记录并返回页码或图像区域。
- 回答“某网络医生说法是否适用”时，同时检索 `online-education`、患者已确认事实和获准的参考资料，并保留三者来源差异。
- 外部医学资料的授权、版本、生效日期和适用地区保存在 `knowledge_collections` 或关联元数据中。
- 删除或归档来源后，相应 Chunk 和 Embedding 必须同步失效，避免幽灵引用。

### 8.9 图像知识单元

Qwen3.8-27B-6bit 可以直接处理图片，因此知识库除文本 Chunk 外，还应支持图像引用：

- PDF 每页生成受控分辨率的页面图像。
- 报告表格、结论区和医嘱区可生成裁剪图像区域。
- `document_regions` 保存页码、坐标、区域类型、图像哈希和来源文档。
- `document_chunks` 可以关联一个或多个图像区域。
- 检索命中关键数值时，可把对应页面或裁剪区域随文本一起传给多模态模型复核。
- 页面图像是原件的派生数据，可重新生成；原始 PDF/图片仍是最终原件。

### 8.10 ECG 与 Apple Health 数据

`ecg_records` 建议包含：

```text
patient_id
source_id
healthkit_uuid nullable
recorded_at
ended_at
timezone_offset
source_format                 # APPLE_ECG_PDF / HEALTHKIT / MANUAL
classification_original
average_heart_rate
symptoms_status
sampling_frequency
sample_count
lead_type                     # APPLE_WATCH_SIMILAR_TO_LEAD_I
apple_ecg_algorithm_version
device_source_id
original_document_id nullable
verification_status
possible_duplicate_of nullable
```

判读不得直接写入 `ecg_records.classification_original`，而使用 `ecg_interpretations`：

```text
ecg_record_id
interpretation_type           # APPLE / AI / USER_NOTE / CLINICIAN
content
classification nullable
author_or_model
source_id
verification_status
created_at
```

`ecg_waveforms` 只保存波形文件描述：

```text
ecg_record_id
format                        # versioned JSON / CSV / compact binary
lead_type
sampling_frequency
sample_count
storage_path
sha256
schema_version
```

原始电压序列采用有版本的无损格式存放在受控文件卷，不把数万个采样点拆成 PostgreSQL 行。前端需要的缩略波形和降采样结果可以重建，不替代原始序列。

`health_samples` 用于统一保存外部设备数据，至少记录 HealthKit UUID、类型、开始/结束时间、数值与单位、来源 App、设备硬件/软件版本、同步批次、数据性质和原始元数据哈希。高频查询数据可投影到 `vital_records`、`medication_events` 或专用表，但必须保留与原始外部样本的关联。

## 9. API 设计

### 9.1 通用约定

- Base URL：`/api/v1`。
- JSON 字段采用 `camelCase`。
- ID 使用 UUID 字符串。
- 列表使用 Cursor Pagination。
- 修改请求携带 `version` 或 `If-Match`。
- 并发冲突返回 HTTP 409。
- 每个响应携带或可关联 `requestId`。
- 错误响应统一为 `code`、`message`、`details`、`requestId`。
- 上传和创建长任务支持 `Idempotency-Key`。

### 9.2 主要 Endpoint

| 路径                             | 说明                           |
| -------------------------------- | ------------------------------ |
| `/auth/login`                    | 登录                           |
| `/auth/logout`                   | 注销                           |
| `/auth/session`                  | 当前 Session                   |
| `/profile`                       | 患者档案                       |
| `/conditions`                    | 诊断和专病基线                 |
| `/timeline`                      | 病程时间线                     |
| `/documents`                     | 上传和文档列表                 |
| `/documents/:id`                 | 文档详情                       |
| `/documents/:id/extraction`      | 提取结果                       |
| `/extracted-facts/:id/confirm`   | 确认提取事实                   |
| `/observations`                  | 检验检查                       |
| `/echo-studies`                  | 心脏超声                       |
| `/ecg-records`                   | ECG 列表和文件导入             |
| `/ecg-records/:id`               | ECG 元数据、关联事件和判读层次 |
| `/ecg-records/:id/waveform`      | 授权后流式读取或降采样波形     |
| `/symptoms`                      | 症状记录                       |
| `/vitals`                        | 生命体征                       |
| `/medications`                   | 药品和用药计划                 |
| `/inr-records`                   | INR 记录                       |
| `/medical-orders`                | 医嘱                           |
| `/medical-orders/:id/options`    | 医嘱备选方案                   |
| `/advice-records`                | 科普和外部建议                 |
| `/conflicts`                     | 冲突记录                       |
| `/preferences`                   | 患者偏好                       |
| `/decisions`                     | 共同决策                       |
| `/decisions/:id/evaluate`        | 执行适用性与偏好评估           |
| `/ai/analyses`                   | 创建 AI 分析                   |
| `/ai/analyses/:id`               | 分析结果和引用                 |
| `/tasks`                         | 提醒和待办                     |
| `/exports`                       | 创建导出任务                   |
| `/apple-health/pairing-sessions` | 创建一次性 iPhone 配对会话     |
| `/apple-health/sync-batches`     | 原生同步桥提交幂等增量批次     |
| `/apple-health/sync-status`      | 授权范围、最近同步和错误状态   |
| `/imports/apple-health`          | Apple Health 导出文件异步导入  |
| `/events`                        | SSE 任务和流式事件             |
| `/health/live`                   | 存活检查                       |
| `/health/ready`                  | 数据库、队列和文件系统就绪检查 |

### 9.3 SSE 事件

```text
job.queued
job.progress
job.completed
job.failed
ai.delta
ai.citation
ai.review.completed
task.created
system.model.offline
system.backup.failed
```

SSE Payload 不包含完整报告内容，只传 Job ID、状态、简短消息和必要的资源 ID。

## 10. 文档处理流水线

### 10.1 流程

```text
1. 浏览器上传
2. API 流式写入临时文件
3. 校验大小、MIME、扩展名和哈希
4. 原子移动到 originals
5. 写入 Document 元数据
6. 创建 document.process Job
7. Worker 生成页图和预览
8. Qwen3.8-27B-6bit 读取页面图片并完成文档分类
9. Qwen 按 JSON Schema 提取正文、表格和字段
10. 对高风险字段执行局部裁剪二次视觉读取
11. 规则校验日期、数值、单位和剂量
12. 在需要坐标、全文检索或识别分歧时调用可选 OCR 校验
13. 生成待确认 ExtractedFact
14. 用户对照原件确认或纠正
15. 事务写入正式领域记录
16. 分块、Embedding 和索引
```

### 10.2 临时文件

- 临时文件只写入受控目录。
- Job 完成或失败后按策略清理。
- 不使用用户文件名拼接系统路径。
- 解压或渲染必须设置页数、像素和处理时间上限，防止资源耗尽。

### 10.3 多模态图片处理策略

Qwen3.8-27B-6bit 作为首期主视觉模型。后端同时保留抽象接口：

```text
VisionProvider.analyzePage(image, schema) → structuredResult
VisionProvider.analyzeRegion(imageCrop, schema) → structuredResult
VisionProvider.transcribePage(image) → textResult
extractText(file, options) → pages[]
```

首期流程：

1. PDF 渲染成页面图片，原始图片保持原方向并生成校正预览。
2. Qwen 对整页进行分类、转写和结构化提取。
3. 对药名、剂量、INR、MVA、平均跨瓣压差、SPAP 和日期裁剪局部区域，再执行第二次视觉读取。
4. 两次结果不一致时标记为 `REVIEW_REQUIRED`，不得自动选择其中一个。
5. 用户在原图上确认关键字段。
6. 确认后的文本和字段进入结构化数据库及知识库。

独立 OCR 不作为首期必需服务，但保留 `OcrProvider`。出现以下情况时启用 PaddleOCR 等本地 Sidecar：

- 需要稳定的文字坐标和版面区域。
- 需要对长文档建立更完整的全文索引。
- Qwen 对密集表格、小字号或低清晰度报告识别不稳定。
- 需要使用不同模型对高风险字段进行交叉验证。

不能把“模型支持图片”理解为“识别结果无需人工确认”。视觉提取、局部复核和用户确认仍是三个独立步骤。

### 10.4 提取置信度

置信度只用于排序人工审核优先级，不等于真实性。以下字段无论置信度多高都要求人工确认：

- 药名、剂量和频次。
- INR 和医生目标范围。
- MVA。
- 平均跨瓣压差。
- SPAP/PASP。
- 日期。
- 检验数值、单位和参考范围。
- 医嘱备选方案。

### 10.5 Apple ECG 文件导入

ECG PDF 与普通文档共用上传安全链路，但在分类后进入专用流程：

```text
Apple Health 导出 ECG PDF
  → 文件哈希和 PDF 原件保存
  → Qwen 识别标题、采集时间、平均心率、Apple 分类和症状
  → 用户对照 PDF 确认
  → 创建 ECGRecord + TimelineEvent
  → 关联同一时间窗的症状、用药和活动记录
  → 复诊包可选择附上原 PDF
```

PDF 提取不能获得可靠原始电压数组时，只保存 PDF 原件和可确认元数据，不从图片反向伪造波形数据。原始波形在 HealthKit 同步阶段通过 `HKElectrocardiogramQuery` 读取。

房颤历史 PDF 和 Apple Health 用药列表 PDF 作为独立文档类型处理。它们的算法估计或清单内容必须保留 Apple 来源，不自动成为医生诊断或正式用药计划。

### 10.6 Apple Health 全量导出导入

Apple Health 的“导出所有健康数据”适合初次迁移或无原生 App 时批量导入：

- 接收 Apple Health 导出的 ZIP/XML，并将原始导出包按敏感附件保存。
- 解压时防止路径穿越、压缩炸弹和超大文件，限制文件数、解压体积和处理时间。
- 使用流式 XML 解析，禁止把完整导出文件一次载入内存。
- 导入前允许选择时间范围和数据类型，默认只选择本项目已批准的 P1 类型。
- 每条记录根据类型、来源、时间、设备和外部标识生成幂等键。
- 导出包内实际存在的 ECG 文件按其原格式保存；不能假设所有系统版本的 XML 都包含完整 ECG 波形。
- 导入结果显示成功、跳过、重复、无法识别和待确认数量。

### 10.7 SwiftUI HealthKit 同步桥

原生同步桥只承担苹果平台能力，不复制完整 Vue 业务界面：

```text
SwiftUI App
├── Pairing                   # 与 NAS 一次性配对
├── HealthAuthorization       # 分类型/逐药授权
├── HealthQueries             # ECG、Quantity、Category、Medication
├── SyncQueue                 # 本地加密的待上传批次
├── AppIntents                # 快捷症状和今日任务
└── Settings                  # 授权范围、同步状态和撤销设备
```

#### 签名与分发

针对一台家庭 iPhone，推荐使用 Apple Developer Program 会员账号配合已注册设备的 Ad Hoc 安装：不公开上架，也不依赖 TestFlight，但需要维护会员、证书和 Provisioning Profile 的有效性。

- 免费 Personal Team 的 App ID、设备注册和 Provisioning Profile 仅短期有效，需要频繁重新构建安装，不适合持续同步。
- TestFlight 构建最多测试 90 天，适合开发验收，不适合作为家庭长期运行的唯一分发方式。
- Unlisted App 可通过不公开搜索的 App Store 链接安装，但仍需 App Review，且获得链接的人都可能下载；只有未来扩大到多个非开发设备时再评估。
- 无论采用何种分发方式，App 本身仍必须通过 NAS 配对和最小 Scope 鉴权，不能把“能安装”视为“能访问患者数据”。

#### 配对和凭据

1. Web 创建短时有效的一次性配对会话并显示 QR Code。
2. iPhone App 扫描后与 NAS HTTPS Endpoint 交换设备凭据。
3. 设备私钥或 Token 存入 Keychain，不存入 `UserDefaults`。
4. 服务端记录设备显示名、安装 ID、创建时间、最近同步和撤销时间。
5. 用户可以在 Web 设置页撤销单个 iPhone，同步桥随后必须重新配对。

局域网自签证书会显著增加 iOS 信任配置成本。推荐使用内网可验证证书，或通过 Tailscale/WireGuard 的稳定域名和证书访问；不得关闭 TLS 校验。

#### 增量同步

- `HKAnchoredObjectQuery` 保存每种数据类型的增量 Anchor。
- `HKObserverQuery` 与 Background Delivery 只负责提示“可能有变化”，唤醒后仍使用 Anchor 拉取实际新增和删除对象。
- Anchor 只有在 NAS 确认批次成功后才提交到本地持久状态。
- 同步批次包含 `schemaVersion`、`deviceInstallationId`、`batchId`、数据类型、前后 Anchor、样本和删除 UUID。
- 服务端以 `patient + healthkit_uuid + sample_type` 建立唯一约束，批次 ID 作为第二层幂等保护。
- HealthKit 删除先写入 Tombstone；若 NAS 记录已关联医生批注，则保留历史并显示“源记录已删除”，不静默级联删除。
- 设备锁定、系统调度、省电模式和网络状态都可能延迟后台读取，因此此链路不是实时监护通道。

#### 授权语义

- 只在用户启用某项功能时请求相关类型，不在首次启动索取全部健康权限。
- HealthKit 读取权限可能被拒绝或只授权有限历史范围；Apple 的隐私设计使 App 不能总是区分拒绝与无数据。
- 同步状态使用 `AVAILABLE`、`NO_DATA_RETURNED`、`LIMITED_WINDOW`、`UNSUPPORTED`、`SYNC_DELAYED` 等表达，不显示误导性的“正常”。
- Medications API 使用逐个药品授权；用户批准新药前不得上传其用药事件。
- 首期同步桥只读 HealthKit，不向 Apple Health 写入诊断、药品计划或模型生成内容。

### 10.8 HealthKit 数据映射

| HealthKit 数据                                                | NAS 目标                                | 数据性质          | 说明                                               |
| ------------------------------------------------------------- | --------------------------------------- | ----------------- | -------------------------------------------------- |
| `HKElectrocardiogram`                                         | `ecg_records` + `ecg_waveforms`         | 测量 + Apple 分类 | 保存原始 UUID、算法版本和类似 I 导联电压           |
| Heart Rate / Resting / Walking Average                        | `health_samples` → `vital_records` 投影 | 测量/派生         | 保留来源设备，按时间聚合展示                       |
| High/Low Heart Rate Event                                     | `health_samples` + `timeline_events`    | 通知              | 不自动采用设备默认阈值作为医生阈值                 |
| Irregular Rhythm Event                                        | `health_samples` + `timeline_events`    | 通知              | 不等同于确诊房颤                                   |
| Atrial Fibrillation Burden                                    | `health_samples`                        | 算法估计          | 仅在适用人群和功能启用时展示                       |
| Medication + Dose Event                                       | 外部映射 + `medication_events`          | 用户记录/系统状态 | 与正式计划人工映射，保留 taken/skipped 等状态      |
| Number of Times Fallen                                        | `health_samples` + 风险事件             | 测量/用户确认     | 进入抗凝风险背景，允许补充受伤和出血情况           |
| Blood Pressure                                                | `vital_records`                         | 外部设备/用户录入 | Apple Watch 通知不转换为收缩压/舒张压数值          |
| Weight / Oxygen Saturation                                    | `vital_records`                         | 测量              | 标记设备能力和可用性                               |
| Sleep / Respiratory Rate                                      | `health_samples`                        | 测量/派生         | 作为症状和房颤背景变量                             |
| Steps / Distance / Workouts                                   | `health_samples`                        | 测量/派生         | 作为活动耐量补充，不代替临床分级                   |
| HRV / Wrist Temperature / Cardio Fitness / Walking Steadiness | `health_samples`                        | 算法派生          | P2 探索性趋势，禁止确定性结论                      |
| Vitals/Hypertension/Sleep Apnea Notification or PDF           | `health_samples` / `documents`          | 通知/算法估计     | API 不可读时允许文件或人工导入；不转成诊断或血压值 |

### 10.9 Apple 快捷体验与系统安全功能

原生同步桥稳定后可提供 2–5 个高频 App Intents：

- 记录心悸。
- 记录活动后气短。
- 记录已完成 INR 检查。
- 打开今日用药与待办。
- 打开最近 ECG。

这些动作可由 Siri、快捷指令、小组件或支持的操作按钮调用。涉及医疗记录写入时必须显示成功/失败结果，网络不可用时进入本地待同步队列，并允许用户在 App 内复核。

摔倒检测、SOS 紧急联络、医疗急救卡和 Apple Health 家庭共享不由 NAS 重做。Web 设置页只提供检查清单和最近确认日期，提醒用户在 Apple 系统中维护紧急联系人、过敏、诊断和关键用药。

## 11. AI 架构

### 11.1 模型适配接口

后端定义内部接口：

```text
ChatProvider
VisionProvider
EmbeddingProvider
RerankProvider
StructuredOutputProvider
```

oMLX Adapter 负责：

- Base URL 和 API Key。
- 模型发现和健康状态。
- OpenAI 兼容请求转换。
- 流式响应解析。
- 超时、取消和重试。
- Usage、耗时和模型版本记录。
- Qwen3.8-27B-6bit 的文字/图片输入统一封装。
- 页面图片数量、分辨率、Token 和并发限制。

领域模块不得直接引用 oMLX SDK 或 URL。

### 11.2 AI 分析流程

```text
用户问题
  → 意图分类
  → 确定性急症预检查
  → 查询已确认结构化事实
  → 时间范围过滤
  → 文档块向量检索
  → Reranker
  → 构建带来源上下文包
  → Qwen 主分析
  → 结构化输出校验
  → 独立审查 Pass
  → 确定性输出规则检查
  → 保存 Analysis/Citations
  → SSE 返回前端
```

### 11.3 上下文优先级

1. 患者本人已确认事实。
2. 经治医生正式医嘱原文。
3. 原始报告片段。
4. 个体化第二意见。
5. 版本化临床规则和获准知识资料。
6. 网络科普和患者经验。
7. 用户推测。
8. 历史 AI 推断。

历史 AI 输出不能作为新分析的医学事实，只能作为“之前曾做出的分析”引用。

### 11.4 知识库检索路由

检索前先判断问题类型：

| 问题类型                     | 首要数据源     | 补充数据源                 |
| ---------------------------- | -------------- | -------------------------- |
| 当前用药、最近 INR、最新 MVA | 结构化数据库   | 正式医嘱和原始报告         |
| 某次报告原文                 | 原始记录知识库 | 对应页面图像/区域          |
| 病程变化                     | 结构化时间线   | 原始记录片段               |
| 医生为何给出某方案           | 正式医嘱       | 就诊解释和患者事实         |
| 网络视频是否适用             | 网络科普       | 患者事实、医嘱、医学参考   |
| 通用医学概念                 | 医学参考       | 患者资料仅用于说明个体差异 |

检索结果必须携带：`collection`、`sourceType`、`sourceId`、`patientSpecific`、`verificationStatus`、页码/区域和时间。低等级来源不能仅靠相似度分数排到正式医嘱之前。

当文本提取不足以确认表格或版面信息时，RAG Context 可以附加命中的页面图像或裁剪区域，由 Qwen3.8-27B-6bit 在回答前再次查看原图。

### 11.5 Prompt 版本

每个任务单独维护 Prompt：

- 文档分类。
- 检验提取。
- 超声提取。
- 医嘱提取。
- 科普核验。
- 病程总结。
- 深度分析。
- 共同决策解释。
- 反方审查。

Prompt 使用版本号和内容哈希，不在代码中散落不可追溯的长字符串。

### 11.6 AI 输出 Schema

重要分析采用结构化 Schema：

```text
summary
confirmedFacts[]
inferences[]
supportingEvidence[]
counterEvidence[]
missingInformation[]
nextSteps[]
doctorConfirmationItems[]
urgency
uncertainty
citations[]
```

前端根据字段渲染不同标签，不能只展示一段无结构文本。

### 11.7 模型离线

- API 检测 oMLX 健康状态。
- 模型离线时允许创建任务并显示“等待模型恢复”。
- Job 使用有限次数重试和指数退避。
- 手动数据访问、医嘱和时间线不依赖模型。
- 用户可以取消排队中的 AI Job。

## 12. 医疗规则与共同决策引擎

### 12.1 规则与模型分工

#### 确定性规则负责

- 急症关键词和个体阈值。
- 来源执行权限。
- 医嘱状态机。
- 高风险字段确认要求。
- 方案医学适用性硬门槛。
- 禁止 AI 自动调药。
- 冲突升级条件。

#### 大模型负责

- 从自然语言提取候选信息。
- 解释规则为何命中。
- 总结支持和反对证据。
- 生成待询问医生的问题。
- 把结构化比较转换为易读文本。

大模型不得决定某条硬门槛是否通过。

### 12.2 临床规则结构

规则实现为可测试 TypeScript Package，并保存元数据：

```text
ruleId
version
title
description
sourceReferences[]
effectiveDate
conditions
severity
outputCode
requiredData[]
```

每次执行保存输入快照、命中规则版本和结果。医生为患者设定的个体阈值保存在数据库配置中，但不允许用户输入可执行脚本。

### 12.3 共同决策算法

```text
第一步：确认所有方案均来自针对患者本人的医嘱
第二步：收集医学硬门槛所需资料
第三步：规则引擎标记 Eligible / Ineligible / Unknown
第四步：Ineligible 不参与偏好评分；Unknown 进入待补资料
第五步：对 Eligible 方案执行透明的现实条件矩阵
第六步：患者确认习惯、心理负担和价值权重
第七步：计算可解释倾向，不使用黑箱 AI 分数
第八步：AI 生成叙述性解释和反方意见
第九步：等待医生最终确认
第十步：正式医嘱确认后更新 MedicationPlan
```

### 12.4 偏好数据

每条偏好保存：

- 内容。
- 来源：患者本人、家属描述或 AI 推测。
- 确认状态。
- 记录时间和有效期。
- 对哪个方案或决策维度生效。

AI 从聊天推断出的“害怕抽血”等内容只能创建 `UNCONFIRMED_INFERENCE`，必须由患者或用户确认。

### 12.5 建议输出

共同决策 API 返回：

```text
provisionalPreference
recommendationStrength
eligibilityResults[]
matchedPreferences[]
supportingReasons[]
opposingReasons[]
missingData[]
doctorQuestions[]
canCreateMedicationPlan = false
```

只有关联新的正式医嘱并完成确认后，另一个明确的 Use Case 才能创建用药计划。

## 13. 认证与安全

### 13.1 登录策略

单账户使用 Cookie Session：

- 密码使用 Argon2id。
- Cookie 设置 `HttpOnly`、`Secure`、`SameSite=Strict`。
- Session 只保存用户 ID、Session ID/版本和最小必要信息。
- 使用 Fastify CSRF Protection。
- 登录失败限速。
- 修改密码后使旧 Session 失效。
- 首期不把 JWT 放入 `localStorage`。
- 二阶段预留 TOTP 或 Passkey。
- Passkey 通过 WebAuthn 接入 Safari/iOS 系统认证器；服务端只保存公钥凭据，不接触 Face ID/Touch ID 模板。

iPhone 同步桥不使用浏览器 Session。它通过已配对设备凭据访问仅限 `/apple-health/*` 的 API Scope：

- 首次凭据必须由已登录 Web 会话生成的一次性 QR 配对流程签发。
- 设备 Token 使用足够熵、可轮换、可单设备撤销，并只存入 iOS Keychain。
- 同步 Endpoint 必须校验设备、患者、Schema 版本、批次幂等键、时间戳和 Body 大小。
- 设备凭据不能调用查看病历、修改医嘱、执行共同决策或管理其他设备的 API。

### 13.2 网络策略

- Caddy 是唯一对浏览器开放的端口入口。
- PostgreSQL、Redis 和 Worker 不映射至家庭 LAN。
- API 仅在 Docker 内网暴露。
- NAS 到 oMLX 只开放指定 IP 和端口。
- oMLX 启用 API Key。
- 远程访问优先使用 Tailscale/WireGuard 等 VPN，不直接做公网端口映射。
- HealthKit 后台同步需要 iPhone 可访问 NAS；仅局域网部署时，离家期间的数据会保存在本地队列，回家联网后再同步。

### 13.3 HTTP 安全

- HTTPS。
- Content Security Policy。
- HSTS 仅在域名和证书策略稳定后启用。
- `X-Content-Type-Options: nosniff`。
- 合理的 `frame-ancestors` 限制。
- 严格 CORS；同源部署时默认不开放跨域。
- 请求 Body、文件大小、页数和处理时长限制。

### 13.4 文件访问

- 附件不通过公开静态目录直接暴露。
- 下载由受保护 API 校验 Session 后流式返回。
- 导出链接短时有效且只能登录后使用。
- Response 使用 `Cache-Control: no-store`。
- Content-Disposition 文件名经过清理。

### 13.5 日志脱敏

Pino Redaction 至少覆盖：

- Authorization、Cookie、CSRF Token。
- oMLX API Key。
- 数据库连接串。
- 患者姓名和联系方式。
- 完整 Prompt、完整模型响应和未经脱敏的识别原文。
- 上传文件路径中的用户原始文件名。

日志只记录资源 ID、任务类型、耗时、状态、错误码和必要调试元数据。

### 13.6 审计

下列操作写入不可由普通业务 API 修改的 `audit_events`：

- 登录、登出和失败登录。
- 查看、导出和删除敏感附件。
- 确认或推翻提取事实。
- 创建、修改和撤销医嘱。
- 创建或结束用药计划。
- 共同决策最终确认。
- 修改个体警戒阈值。
- 修改模型、Prompt 或临床规则版本。
- 执行备份、恢复和数据清除。
- 创建、轮换或撤销 Apple Health 配对设备。
- HealthKit 同步批次、授权范围变化、源记录删除和外部药品映射确认。

Apple Health 数据不得写入项目自建 iCloud/CloudKit 容器。iOS 同步桥不得集成广告、行为分析或崩溃日志 SDK 来收集健康内容；诊断日志只记录类型、数量、耗时和脱敏错误码。

## 14. Docker 部署设计

### 14.1 Compose 服务

```text
caddy
web
api
worker
postgres
redis
backup
ocr        # 可选 profile
```

### 14.2 网络

```text
public_net     # 仅 caddy 与 web/api
app_net        # api、worker、postgres、redis
model_net      # api/worker 到局域网 oMLX 的受控出口
```

Docker Compose 本身无法完全限制宿主机出口时，应结合 NAS 防火墙限制 API/Worker 只能访问 oMLX IP、时间同步和必要的软件更新目标。

### 14.3 卷

```text
postgres-data
redis-data
medical-originals
medical-previews
exports
backups
caddy-data
```

原始附件卷和数据库卷不能仅依赖 RAID；RAID 不等于备份。

### 14.4 环境配置

非敏感配置使用环境变量：

```text
APP_BASE_URL
TZ=Asia/Shanghai
DATABASE_HOST
DATABASE_PORT
REDIS_HOST
FILE_STORAGE_ROOT
OMLX_BASE_URL
OMLX_CHAT_MODEL
OMLX_EMBEDDING_MODEL
OMLX_RERANK_MODEL
MAX_UPLOAD_BYTES
```

敏感配置使用 Docker Secrets 或仅 root 可读的独立配置文件：

```text
DATABASE_PASSWORD
SESSION_KEY
CSRF_SECRET
OMLX_API_KEY
BACKUP_ENCRYPTION_PASSWORD
```

### 14.5 健康检查

#### API 就绪

- PostgreSQL 可连接。
- Redis 可连接。
- 文件卷可读写。
- Migration 版本匹配。
- oMLX 状态单独报告，但不作为手动档案功能的强制就绪条件。

#### Worker 就绪

- Redis 可连接。
- 文件卷可读写。
- 数据库可连接。
- 多模态模型及已启用 OCR 依赖的状态可观测。

## 15. 备份、恢复与升级

### 15.1 备份内容

- PostgreSQL 逻辑备份。
- 原始附件和预览文件。
- 应用配置和规则版本。
- Prompt 版本。
- Docker Compose 和镜像版本清单。
- 文件哈希清单。
- ECG 原始波形、Apple Health 原始导出包和同步元数据。
- 不直接把明文 Secret 混入普通备份；另行保存恢复说明和密钥。

### 15.2 备份策略

建议默认：

- 每日增量附件备份。
- 每日 PostgreSQL 备份。
- 每周完整校验。
- 保留 7 个每日、4 个每周和 12 个每月恢复点，可配置。
- 使用 Restic 等工具创建加密、去重备份仓库。
- 至少一份备份位于 NAS 之外的加密介质。

### 15.3 恢复顺序

```text
1. 准备相同或兼容版本的 Compose 环境
2. 恢复 Secrets
3. 恢复 PostgreSQL
4. 恢复原始附件和哈希清单
5. 运行一致性检查
6. 启动 API 和 Worker
7. 验证抽样文档、医嘱、来源和 AI 引用
8. 重新生成可再生的预览或 Embedding（如必要）
```

### 15.4 升级流程

```text
1. 创建并验证备份
2. 下载新镜像
3. 在临时数据库演练 Migration
4. 停止写入
5. 执行正式 Migration
6. 启动新版本
7. 执行健康检查和核心回归
8. 失败时回滚应用镜像和数据库备份
```

不得使用 TypeORM `synchronize` 代替 Migration。

## 16. 可观测性

### 16.1 日志

- JSON 结构化输出。
- 每个请求有 `requestId`。
- 每个后台任务有 `jobId`。
- 每次 AI 运行有 `aiRunId`。
- 每次 Apple Health 同步有 `syncBatchId` 和脱敏的 `deviceInstallationId`。
- 生产默认 INFO，模型完整上下文不进入日志。

### 16.2 指标

首期记录：

- API 请求耗时和错误数。
- Job 排队时间、执行时间、失败和重试。
- 多模态识别每页耗时，以及启用时的 OCR 每页耗时。
- 模型首 Token 时间、总耗时和取消数。
- 数据库连接和慢查询。
- 文件卷可用空间。
- 最近备份时间和验证结果。
- oMLX 健康状态。
- Apple Health 最近成功同步时间、各类型延迟、重复/冲突数量和本地队列积压（由 iPhone 上报）。

可先提供内部 `/metrics` 或管理页，Grafana/Prometheus 作为阶段 6 可选项。

### 16.3 告警

首页系统状态应提示：

- 模型离线。
- 文档任务持续失败。
- 磁盘空间不足。
- 备份失败或过期。
- 数据库 Migration 不匹配。
- 文件哈希校验异常。
- Apple Health 长时间未同步、授权范围变化或同步 Schema 不兼容。

不通过外部通知发送具体疾病、药物或报告内容。

## 17. 测试策略

### 17.1 单元测试

重点覆盖：

- 来源执行权限。
- 医嘱、建议和共同决策状态机。
- 高风险字段确认规则。
- 单位和参考范围比较。
- 医学适用性硬门槛。
- 急症规则。
- 患者偏好确认逻辑。
- 文件路径和哈希处理。
- ECG 判读层次隔离、波形元数据和可能重复项规则。
- HealthKit 数据性质映射、批次幂等和删除 Tombstone。

### 17.2 集成测试

使用真实 PostgreSQL + pgvector 和 Redis 测试容器：

- Migration 从空库执行。
- Repository 和事务。
- 文档元数据与文件一致性。
- Job 重试和幂等。
- 向量检索和来源过滤。
- Session、CSRF 和附件权限。
- iPhone 配对、设备 Scope、同步批次重放和撤销设备。
- HealthKit UUID 去重、增量 Anchor 提交和外部药品映射冲突。

### 17.3 API 契约测试

- CI 生成 OpenAPI。
- 检查破坏性变更。
- 重新生成前端 Client。
- TypeScript 编译确保前后端契约一致。

### 17.4 前端组件测试

- 医嘱标签永远显示来源类型。
- 科普内容不能出现“执行用药”按钮。
- 未确认字段不进入正式趋势。
- 错误状态、空状态和模型离线状态。
- 手机卡片和 PC 表格展示同一关键数据。

### 17.5 E2E 设备矩阵

Playwright 至少覆盖：

| 设备     | 建议视口 |
| -------- | -------- |
| 小屏手机 | 360×800  |
| 常见手机 | 390×844  |
| 平板竖屏 | 820×1180 |
| 平板横屏 | 1180×820 |
| 笔记本   | 1366×768 |
| PC       | 1440×900 |

核心流程：

1. 登录。
2. 手机拍照/上传报告。
3. 原件与字段核对。
4. 录入正式医嘱。
5. 录入网络医生科普。
6. 查看来源冲突。
7. 执行共同决策评估。
8. 生成复诊包。
9. 上传 Apple ECG PDF 并查看分类分层和关联症状。
10. 查看 Apple Health 同步状态、授权受限状态和重复记录处理。

### 17.6 医疗黄金测试集

测试数据必须使用脱敏或合成资料，覆盖：

- 同一检查的不同日期。
- 小数点和单位误识别。
- MVA、平均跨瓣压差和 SPAP。
- 房颤和窦性心律变化。
- 华法林、利伐沙班和 INR。
- 网络视频省略关键适用条件。
- 科普与医嘱冲突。
- AI 把用户推测误当事实的反例。
- 急症提示和非急症描述。
- Apple ECG 窦性心律、房颤、低/高心率、结果不明确和较差记录等样例。
- ECG PDF 与 HealthKit 同一记录的重复导入。
- 房颤负荷、心律不齐通知和无数据间隔被错误解释为诊断的反例。
- Apple Health 用药打卡与正式用药计划不一致。

每次模型、Prompt、OCR 或规则升级必须跑回归集。

## 18. 性能与容量

### 18.1 性能目标

- 局域网内普通 API P95 小于 500ms，不含上传和 AI。
- 首页首屏在缓存命中时 2 秒内可交互。
- 上传立即返回 Job ID，不等待文档识别完成。
- 文档和 AI 任务显示实时进度。
- AI 支持首 Token 流式显示和取消。

### 18.2 数据量假设

单患者长期数据按以下量级设计：

- 数万条时间线、生命体征和观察值。
- 数千份文档。
- 数十万文档块和向量以内。

该规模下无需分库分表。先通过索引、分页、归档和精确检索优化，再考虑额外搜索服务。

### 18.3 索引建议

- 所有外键建立索引。
- 时间线：`patient_id + occurred_at desc`。
- Observation：`patient_id + normalized_name + observed_at`。
- 医嘱：`patient_id + status + ordered_at`。
- 文档：`sha256 unique`。
- 来源：`source_type + captured_at`。
- 冲突：`status + priority`。
- Job/Task：`status + scheduled_at`。
- 向量：早期精确查询；确认需要后添加 HNSW。

## 19. 技术实施阶段

### 阶段 T0：架构基线与开发环境

对应需求阶段 0。

技术任务：

- 初始化 pnpm Monorepo。
- 创建 Vue、NestJS API 和 Worker。
- 建立 ESLint、Prettier、TypeScript Strict 和提交检查。
- 建立 PostgreSQL、pgvector、Redis 和 Caddy Compose。
- 建立 TypeORM Migration 基线。
- 建立 OpenAPI 生成和前端 Client 生成流程。
- 建立 CI 基础检查。
- 完成威胁模型、备份路径和真实样本目录约定。

退出条件：

- 一条命令启动本地开发环境。
- Web 能调用 `/health/ready`。
- Migration 可从空库完整执行。
- 不提交任何真实患者资料和 Secret。

### 阶段 T1：手动档案、医嘱与来源

对应需求阶段 1。

技术任务：

- Auth、Profile、Source、Timeline、Medication、MedicalOrder、Advice、Conflict、Audit 模块。
- 手机、平板和 PC 基础布局。
- Session、CSRF、附件权限框架。
- 来源类型与执行权限服务端校验。
- 医嘱和建议状态机。
- 初版备份 Job。

退出条件：

- 模型完全离线时可完成核心手动流程。
- 科普无法通过 API 创建用药计划。
- 每条医嘱和建议可追溯来源。
- 三种视口通过 Playwright 核心流程。

阶段产物：可手动使用版本。

### 阶段 T2：上传、多模态识别与确认

对应需求阶段 2。

技术任务：

- Document、Extraction 和 Worker。
- 文件流式上传、哈希、重复检测和安全限制。
- PDF 页渲染、图片预览和文档核对界面。
- Qwen3.8-27B-6bit 多模态 Adapter 和页面/区域视觉读取。
- 可选 OCR Provider 接口，不强制首期部署 OCR Sidecar。
- 高风险字段整页读取与局部裁剪复核。
- Apple ECG PDF、房颤历史 PDF 和用药列表 PDF 专用分类与提取 Schema。
- 结构化 Schema 提取。
- ExtractedFact 状态机和确认事务。
- BullMQ 进度、重试和取消。

退出条件：

- 高风险字段必须人工确认。
- 每个提取字段可定位至原件。
- 任务失败不丢失原始文件。
- 手机端可完成上传和逐字段确认。
- ECG PDF 可创建独立 ECGRecord，Apple 分类不会进入医生判读字段。

### 阶段 T3：专病结构与趋势

对应需求阶段 3。

技术任务：

- Observation、Echo、ECG、Symptom、Vital 和 Anticoagulation 模块。
- 单位、参考范围和检查条件处理。
- ECharts 响应式趋势组件。
- 首页投影和聚合查询。
- 复诊材料导出。
- ECG 事件列表、波形/PDF 预览、症状关联和复诊附件选择。

退出条件：

- 超声趋势保留心率、心律、测量方法和来源。
- 不同单位或未确认数值不被直接合并。
- 手机显示关键趋势卡，PC 显示完整对比。
- ECG 页面永久区分 Apple 分类、AI 解读、用户备注和医生判读。

### 阶段 T4：RAG 与有来源 AI

对应需求阶段 4。

技术任务：

- AiModule、模型适配层和 oMLX 健康检查。
- 分层知识库、文档分块、图像区域、pgvector 和 Reranker。
- 结构化事实 + 文档检索上下文构建。
- 知识集合过滤和来源优先级路由。
- 检索命中后的原始页面图像复核。
- AI 输出 Schema、Citation 和 SSE。
- Prompt 版本和模型版本记录。
- 第二阶段审查。
- 科普核验。

退出条件：

- 重要事实均有可点击引用。
- 历史 AI 推断不被当作患者事实。
- oMLX 离线时任务排队且手动功能正常。
- 医疗黄金测试集达到约定准确率。

### 阶段 T5：共同决策引擎

对应需求阶段 5。

技术任务：

- Preference、Decision 和 ClinicalRule 模块。
- 医学硬门槛纯函数和版本管理。
- 偏好问卷和确认流程。
- 透明方案比较矩阵。
- AI 叙述和反方审查。
- 医生最终确认回填。
- 华法林/利伐沙班专项测试。

退出条件：

- `Ineligible` 方案不参与便利性评分。
- `Unknown` 方案清楚列出缺失资料。
- 暂定建议无法直接创建用药计划。
- 正式医嘱确认后才可更新用药。

阶段产物：项目 MVP。

### 阶段 T6：安全和长期运行加固

对应需求阶段 6。

技术任务：

- 急症规则和个体阈值。
- HTTPS、VPN、CSP、限速和日志脱敏。
- Restic 加密备份。
- 完整恢复演练。
- 磁盘、Job、模型和备份监控。
- 依赖和镜像升级流程。
- 全设备 E2E 和性能测试。

退出条件：

- 从备份恢复到新环境并通过抽样校验。
- 日志扫描不包含患者原文或 Secret。
- 确定性急症规则在模型前触发。
- 模型、数据库或磁盘异常有明确状态提示。

阶段产物：私人长期运行版本。

### 阶段 T7：Apple Health 原生同步

对应需求阶段 7。

技术任务：

- 建立 SwiftUI `ios-bridge` Xcode Project、HealthKit Entitlement 和隐私用途说明。
- 一次性 QR 配对、Keychain 设备凭据、设备 Scope 和服务端撤销。
- HealthKit 分类型授权，以及 Medications API 的逐药授权。
- `HKAnchoredObjectQuery` 增量读取和 `HKObserverQuery`/Background Delivery 唤醒。
- ECG 原始电压序列无损存储与降采样展示。
- P1 HealthKit 数据映射、幂等批次、删除 Tombstone 和离线同步队列。
- Apple Health 用药与 NAS Medication 的人工映射和冲突核对。
- 2–5 个 App Intents 快捷动作。
- VisionKit 多页文档扫描，并复用现有上传、哈希和提取 API。
- 同步状态、授权受限、设备不支持和数据延迟的前端展示。

退出条件：

- 真机验证，不以 Simulator 结果代替后台交付测试。
- 撤销任一数据类型或配对设备后，不再接收对应数据。
- 同一 ECG 经 PDF、HealthKit 和重复批次导入时只生成一个主记录或明确的候选合并项。
- iPhone 锁定、离线、省电或后台延迟不会被展示为“无异常”。
- Apple Health 数据不能创建医嘱、改变抗凝方案或自动调整药物。
- HealthKit 隐私说明、数据清单和删除/导出流程完成审核。

### 阶段 T8：可选扩展

- 患者大字简化界面。
- 医生只读分享包。
- 非 HealthKit 设备直连。
- DICOM 浏览。
- FHIR 导入导出。
- 本地语音转写。
- 多模型交叉审查。

## 20. 第一批架构决策记录

| ADR     | 决策                                                         | 状态 |
| ------- | ------------------------------------------------------------ | ---- |
| ADR-001 | 模块化单体，不采用微服务                                     | 接受 |
| ADR-002 | Vue 3 + Vite + TypeScript                                    | 接受 |
| ADR-003 | NestJS + Fastify                                             | 接受 |
| ADR-004 | TypeORM + PostgreSQL + pgvector                              | 接受 |
| ADR-005 | REST/OpenAPI + SSE，不使用 GraphQL                           | 接受 |
| ADR-006 | Pinia 管 UI 状态，Vue Query 管服务端状态                     | 接受 |
| ADR-007 | Element Plus 提供功能组件，Tailwind 负责响应式布局           | 接受 |
| ADR-008 | PWA 不缓存医疗 API 和附件                                    | 接受 |
| ADR-009 | Worker 与 API 同代码库、独立进程                             | 接受 |
| ADR-010 | AI 不具有正式医疗记录和用药计划写权限                        | 接受 |
| ADR-011 | 临床硬门槛使用确定性版本化规则                               | 接受 |
| ADR-012 | 单患者早期使用 pgvector 精确检索                             | 接受 |
| ADR-013 | 结构化数据库与分层知识库并存                                 | 接受 |
| ADR-014 | Qwen3.8-27B-6bit 作为首期主视觉模型                          | 接受 |
| ADR-015 | 独立 OCR 为可选校验组件，不是首期必需服务                    | 接受 |
| ADR-016 | Apple ECG 文件导入进入核心文档阶段                           | 接受 |
| ADR-017 | HealthKit 自动同步使用最小 SwiftUI iPhone 同步桥             | 接受 |
| ADR-018 | 首期不开发独立 watchOS App                                   | 接受 |
| ADR-019 | NAS 是医嘱/用药计划事实源，Apple Health 是设备与执行记录来源 | 接受 |
| ADR-020 | ECG 原始波形存文件卷，数据库只保存元数据和哈希               | 接受 |

## 21. 开工前待确认

- NAS CPU 架构是 x86-64 还是 ARM64。
- NAS 可用内存、Docker 版本和卷路径。
- 是否支持硬件加密卷或全盘加密。
- oMLX Mac 的固定 IP、端口和 API Key 配置。
- Qwen3.8-27B-6bit 的精确模型文件指纹、Chat Template 和图片输入参数。
- Embedding 和 Reranker 的模型与向量维度。
- 真实医疗报告样本中，Qwen 图片识别是否需要独立 OCR Sidecar 做坐标定位或交叉校验。
- 是否采用 Tailscale/WireGuard 远程访问。
- 原始资料总量和最大单文件尺寸。
- 医生给出的个体警戒阈值。
- 华法林/利伐沙班医嘱的完整原文和医学适用条件。
- iPhone、Apple Watch 型号，iOS/watchOS 版本和 Apple 账户地区。
- ECG、房颤历史、血氧、用药和其他 HealthKit 数据在实际设备上的可用性。
- 患者是否已经医生确诊房颤，以及当前启用的 Apple 心律功能模式。
- 是否接受安装私人签名的 SwiftUI iPhone 同步桥，以及采用何种签名/分发方式。
- iPhone 离家时是否通过 VPN 访问 NAS，还是仅回到家庭网络后同步。

## 22. 技术参考

- [Vue 3 TypeScript 与 Composition API](https://vuejs.org/guide/typescript/composition-api)
- [Vue 官方 TypeScript 概览](https://vuejs.org/guide/typescript/overview)
- [Vite 官方指南](https://vite.dev/guide/)
- [Pinia](https://pinia.vuejs.org/introduction.html)
- [TanStack Vue Query](https://tanstack.com/query/latest/docs/framework/vue/overview)
- [Tailwind CSS 响应式设计与 Container Query](https://tailwindcss.com/docs/responsive-design)
- [NestJS](https://docs.nestjs.com/guide/large-scale-apps)
- [NestJS Fastify Adapter](https://docs.nestjs.com/techniques/performance)
- [NestJS Database 与 TypeORM](https://docs.nestjs.com/techniques/database)
- [NestJS Queue/BullMQ](https://docs.nestjs.com/techniques/queues)
- [NestJS OpenAPI](https://docs.nestjs.com/openapi/introduction)
- [NestJS SSE](https://docs.nestjs.com/techniques/server-sent-events)
- [TypeORM PostgreSQL 和向量字段](https://typeorm.io/docs/drivers/postgres/)
- [pgvector](https://github.com/pgvector/pgvector)
- [Node.js 发布与 LTS](https://nodejs.org/en/about/previous-releases)
- [PostgreSQL 版本支持策略](https://www.postgresql.org/support/versioning/)
- [Qwen3.8-27B 官方模型说明](https://huggingface.co/Qwen/Qwen3.8-27B/blob/main/README.md)
- [oMLX](https://github.com/jundot/omlx/blob/main/README.md)
- [Apple HealthKit](https://developer.apple.com/documentation/healthkit/)
- [HKElectrocardiogram 与原始电压读取](https://developer.apple.com/documentation/healthkit/hkelectrocardiogram)
- [HealthKit 授权与有限历史窗口](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data)
- [HealthKit 数据类型](https://developer.apple.com/documentation/healthkit/data-types)
- [HKAnchoredObjectQuery 增量同步](https://developer.apple.com/documentation/healthkit/hkanchoredobjectquery)
- [HealthKit Background Delivery](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.healthkit.background-delivery)
- [HealthKit 隐私保护](https://developer.apple.com/documentation/healthkit/protecting-user-privacy)
- [HealthKit Medications API](https://developer.apple.com/videos/play/wwdc2025/321/)
- [App Intents 与快捷指令](https://developer.apple.com/documentation/appintents)
- [VisionKit 文档扫描](https://developer.apple.com/documentation/visionkit/vndocumentcameraviewcontroller)
- [Apple 平台浏览器 Passkey](https://developer.apple.com/documentation/authenticationservices/passkey-use-in-web-browsers)
- [Apple Personal Team 的 7 天限制](https://developer.apple.com/help/account/basics/about-your-developer-account)
- [Ad Hoc 注册设备分发](https://developer.apple.com/documentation/xcode/distributing-your-app-to-registered-devices)
- [TestFlight 90 天构建有效期](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview)
- [Unlisted App 分发](https://developer.apple.com/support/unlisted-app-distribution/)
- [中国大陆 watchOS 功能可用性](https://www.apple.com.cn/watchos/feature-availability/)
- [Apple Watch 心脏健康与房颤历史](https://support.apple.com/zh-cn/guide/watch/apde39f5426c/watchos)
- [Apple Watch ECG 使用与 PDF 导出](https://support.apple.com/zh-cn/120278)
- [Apple Health 用药记录](https://support.apple.com/zh-cn/guide/iphone/iph811670c81/ios)
- [Apple Watch SOS 与紧急联系人](https://support.apple.com/zh-cn/guide/watch/-apdfe3c02513/watchos)
- [Apple Watch 睡眠呼吸暂停通知](https://support.apple.com/zh-cn/guide/watch/apd4e7713562/watchos)

## 23. 技术变更原则

- 依赖升级必须通过自动化测试和医疗黄金测试集。
- ORM、数据库或模型升级前必须创建并验证备份。
- 新技术组件必须解决明确问题，不能只因流行而引入。
- 响应式实现必须在手机、平板和 PC 的真实浏览器中验收。
- 模型能力增强不扩大 AI 对正式医嘱和用药计划的写权限。
- 新增临床规则必须包含来源、适用条件、版本和回归测试。
- 任何可能导致科普信息升级为医嘱的改动必须单独审查。
- 新增 HealthKit 数据类型前必须记录用途、来源性质、系统版本、地区/设备限制和医学解释边界。
- HealthKit 能力增强不能把后台同步升级为实时监护，也不能扩大设备数据对医嘱和用药计划的写权限。
