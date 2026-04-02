# LiteRAG 内网知识库系统 · 构建路线图

> 参考 AnythingLLM 交互模式，面向公司内网环境设计的轻量 RAG 知识库系统。
> 目标：单进程 · 单数据库 · 离线可部署 · 易维护。
>
> **GitHub 仓库**：https://github.com/rremix1984/lite-rag
> **当前分支**：main

---

## 设计原则

- **单进程**：Express 同时托管前端静态资源和后端 API，无需 collector 独立进程
- **单数据库**：PostgreSQL + pgvector，业务数据与向量数据合一，不引入额外中间件
- **最小依赖**：服务端约 15 个 npm 包（vs AnythingLLM 的 90+）
- **离线部署**：在联网机器完成 `yarn install` + `yarn build`，打包 `node_modules` 一起传入内网
- **OpenAI 兼容接口**：对接内部 LLM/Embedding API，无需修改核心逻辑

---

## 技术栈

| 层次 | 技术选型 | 说明 |
|---|---|---|
| 运行时 | Node.js ≥ 18 | 公司已有 |
| 后端框架 | Express.js | 轻量、无魔法 |
| 前端框架 | React 18 + Vite + TailwindCSS | 公司已有 React 环境 |
| 数据库 | PostgreSQL + pgvector | 公司已有，向量与业务数据合一 |
| ORM | 原生 `pg` 驱动 | 避免 Prisma 的复杂迁移机制 |
| 认证 | JWT (jsonwebtoken + bcryptjs) | 无状态，无需 Redis |
| 文档解析 | pdf-parse · mammoth · node-xlsx | 纯 JS，无原生依赖，无 Puppeteer |
| LLM 调用 | openai SDK（兼容内部 API BaseURL）| 配置 baseURL 即可对接内部服务 |
| 流式响应 | Server-Sent Events (SSE) | 原生支持，无需 WebSocket |

### 服务端核心依赖清单（完整）

```
express          cors             dotenv           multer
bcryptjs         jsonwebtoken     pg               uuid
winston          pdf-parse        mammoth          node-xlsx
openai           js-tiktoken      mime
```

### 前端核心依赖清单（完整）

```
react            react-dom        react-router-dom
vite             tailwindcss      postcss
@phosphor-icons/react            highlight.js
markdown-it      dompurify        react-toastify
@microsoft/fetch-event-source
```

---

## 目录结构

```
lite-rag/
├── package.json              # 根级脚本（setup / dev / build / start）
├── .env.example
│
├── server/                   # Express 后端
│   ├── index.js              # 入口，挂载所有路由，生产模式托管前端 dist
│   ├── .env
│   ├── middleware/
│   │   ├── auth.js           # JWT 验证中间件
│   │   └── upload.js         # multer 文件上传配置
│   ├── routes/
│   │   ├── auth.js           # 登录 / 登出 / 当前用户
│   │   ├── workspaces.js     # 知识库 CRUD
│   │   ├── documents.js      # 文档上传 / 删除 / 列表
│   │   ├── chat.js           # 流式对话 / 历史记录
│   │   └── settings.js       # 系统配置（LLM endpoint 等）
│   ├── services/
│   │   ├── llm.js            # LLM 调用封装（流式 + 非流式）
│   │   ├── embedding.js      # Embedding 调用封装
│   │   ├── vectordb.js       # pgvector 增删查（从 AnythingLLM 裁剪移植）
│   │   ├── parser.js         # 文档解析（PDF/Word/Excel/TXT）
│   │   ├── chunker.js        # 文本分块（从 AnythingLLM TextSplitter 裁剪）
│   │   └── rag.js            # RAG 检索 + 上下文组装核心逻辑
│   ├── db/
│   │   ├── client.js         # pg Pool 单例
│   │   └── migrations/       # 纯 SQL 迁移文件，按序执行
│   │       ├── 001_init.sql
│   │       └── 002_vectors.sql
│   └── utils/
│       └── stream.js         # SSE 响应写入工具
│
└── frontend/                 # React 前端
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx            # 路由配置
        ├── index.css          # 主题变量（暗色系，参考 AnythingLLM）
        ├── api/               # 接口封装
        │   ├── auth.js
        │   ├── workspaces.js
        │   ├── documents.js
        │   └── chat.js
        ├── hooks/
        │   ├── useAuth.js
        │   └── useStreamChat.js   # SSE 流式消息 hook
        ├── pages/
        │   ├── Login/
        │   ├── WorkspaceChat/     # 主界面（参考 AnythingLLM WorkspaceChat）
        │   └── Settings/
        └── components/
            ├── Sidebar/           # 知识库列表侧边栏（借鉴 AnythingLLM Sidebar）
            ├── ChatContainer/
            │   ├── ChatHistory/   # 消息列表（借鉴 AnythingLLM HistoricalMessage）
            │   ├── PromptInput/   # 输入框（借鉴 AnythingLLM PromptInput）
            │   └── Citation/      # 来源引用（借鉴 AnythingLLM Citation）
            └── DocumentManager/   # 文档上传与管理面板
```

---

## 数据库设计（5 张表）

```sql
-- 用户表
CREATE TABLE users (
  id         SERIAL PRIMARY KEY,
  username   TEXT UNIQUE NOT NULL,
  password   TEXT NOT NULL,           -- bcrypt hash
  role       TEXT DEFAULT 'user',     -- admin / user
  created_at TIMESTAMP DEFAULT NOW()
);

-- 知识库表
CREATE TABLE workspaces (
  id                 SERIAL PRIMARY KEY,
  name               TEXT NOT NULL,
  slug               TEXT UNIQUE NOT NULL,
  system_prompt      TEXT,
  similarity_threshold FLOAT DEFAULT 0.25,
  top_n              INT DEFAULT 4,
  created_at         TIMESTAMP DEFAULT NOW()
);

-- 文档表（存储 chunk 级别文本，每行一个 chunk）
CREATE TABLE documents (
  id           SERIAL PRIMARY KEY,
  workspace_id INT REFERENCES workspaces(id) ON DELETE CASCADE,
  filename     TEXT NOT NULL,
  chunk_index  INT NOT NULL,
  content      TEXT NOT NULL,
  metadata     JSONB,
  created_at   TIMESTAMP DEFAULT NOW()
);

-- 向量表（与 documents 一一对应）
CREATE TABLE vectors (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id      INT REFERENCES documents(id) ON DELETE CASCADE,
  workspace_id INT NOT NULL,
  embedding   vector(1536),           -- 维度根据 embedding 模型调整
  created_at  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX ON vectors USING ivfflat (embedding vector_cosine_ops);

-- 对话历史表
CREATE TABLE chats (
  id           SERIAL PRIMARY KEY,
  workspace_id INT REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      INT REFERENCES users(id),
  role         TEXT NOT NULL,         -- user / assistant
  content      TEXT NOT NULL,
  sources      JSONB DEFAULT '[]',
  created_at   TIMESTAMP DEFAULT NOW()
);
```

---

## 核心 API 设计

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/login` | 登录，返回 JWT |
| GET | `/api/auth/me` | 获取当前用户信息 |
| GET | `/api/workspaces` | 获取知识库列表 |
| POST | `/api/workspaces` | 创建知识库 |
| DELETE | `/api/workspaces/:slug` | 删除知识库（含向量） |
| GET | `/api/workspaces/:slug/documents` | 列出已上传文档 |
| POST | `/api/workspaces/:slug/documents` | 上传并向量化文档 |
| DELETE | `/api/workspaces/:slug/documents/:id` | 删除文档 |
| GET | `/api/workspaces/:slug/chats` | 获取对话历史 |
| POST | `/api/workspaces/:slug/chat` | 流式对话（SSE）|
| DELETE | `/api/workspaces/:slug/chats` | 清空对话历史 |
| GET | `/api/settings` | 获取系统配置 |
| PUT | `/api/settings` | 更新系统配置 |

---

## 从 AnythingLLM 借鉴的代码清单

> 以下文件可直接裁剪后复用，**无需重写**。

### 后端

| 源文件 | 目标位置 | 裁剪说明 |
|---|---|---|
| `server/utils/vectorDbProviders/pgvector/index.js` | `server/services/vectordb.js` | 保留 `performSimilaritySearch` / `addVectors` / `deleteVectors`，移除其他 VectorDB 基类依赖 |
| `server/utils/TextSplitter/index.js` | `server/services/chunker.js` | 保留核心分块逻辑，移除 langchain 依赖 |
| `server/utils/helpers/chat/responses.js` | `server/utils/stream.js` | SSE chunk 写入工具，直接复用 |
| `server/utils/chats/index.js` 中的 `chatPrompt` / `recentChatHistory` | `server/services/rag.js` | RAG prompt 组装逻辑 |

### 前端

| 源目录/文件 | 目标位置 | 裁剪说明 |
|---|---|---|
| `frontend/src/index.css` | `frontend/src/index.css` | 暗色主题 CSS 变量，直接复用 |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/HistoricalMessage/` | `frontend/src/components/ChatContainer/ChatHistory/` | 移除 TTS、Edit、Fork、i18n 相关代码 |
| `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/Citation/` | `frontend/src/components/ChatContainer/Citation/` | 直接复用 |
| `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/index.jsx` | `frontend/src/components/ChatContainer/PromptInput/` | 移除 AgentMenu、STT、工具菜单，保留核心输入逻辑 |
| `frontend/src/components/Sidebar/index.jsx` | `frontend/src/components/Sidebar/` | 保留知识库列表结构，移除 threads |
| `frontend/src/utils/chat/markdown.js` | `frontend/src/utils/markdown.js` | Markdown 渲染工具，直接复用 |

---

## 实施阶段规划

### Phase 1：项目脚手架与基础设施 ✅ 已完成

**完成时间**：2026-04-02

**已交付文件：**
- `lite-rag/package.json` — 根级脚本（setup/dev/build/start/migrate）
- `lite-rag/.env.example` — 完整环境变量说明
- `server/index.js` — Express 入口，cors/json/静态托管/错误处理
- `server/package.json` — 15 个核心依赖
- `server/utils/logger.js` — Winston 日志
- `server/utils/stream.js` — SSE 工具（裁剪自 AnythingLLM）
- `server/db/client.js` — pg Pool 单例
- `server/db/migrate.js` — SQL 迁移执行器（幂等）
- `server/db/migrations/001_init.sql` — users/workspaces/documents/chats/system_settings
- `server/db/migrations/002_vectors.sql` — pgvector 向量表 + IVFFlat 索引
- `server/routes/` — auth/workspaces/settings 路由占位
- `server/services/` — llm/embedding/vectordb/parser/chunker/rag 服务占位
- `server/middleware/` — auth/upload 中间件占位
- `frontend/package.json` — React/Vite/TailwindCSS 等 12 个依赖
- `frontend/vite.config.js` — @/ 别名 + /api 代理到 :3001
- `frontend/tailwind.config.js` — theme 颜色变量映射
- `frontend/postcss.config.js`
- `frontend/index.html`
- `frontend/src/main.jsx` + `App.jsx` — React 入口 + 路由配置
- `frontend/src/index.css` — 暗色主题（复用自 AnythingLLM）
- `frontend/src/pages/` — Login/WorkspaceChat/Settings 页面占位
- `frontend/src/components/PrivateRoute.jsx` — 路由守卫占位

**验证结果：**
- `yarn build`（前端）：✅ 构建成功，无报错
- `node --check index.js`（服务端）：✅ 语法检查通过
- server/frontend 依赖均已安装（node_modules 就绪）
- 已推送至 GitHub：https://github.com/rremix1984/lite-rag/commit/d0f556a

---

### Phase 2：认证系统 ✅ 已完成

**完成时间**：2026-04-02

**已交付文件：**
- `server/routes/auth.js` — POST /login（bcrypt 验证 + JWT 签发）、GET /me、POST /logout
- `server/middleware/auth.js` — `requireAuth` / `requireAdmin` 中间件
- `server/scripts/init-admin.js` — 首次运行创建管理员，支持命令行参数和交互式输入
- `frontend/src/api/auth.js` — `login()` / `getMe()` / `logout()` 接口封装
- `frontend/src/contexts/AuthContext.jsx` — 全局用户状态 + token 持久化 + 启动验证
- `frontend/src/components/PrivateRoute.jsx` — JWT 守卫（loading spinner + 未登录跳转）
- `frontend/src/pages/Login/index.jsx` — AnythingLLM 暗色风格，用户名/密码表单，密码显隐
- `frontend/src/App.jsx` — 挂载 `AuthProvider`，路由保护生效

**验证结果：**
- `yarn build`（前端）：✅ 构建成功，192KB JS bundle
- `node --check`（服务端各文件）：✅ 语法无误

---

### Phase 3：知识库管理（预计 1-2 天）

**目标**：实现知识库的增删查，前端侧边栏可展示并切换知识库。

任务清单：
- `GET / POST / DELETE /api/workspaces` 路由
- 侧边栏组件（借鉴 AnythingLLM Sidebar，裁剪 threads/embed 功能）
- 点击知识库跳转至 `/workspace/:slug`
- 新建知识库弹窗（输入名称，自动生成 slug）
- 删除知识库二次确认

**完成标志**：可创建多个知识库并在侧边栏切换。

---

### Phase 4：文档摄取管道（预计 3-4 天）

**目标**：实现文档上传 → 解析 → 分块 → Embedding → 存入 pgvector 完整链路。

任务清单：

**后端：**
- `parser.js`：按 MIME 类型路由到对应解析器
  - PDF：`pdf-parse`
  - Word（.docx）：`mammoth`
  - Excel（.xlsx）：`node-xlsx`
  - 纯文本/Markdown：直接读取
- `chunker.js`：从 AnythingLLM `TextSplitter` 裁剪，保留 token-aware 分块
- `embedding.js`：调用内部 Embedding API（`openai` SDK，配置 `baseURL`）
- `vectordb.js`：从 AnythingLLM pgvector provider 裁剪，实现：
  - `addVectors(workspaceSlug, chunks, embeddings)`
  - `deleteVectors(workspaceId)`
  - `similaritySearch(workspaceSlug, queryEmbedding, topN, threshold)`
- `POST /api/workspaces/:slug/documents`：文件上传 → 解析 → 分块 → 入库
- `DELETE /api/workspaces/:slug/documents/:id`：删除文档及对应向量
- `GET /api/workspaces/:slug/documents`：列出已上传文档（文件名 + chunk 数量）

**前端：**
- `DocumentManager` 组件（可折叠面板，位于聊天界面右侧或底部）
- 拖拽上传区域（参考 AnythingLLM 的 `DnDWrapper`）
- 上传进度提示 + 错误处理
- 文档列表（文件名 + 删除按钮）

**完成标志**：上传一份 PDF，数据库 `vectors` 表可查到对应向量数据。

---

### Phase 5：RAG 对话引擎（预计 3-4 天）

**目标**：实现完整的 RAG 检索 + 流式对话。

任务清单：

**后端：**
- `rag.js`：核心检索逻辑（借鉴 AnythingLLM `stream.js` 裁剪）
  1. 对用户输入调用 Embedding API
  2. pgvector 相似度检索（cosine，取 topN）
  3. 组装 system prompt + 上下文 + 历史消息
  4. 调用 LLM（流式）
- `llm.js`：LLM 调用封装（`openai` SDK，`stream: true`）
- `stream.js`：SSE chunk 写入工具（从 AnythingLLM 直接复用）
- `POST /api/workspaces/:slug/chat`：流式 SSE 端点
- `GET /api/workspaces/:slug/chats`：历史对话记录
- `DELETE /api/workspaces/:slug/chats`：清空历史
- 对话历史写入 `chats` 表（含 sources 字段）

**前端：**
- `useStreamChat.js` hook：基于 `@microsoft/fetch-event-source` 处理 SSE
- `ChatHistory` 组件（借鉴 AnythingLLM `HistoricalMessage`，移除 TTS/Edit/Fork）
- 流式打字机效果（AI 消息逐 token 渲染）
- `Citation` 组件（借鉴 AnythingLLM Citation，显示引用来源文件名+片段）
- `PromptInput` 组件（借鉴 AnythingLLM PromptInput，移除 Agent/STT 菜单）
- 发送中状态（禁止重复提交 + 停止按钮）
- 加载历史消息

**完成标志**：向知识库提问，可看到流式回答和底部来源引用。

---

### Phase 6：系统配置（预计 1 天）

**目标**：支持通过 UI 配置 LLM/Embedding 端点，无需修改 `.env` 文件。

任务清单：
- `GET / PUT /api/settings` 路由（存入 PostgreSQL `system_settings` 键值表）
- 设置项：LLM BaseURL、LLM Model、Embedding BaseURL、Embedding Model、向量维度
- 前端 Settings 页面（基础表单）
- 侧边栏底部添加设置入口

**完成标志**：修改 LLM 地址后，对话功能正常切换。

---

### Phase 7：打磨与离网部署（预计 2 天）

**目标**：系统可靠性提升，形成内网一键部署包。

任务清单：

**可靠性：**
- 统一错误处理中间件（Express error handler）
- API 错误时前端 toast 提示
- 文件上传大小限制（multer，默认 50MB）
- 向量维度不匹配检测（pgvector 建表时固定维度）
- 数据库连接失败重试机制

**部署：**
- 生产模式：Express 托管 `frontend/dist` 静态文件，单端口对外
- 根 `package.json` 增加 `build` 脚本：`cd frontend && yarn build && cp -r dist ../server/public`
- 编写 `DEPLOY.md`：
  - 联网机器执行步骤（install → build → 打包 tar）
  - 内网服务器执行步骤（解压 → 配置 .env → 执行 SQL 迁移 → 启动）
  - Nginx 反向代理可选配置（WebSocket/SSE 特殊配置）
  - systemd/pm2 进程守护配置

**完成标志**：在一台干净机器上，按 `DEPLOY.md` 操作可完整运行系统。

---

## 里程碑总览

| 里程碑 | 预计完成时间 | 交付物 |
|---|---|---|
| M1：脚手架就绪 | ✅ 第 1 天 | 前后端联通，数据库就绪 |
| M2：可登录 | ✅ 第 1 天 | 登录、JWT、路由保护 |
| M3：知识库管理 | 第 7 天 | 知识库 CRUD + 侧边栏 |
| M4：文档摄取 | 第 11 天 | 上传 PDF 可查到向量 |
| M5：RAG 对话 | 第 15 天 | 流式问答 + 来源引用 |
| M6：配置中心 | 第 16 天 | UI 可配置 LLM 端点 |
| M7：内网部署包 | 第 18 天 | 一键部署，文档齐全 |

**总工期估算：约 18 个工作日（3.5 周）**

---

## 未来可扩展方向（不在 MVP 范围）

- 多用户权限：用户与知识库的访问控制
- 对话线程（Thread）：同一知识库下多个独立对话
- 文档重新向量化：更换 Embedding 模型后重建索引
- 批量导入：通过文件夹或 API 批量上传文档
- 问答反馈：👍/👎 记录，用于后期优化
- 全文检索混合：pgvector 向量检索 + PostgreSQL 全文检索（BM25 Hybrid）
