# GitHub Actions 构建说明

本项目使用 GitHub Actions 自动构建不同平台的发布包。

## 手动触发构建

1. 进入 GitHub 仓库页面
2. 点击 "Actions" 标签页
3. 选择 "Build Package" 工作流
4. 点击 "Run workflow" 按钮
5. 选择要构建的平台：
   - **all**: 同时构建 Linux 和 Windows 版本
   - **linux**: 仅构建 Linux 版本
   - **windows**: 仅构建 Windows 版本
6. 点击 "Run workflow" 开始构建

## 自动触发构建

### 标签推送触发
当推送以 `v` 开头的标签时，会自动触发构建所有平台：

```bash
git tag v1.0.0
git push origin v1.0.0
```

### 发布触发
当创建 GitHub Release 时，也会自动触发构建。

## 构建产物

构建完成后，会生成以下文件：

- **Linux 版本**: `gsm3-management-panel-linux.tar.gz`
- **Windows 版本**: `gsm3-management-panel-windows.zip`

### 下载构建产物

1. 在 Actions 页面找到对应的构建任务
2. 点击进入构建详情页面
3. 在 "Artifacts" 部分下载对应的构建包

### 自动发布

当推送标签触发构建时，构建完成后会自动创建 GitHub Release，并将构建产物附加到发布中。

## 构建内容

每个构建包包含：

- 编译后的服务端代码
- 构建后的前端静态文件
- Python 脚本和依赖配置
- PTY 可执行文件
- 启动脚本（Windows: `start.bat`, Linux: `start.sh`）
- Python 依赖安装脚本
- 使用说明文档

## 注意事项

- 构建产物会保留 30 天
- 确保项目的 `package.json` 中包含正确的构建脚本
- Linux 构建在 Ubuntu 环境中进行
- Windows 构建在 Windows Server 环境中进行
- 构建过程会自动安装所有必要的依赖