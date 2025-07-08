const fs = require('fs-extra')
const path = require('path')
const archiver = require('archiver')
const { execSync } = require('child_process')

const packageName = 'gsm3-management-panel'
const version = require('../package.json').version
const distDir = path.join(__dirname, '..', 'dist')
const packageDir = path.join(distDir, 'package')
const outputFile = path.join(distDir, `${packageName}-v${version}.zip`)

async function createPackage() {
  try {
    console.log('🚀 开始创建生产包...')
    
    // 清理并创建目录
    await fs.remove(distDir)
    await fs.ensureDir(packageDir)
    
    console.log('📦 复制服务端文件...')
    // 复制服务端构建文件
    await fs.copy(
      path.join(__dirname, '..', 'server', 'dist'),
      path.join(packageDir, 'server')
    )
    
    // 复制服务端package.json和必要文件
    await fs.copy(
      path.join(__dirname, '..', 'server', 'package.json'),
      path.join(packageDir, 'server', 'package.json')
    )
    
    // 复制PTY文件
    await fs.copy(
      path.join(__dirname, '..', 'server', 'PTY'),
      path.join(packageDir, 'server', 'PTY')
    )
    
    // 复制环境变量配置文件
    await fs.copy(
      path.join(__dirname, '..', 'server', '.env.example'),
      path.join(packageDir, 'server', '.env.example')
    )
    
    await fs.copy(
      path.join(__dirname, '..', '.env.example'),
      path.join(packageDir, '.env.example')
    )
    
    // 创建uploads目录
    await fs.ensureDir(path.join(packageDir, 'server', 'uploads'))
    console.log('📁 创建uploads目录...')
    
    console.log('📥 安装服务端生产依赖...')
    // 在打包的服务端目录中安装生产依赖
    try {
      execSync('npm install --production --omit=dev', {
        cwd: path.join(packageDir, 'server'),
        stdio: 'inherit'
      })
      console.log('✅ 服务端依赖安装完成')
    } catch (error) {
      console.error('❌ 服务端依赖安装失败:', error)
      throw error
    }
    
    console.log('🎨 复制前端文件...')
    // 复制前端构建文件
    await fs.copy(
      path.join(__dirname, '..', 'client', 'dist'),
      path.join(packageDir, 'public')
    )
    
    console.log('📝 创建启动脚本...')
    // 创建启动脚本
    const startScript = `@echo off
echo 正在启动GSM3管理面板...
cd server
node_app.exe index.js
pause`
    
    await fs.writeFile(
      path.join(packageDir, 'start.bat'),
      startScript
    )
    
    // 创建Linux启动脚本
    const startShScript = `#!/bin/bash
echo "正在启动GSM3管理面板..."
cd server
/opt/node-v22.17.0-linux-x64/bin/node index.js`
    
    await fs.writeFile(
      path.join(packageDir, 'start.sh'),
      startShScript
    )
    
    // 设置执行权限
    try {
      execSync(`chmod +x "${path.join(packageDir, 'start.sh')}"`)
    } catch (e) {
      // Windows环境下忽略chmod错误
    }
    
    console.log('📋 创建说明文件...')
    // 创建README
    const readme = `# GSM3 游戏服务端管理面板

## 安装说明

1. 确保已安装 Node.js (版本 >= 18)
2. 解压缩包到目标目录
3. (可选) 配置端口和其他参数:
   - 复制 .env.example 为 .env 并修改 SERVER_PORT 等配置
   - 复制 server/.env.example 为 server/.env 并配置详细参数
4. 运行启动脚本:
   - Windows: 双击 start.bat
   - Linux/Mac: 运行 ./start.sh

## 默认访问地址

http://localhost:3001

## 端口配置

- 修改根目录 .env 文件中的 SERVER_PORT 可以更改服务端口
- 修改后需要重启服务才能生效
- 确保防火墙允许新端口访问

## 注意事项

- 依赖已预装，无需手动安装
- 首次运行会自动创建默认管理员账户 (admin/admin123)
- 请立即登录并修改默认密码
- 确保防火墙允许相关端口访问
- 建议在生产环境中使用 PM2 等进程管理工具

版本: ${version}
构建时间: ${new Date().toLocaleString('zh-CN')}`
    
    await fs.writeFile(
      path.join(packageDir, 'README.md'),
      readme
    )
    
    console.log('🗜️ 创建压缩包...')
    // 创建ZIP压缩包
    await createZip(packageDir, outputFile)
    
    console.log('✅ 打包完成!')
    console.log(`📦 输出文件: ${outputFile}`)
    console.log(`📁 包大小: ${(await fs.stat(outputFile)).size / 1024 / 1024} MB`)
    
  } catch (error) {
    console.error('❌ 打包失败:', error)
    process.exit(1)
  }
}

function createZip(sourceDir, outputFile) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputFile)
    const archive = archiver('zip', {
      zlib: { level: 9 } // 最高压缩级别
    })
    
    output.on('close', () => {
      resolve()
    })
    
    archive.on('error', (err) => {
      reject(err)
    })
    
    archive.pipe(output)
    archive.directory(sourceDir, false)
    archive.finalize()
  })
}

// 运行打包
createPackage()