# LiteRAG 内网离线部署指南

> 适用于无法访问互联网的公司内网环境。
> 需要在一台**联网机器**上完成打包，再将包传入内网服务器部署。

---

## 前提条件

### 内网服务器要求

| 依赖 | 版本要求 | 说明 |
|---|---|---|
| Node.js | >= 18 | 运行时 |
| PostgreSQL | >= 14 + pgvector 扩展 | 数据库 |
| 内部 LLM 服务 | OpenAI 兼容接口 | 对话模型 |
| 内部 Embedding 服务 | OpenAI 兼容接口 | 向量化模型 |

> **pgvector 安装**：`CREATE EXTENSION vector;`（需要 PostgreSQL 超级用户权限）
>
> 如果 PostgreSQL 未安装 pgvector，建议直接使用 Docker 运行（包含持久化目录与健康检查）。
>
> ### 用 Docker 启动 PostgreSQL + pgvector（推荐）
>
> ```bash
> # 1) 创建数据目录（用于持久化）
> mkdir -p /opt/lite-rag/pgdata
>
> # 2) 启动容器
> docker run -d --name lite-rag-postgres \
>   -e POSTGRES_USER=literag \
>   -e POSTGRES_PASSWORD=your_password \
>   -e POSTGRES_DB=lite_rag \
>   -v /opt/lite-rag/pgdata:/var/lib/postgresql/data \
>   -p 5432:5432 \
>   --health-cmd="pg_isready -U literag -d lite_rag" \
>   --health-interval=10s \
>   --health-timeout=5s \
>   --health-retries=5 \
>   pgvector/pgvector:pg16
> ```
>
> ### 启动后检查
>
> ```bash
> # 查看容器状态
> docker ps --filter "name=lite-rag-postgres"
>
> # 查看健康状态（healthy 为正常）
> docker inspect -f '{{.State.Health.Status}}' lite-rag-postgres
>
> # 进入数据库确认扩展可用
> docker exec -it lite-rag-postgres psql -U literag -d lite_rag -c "CREATE EXTENSION IF NOT EXISTS vector;"
> docker exec -it lite-rag-postgres psql -U literag -d lite_rag -c "SELECT extname FROM pg_extension WHERE extname='vector';"
> ```
>
> ### 常用维护命令
>
> ```bash
> docker logs -f lite-rag-postgres          # 查看日志
> docker restart lite-rag-postgres          # 重启
> docker stop lite-rag-postgres             # 停止
> docker start lite-rag-postgres            # 启动
> ```
>
> ### 端口冲突时（可选）
>
> 若本机 5432 已被占用，可改映射端口，例如 `-p 5433:5432`。  
> 对应 `.env` 需改为：
>
> ```bash
> DATABASE_URL=postgresql://literag:your_password@localhost:5433/lite_rag
> ```

---

## 第一步：在联网机器上打包

> 联网机器操作系统和 CPU 架构需与内网服务器一致（均为 Linux x86_64 或均为 macOS Apple Silicon 等）

```bash
# 1. 克隆代码
git clone https://github.com/rremix1984/lite-rag.git
cd lite-rag

# 2. 安装所有依赖（包含 node_modules，后续无需联网）
cd server && yarn install && cd ..
cd frontend && yarn install && cd ..

# 3. 编译前端（生成 server/public/）
cd frontend && yarn build
cp -r dist ../server/public
cd ..

# 4. 打包（含 node_modules，约 300-500 MB）
tar --exclude='.git' \
    --exclude='frontend/node_modules' \
    --exclude='frontend/.vite' \
    -czf lite-rag-deploy.tar.gz .

echo "✅ 打包完成：lite-rag-deploy.tar.gz"
```

---

## 第二步：传输到内网服务器

```bash
# 通过 scp、U 盘、内网文件共享等方式传输
scp lite-rag-deploy.tar.gz user@internal-server:/opt/
```

---

## 第三步：内网服务器部署

```bash
# 1. 解压
cd /opt
tar -xzf lite-rag-deploy.tar.gz
cd lite-rag

# 2. 创建并配置环境变量
cp .env.example server/.env
vi server/.env   # 按实际情况填写以下内容
```

**`server/.env` 必填项：**

```bash
# 数据库连接
DATABASE_URL=postgresql://literag:your_password@localhost:5432/lite_rag

# JWT 密钥（至少 32 位随机字符）
JWT_SECRET=your-random-secret-string-at-least-32-chars

# LLM 服务（内部地址）
LLM_BASE_URL=http://your-llm-server/v1
LLM_API_KEY=your-api-key
LLM_MODEL=your-model-name

# Embedding 服务（内部地址）
EMBEDDING_BASE_URL=http://your-embedding-server/v1
EMBEDDING_API_KEY=your-api-key
EMBEDDING_MODEL=your-embedding-model-name
# ⚠️ 维度必须与模型一致（nomic-embed-text=768, bge-m3=1024, ada-002=1536）
EMBEDDING_DIMENSIONS=768
```

```bash
# 3. 执行数据库迁移（创建所有表）
cd server
node db/migrate.js

# 4. 创建管理员账户
node scripts/init-admin.js admin your_password
cd ..
```

---

## 第四步：启动服务

### 方式一：pm2（推荐）

```bash
# 安装 pm2（仅首次）
npm install -g pm2

# 启动
cd /opt/lite-rag/server
NODE_ENV=production pm2 start index.js --name lite-rag

# 设置开机自启
pm2 startup
pm2 save

# 常用命令
pm2 status          # 查看状态
pm2 logs lite-rag   # 查看日志
pm2 restart lite-rag # 重启
pm2 stop lite-rag   # 停止
```

### 方式二：systemd

```ini
# /etc/systemd/system/lite-rag.service
[Unit]
Description=LiteRAG Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/lite-rag/server
Environment=NODE_ENV=production
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
systemctl enable lite-rag
systemctl start lite-rag
systemctl status lite-rag
```

---

## 第五步：验证部署

```bash
# 健康检查
curl http://localhost:3001/api/health
# 预期：{"status":"ok","version":"0.1.0",...}

# 浏览器访问
http://your-server-ip:3001
```

---

## 可选：Nginx 反向代理

如需通过 80/443 端口访问，配置 Nginx：

```nginx
# /etc/nginx/sites-available/lite-rag
server {
    listen 80;
    server_name your-domain.internal;

    # SSE 流式响应（关闭缓冲）
    location /api/workspaces/ {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_buffering    off;
        proxy_cache        off;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    # 其他请求
    location / {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_connect_timeout 60s;
        proxy_read_timeout    300s;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/lite-rag /etc/nginx/sites-enabled/
nginx -t && nginx -s reload
```

---

## 更新升级

```bash
# 1. 联网机器重新打包（参考第一步）
# 2. 传输新包到服务器
# 3. 服务器执行：
cd /opt
tar -xzf lite-rag-deploy-new.tar.gz -C lite-rag-new/
# 保留旧 .env
cp lite-rag/server/.env lite-rag-new/server/.env
# 执行迁移（幂等，可重复运行）
cd lite-rag-new/server && node db/migrate.js
# 切换目录并重启
pm2 restart lite-rag --update-env
```

---

## 常见问题

| 问题 | 排查方向 |
|---|---|
| 启动时 `PostgreSQL 连接失败` | 检查 `DATABASE_URL` 格式和 pg 服务状态 |
| Docker 启动 PG 但应用仍连不上 | 检查端口映射（5432/5433）、容器健康状态、`DATABASE_URL` 端口是否一致 |
| 上传文档后向量写入失败 | 确认 pgvector 扩展已安装；检查 `EMBEDDING_DIMENSIONS` 是否与模型一致 |
| 流式对话无响应 | 检查 `LLM_BASE_URL` 可达性；Nginx 是否关闭了 `proxy_buffering` |
| JWT 过期自动登出 | 调整 `.env` 中 `JWT_EXPIRY`（默认 7d） |
| 文档上传超时 | 大文件 Embedding 耗时长属正常，可调大 Nginx 超时时间 |
