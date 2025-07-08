# GSM3 游戏服务端管理面板 - 部署指南

## 开发环境

### 环境要求
- Node.js >= 18.0.0
- npm >= 8.0.0

### 安装依赖
```bash
# 安装所有依赖（根目录、服务端、客户端）
npm run install:all
```

### 开发模式
```bash
# 同时启动前端和后端开发服务器
npm run dev

# 或者分别启动
npm run dev:server  # 启动后端开发服务器
npm run dev:client  # 启动前端开发服务器
```

## 生产环境部署

### 1. 构建项目
```bash
# 构建前端和后端
npm run build

# 或者分别构建
npm run build:server  # 构建后端
npm run build:client  # 构建前端
```

### 2. 创建生产包
```bash
# 构建并打包成zip文件
npm run package
```

这将创建一个包含以下内容的zip文件：
- `server/` - 编译后的后端代码
- `public/` - 前端静态文件
- `start.bat` - Windows启动脚本
- `start.sh` - Linux/Mac启动脚本
- `README.md` - 部署说明

### 3. 部署到服务器

1. 解压生产包到目标服务器
2. 进入server目录安装生产依赖：
   ```bash
   cd server
   npm install --production
   ```
3. 复制环境配置文件：
   ```bash
   cp .env.example .env
   ```
4. 编辑.env文件，配置相关参数
5. 启动服务：
   - Windows: 双击 `start.bat`
   - Linux/Mac: `./start.sh`

### 4. 使用PM2部署（推荐）

```bash
# 安装PM2
npm install -g pm2

# 在server目录下创建ecosystem.config.js
cd server
```

创建PM2配置文件 `ecosystem.config.js`：
```javascript
module.exports = {
  apps: [{
    name: 'gsm3-panel',
    script: 'index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
```

启动服务：
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 可用脚本

- `npm run dev` - 启动开发环境（前端+后端）
- `npm run build` - 构建生产版本
- `npm run package` - 创建部署包
- `npm run start` - 启动生产服务器
- `npm run clean` - 清理构建文件
- `npm run test` - 运行测试
- `npm run lint` - 代码检查

## 目录结构

```
GSM3/
├── client/          # React前端应用
├── server/          # Node.js后端应用
├── scripts/         # 构建脚本
├── dist/           # 生产构建输出
├── package.json    # 根项目配置
└── .env.example    # 环境变量模板
```

## 注意事项

1. **端口配置**: 默认端口为3000，可通过环境变量PORT修改
2. **数据存储**: 游戏数据和配置存储在`data/`目录
3. **日志文件**: 日志存储在`logs/`目录
4. **文件上传**: 上传文件存储在`uploads/`目录
5. **安全配置**: 生产环境请务必修改JWT密钥和其他安全配置

## 故障排除

### 常见问题

1. **端口被占用**
   ```bash
   # 查看端口占用
   netstat -ano | findstr :3000
   # 或使用其他端口
   set PORT=3001 && npm start
   ```

2. **权限问题**
   ```bash
   # Linux/Mac下给启动脚本执行权限
   chmod +x start.sh
   ```

3. **依赖安装失败**
   ```bash
   # 清理缓存重新安装
   npm cache clean --force
   npm run install:all
   ```

## 更新部署

1. 停止当前服务
2. 备份数据目录
3. 部署新版本
4. 恢复数据目录
5. 重启服务

使用PM2的情况下：
```bash
pm2 stop gsm3-panel
# 部署新版本
pm2 restart gsm3-panel
```