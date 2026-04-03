# LiteRAG 文档加工能力规划（参考 Kimi 交互）

## 1. 目标

在现有“文档上传 + 预览 + 问答”基础上，新增“文档加工”能力，支持用户通过自然语言完成以下任务：

- 内容改写：润色、扩写、压缩、改语气、改术语风格
- 结构化加工：按模板重组章节、提取关键信息生成固定格式
- 版式加工：字体、字号、段落、标题层级、页眉页脚、目录
- 批量规则：一次对多个文档执行统一加工规则
- 结果导出：可下载 docx / markdown / txt / pdf（阶段化支持）

---

## 2. Kimi 风格交互设计

## 2.1 核心交互流

1. 用户在左侧能力栏点击“文档（已开通）”
2. 右侧出现“文档工作台”（两栏或三栏）
   - 左：文档列表
   - 中：原文预览
   - 右：加工指令区（类似 Kimi 输入框 + 操作 chips）
3. 用户输入指令（如“按公司公文模板重排并统一三号仿宋”）
4. 系统返回：
   - 加工结果预览
   - 变更摘要（改了什么）
   - 可选“应用到原文 / 另存新版本 / 导出”

## 2.2 推荐 UI 组件

- 顶部模式切换：`问答` | `文档加工`
- 快捷指令 Chips：
  - 改写润色
  - 转会议纪要模板
  - 转项目周报模板
  - 统一格式（字体/字号/行距）
  - 生成对照修订版
- 版本面板：
  - v1 原始稿
  - v2 模板化稿
  - v3 最终导出稿

---

## 3. 技术方案（分层）

## 3.1 数据模型扩展

新增表（建议）：

- `document_versions`
  - `id`
  - `workspace_id`
  - `filename`
  - `source_doc_hash`
  - `version_no`
  - `content_text`
  - `content_format` (`txt|md|docx|pdf`)
  - `storage_relpath`
  - `change_summary`
  - `created_by`
  - `created_at`

- `document_process_jobs`
  - `id`
  - `workspace_id`
  - `source_version_id`
  - `instruction`
  - `template_id`（可空）
  - `status` (`pending|running|success|failed`)
  - `error_message`
  - `result_version_id`（可空）
  - `created_at`
  - `updated_at`

- `document_templates`
  - `id`
  - `name`
  - `template_type` (`markdown|docx`)
  - `schema_json`（字段定义）
  - `storage_relpath`
  - `created_at`

## 3.2 服务层拆分

- `services/documentProcessor.js`
  - 解析用户加工意图（rewrite / template_fill / format_adjust）
  - 构建 LLM 提示词与约束
  - 产出结构化结果（正文 + 变更摘要 + 元数据）

- `services/documentFormatter.js`
  - 文本/Markdown 格式化规则
  - docx 样式应用（字体、段落、标题）
  - pdf 导出适配（阶段2）

- `services/templateEngine.js`
  - 模板字段抽取与校验
  - 将 LLM 输出映射到模板占位符

## 3.3 异步任务机制

文档加工不要走同步接口，使用任务队列：

- 提交加工任务 → 返回 `job_id`
- 前端轮询/订阅 job 状态
- 成功后返回 `result_version_id`

这样可以避免长文档加工请求超时，并便于重试与审计。

---

## 4. API 设计（MVP）

- `POST /api/workspaces/:slug/documents/:filename/process`
  - 入参：`instruction`, `template_id?`, `output_format?`
  - 出参：`job_id`

- `GET /api/workspaces/:slug/document-jobs/:jobId`
  - 出参：状态、进度、错误、结果版本ID

- `GET /api/workspaces/:slug/documents/:filename/versions`
  - 出参：版本列表

- `GET /api/workspaces/:slug/document-versions/:versionId/preview`
  - 出参：文本/markdown/docx 预览内容

- `POST /api/workspaces/:slug/document-versions/:versionId/export`
  - 入参：`format: docx|pdf|md|txt`
  - 出参：下载地址

---

## 5. 功能分期

## Phase A（MVP，先上线）

范围：

- 支持 `txt/md/docx` 的内容加工
- 指令加工（改写、总结、模板化）
- 生成新版本，不覆盖原文
- 文本预览 + 版本切换 + 导出 md/txt/docx

暂不做：

- 真正 PDF 编辑（PDF 只作为输入解析，输出可转 docx/pdf）
- 批量任务并发调度优化

验收标准：

- 用户可对任一文档输入加工指令并得到新版本
- 可查看变更摘要与导出结果
- 出错可见、可重试、原文不丢失

## Phase B（增强）

- 批量加工（多文档）
- 模板市场（固定模板管理）
- 修订对比视图（diff）
- 一键“应用到原文并重建向量”

## Phase C（高级）

- PDF 原样式重排（借助外部引擎）
- 企业审批流（加工结果需要审批后发布）
- 自动质检（术语一致性、格式一致性）

---

## 6. 风险与规避

- 大模型输出不稳定
  - 规避：结构化输出约束 + 重试 + 校验器

- 格式处理复杂（尤其 docx/pdf）
  - 规避：MVP 先文本语义正确，版式逐步增强

- 长文档耗时
  - 规避：异步 job + 分段加工 + 阶段性进度

- 覆盖原文导致不可逆
  - 规避：强制版本化，不直接覆盖

---

## 7. 建议落地顺序（你当前项目最合适）

1. 先做后端 job + version 数据结构（不改 UI）
2. 接入最小加工链路（instruction -> 新版本）
3. 前端加“文档加工”模式页（Kimi 风格输入 + 结果卡片）
4. 加版本面板与导出
5. 再做模板系统与批量加工

---

## 8. 与当前 LiteRAG 的兼容策略

- 不破坏现有问答链路
- 文档加工默认产生新版本，不影响当前向量库
- 用户确认“发布到知识库”后，再触发增量向量化

这样可以把“加工”和“检索问答”解耦，风险最低、可逐步上线。

