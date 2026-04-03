# LiteRAG

LiteRAG 是一个面向内网场景的轻量知识库问答系统，目标是以最小依赖实现“文档上传、解析、向量检索、流式问答、文档预览与加工规划”能力，并保持易部署、易维护、可渐进扩展。

## 分支说明

- 当前协作开发分支：`20260403-wangxiaozhe`
- 约定：后续功能开发默认在该分支进行，稳定后再按流程合并到 `main`

## 项目背景

- 参考 AnythingLLM / Kimi 的交互思路，但保持 LiteRAG 的轻量架构
- 面向企业内网环境，优先保证可落地与可运维
- 核心原则：单进程、单数据库、可离线部署、功能渐进增强

## 技术栈

- 前端：React 18、Vite、TailwindCSS、React Router、markdown-it、DOMPurify、pdfjs-dist
- 后端：Node.js、Express、pg、JWT、Multer、OpenAI SDK（兼容接口）
- 数据库：PostgreSQL + pgvector
- 文档解析：pdf-parse、mammoth、node-xlsx
- 流式：SSE

## 核心功能（当前可用）

- 用户认证与系统配置管理
- 知识库（workspace）管理
- 文档上传与解析（pdf/doc/docx/xls/xlsx/md/txt/csv）
- 文本分块、向量化、相似度检索、SSE 问答
- 文档列表与删除
- 文档预览：
  - PDF 原始页渲染（分页、缩放）
  - Markdown 富文本渲染
  - Word 分页文本预览
  - 文本类预览
- 文档预览交互增强：
  - 右侧可展开/收起预览窗口
  - 分栏可拖拽、宽度记忆
  - 键盘快捷键（Esc、左右翻页、PDF 缩放）

## 当前进度

- 路线图 v1：见 [ROADMAP.md](./ROADMAP.md)
- 路线图 v2：见 [ROADMAPv2.md](./ROADMAPv2.md)
- 文档加工能力规划：见 [DOC_PROCESSING_PLAN.md](./DOC_PROCESSING_PLAN.md)

阶段状态简述：

- 已完成：基础架构、RAG 主链路、文档预览与交互增强、Kimi 风格前端框架搭建
- 进行中：Kimi 风格统一化、检索稳定性与可观测增强
- 规划中：文档加工（版本化、异步任务、模板加工、导出）

## 启动方式（开发）

```bash
yarn install
yarn dev
```

默认：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:3001`

## 部署与环境

- 部署指引：见 [DEPLOY.md](./DEPLOY.md)
- 环境变量示例：见 `.env.example` 与 `server/.env`

