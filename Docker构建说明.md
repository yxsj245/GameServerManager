# GSM3 Docker 构建说明

## 概述

本项目的 Dockerfile 已经适配为 GSM3 游戏服务端管理面板，在保持原有 Steam 游戏服务器功能的基础上，集成了现代化的 Web 管理界面。

## 主要特性

- 🎮 **游戏服务器管理**: 支持多种 Steam 游戏服务器
- 🌐 **Web 管理界面**: 基于 React + TypeScript 的现代化管理面板
- 🐍 **Python 支持**: 内置 Python 环境用于游戏配置解析
- 📦 **自动构建**: 在 Docker 构建过程中自动运行 `npm run package:linux`
- 🔧 **一键部署**: 使用 Docker Compose 快速部署

## 构建过程

### 自动构建流程

1. **环境准备**: 安装 Node.js 22.17.0、Python 3.x 和游戏服务器依赖
2. **项目构建**: 自动执行 `npm run install:all` 安装所有依赖
3. **应用打包**: 自动执行 `npm run package:linux:no-zip` 生成 Linux 生产包（不创建压缩包）
4. **SteamCMD 安装**: 下载并配置 SteamCMD
5. **最终部署**: 将构建好的应用部署到容器中

### 构建命令

```bash
# 构建镜像
docker build -t gsm3-management-panel .

# 或使用 Docker Compose
docker-compose build
```

## 运行说明

### 使用 Docker Compose（推荐）

```bash
# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 直接使用 Docker

```bash
docker run -d \
  --name gsm3-panel \
  -p 3001:3001 \
  -p 27015-27020:27015-27020 \
  -v ./game_data:/home/steam/games \
  -v ./gsm3_data:/home/steam/server/data \
  gsm3-management-panel
```

## 端口说明

| 端口 | 用途 |
|------|------|
| 3001 | GSM3 Web 管理界面 |
| 27015-27020 | Steam 游戏服务器端口 |
| 7777-7784 | 7 Days to Die 等游戏端口 |
| 25565 | Minecraft 服务器端口 |
| 19132 | Minecraft Bedrock 端口 |

## 数据持久化

- `./game_data` → `/home/steam/games` - 游戏数据
- `./game_file` → `/home/steam/.config` 和 `/home/steam/.local` - 游戏配置
- `./gsm3_data` → `/home/steam/server/data` - GSM3 应用数据

## 访问管理界面

构建并启动容器后，可通过以下地址访问：

- **Web 界面**: http://localhost:3001
- **默认账户**: admin / admin123

## 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| NODE_ENV | production | Node.js 运行环境 |
| SERVER_PORT | 3001 | GSM3 服务端口 |
| TZ | Asia/Shanghai | 时区设置 |
| AUTO_UPDATE | true | 自动更新功能 |

## 注意事项

1. **权限设置**: 确保挂载的目录具有正确的权限（建议设置为 777）
2. **防火墙**: 确保相关端口在防火墙中已开放
3. **资源要求**: 建议至少 2GB 内存和 2 CPU 核心
4. **Python 依赖**: 容器启动后会自动安装 Python 依赖

## 故障排除

### 查看日志
```bash
# 查看容器日志
docker-compose logs gsm3-server

# 实时查看日志
docker-compose logs -f gsm3-server
```

### 进入容器调试
```bash
# 进入容器
docker-compose exec gsm3-server bash

# 检查应用状态
docker-compose exec gsm3-server ps aux
```

### 重启服务
```bash
# 重启容器
docker-compose restart gsm3-server

# 重新构建并启动
docker-compose up --build -d
```

## 打包选项说明

项目支持多种打包方式：

```bash
# 标准打包（创建压缩包）
npm run package              # 通用版本
npm run package:linux        # Linux版本
npm run package:windows      # Windows版本

# 不创建压缩包（仅生成文件夹）
npm run package:no-zip           # 通用版本，不创建压缩包
npm run package:linux:no-zip    # Linux版本，不创建压缩包
npm run package:windows:no-zip  # Windows版本，不创建压缩包
```

**使用场景**：
- `--no-zip` 参数适用于 Docker 构建，避免创建不必要的压缩包
- 开发和测试环境可以使用不压缩版本，便于快速部署和调试

## 开发模式

如果需要在开发模式下运行，可以直接在宿主机上使用：

```bash
# 安装依赖
npm run install:all

# 开发模式运行
npm run dev
```

## 更新说明

当项目代码更新后，需要重新构建镜像：

```bash
# 停止现有容器
docker-compose down

# 重新构建镜像
docker-compose build --no-cache

# 启动新容器
docker-compose up -d
```