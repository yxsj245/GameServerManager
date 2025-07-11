# Python环境配置指南

## 使用国内镜像源加速Python包安装

本项目已配置使用国内镜像源来加速Python包的安装。以下是相关配置说明：

### 自动配置

项目在安装Python依赖时会自动使用清华大学镜像源：
- 服务端自动安装：使用 `-i https://pypi.tuna.tsinghua.edu.cn/simple/`
- 打包脚本：包含国内镜像源配置
- 安装脚本：Windows和Linux版本都已配置国内源

### 手动配置全局pip镜像源

如果您希望为整个系统配置pip镜像源，可以按照以下步骤操作：

#### Windows系统

1. 创建pip配置目录：
   ```cmd
   mkdir %APPDATA%\pip
   ```

2. 复制配置文件：
   ```cmd
   copy pip.conf %APPDATA%\pip\pip.ini
   ```

#### Linux/macOS系统

1. 创建pip配置目录：
   ```bash
   mkdir -p ~/.config/pip
   ```

2. 复制配置文件：
   ```bash
   cp pip.conf ~/.config/pip/pip.conf
   ```

### 可用的国内镜像源

1. **清华大学镜像源**（推荐）
   ```
   https://pypi.tuna.tsinghua.edu.cn/simple/
   ```

2. **阿里云镜像源**
   ```
   https://mirrors.aliyun.com/pypi/simple/
   ```

3. **豆瓣镜像源**
   ```
   https://pypi.douban.com/simple/
   ```

4. **中科大镜像源**
   ```
   https://pypi.mirrors.ustc.edu.cn/simple/
   ```

### 临时使用镜像源

如果只想临时使用镜像源安装某个包，可以使用以下命令：

```bash
pip install package_name -i https://pypi.tuna.tsinghua.edu.cn/simple/ --trusted-host pypi.tuna.tsinghua.edu.cn
```

### 验证配置

安装完成后，可以通过以下命令验证pip配置：

```bash
pip config list
```

### 故障排除

1. **网络连接问题**：如果某个镜像源无法访问，可以尝试其他镜像源
2. **SSL证书问题**：使用 `--trusted-host` 参数信任镜像源域名
3. **超时问题**：配置文件中已设置60秒超时和5次重试

### 项目依赖

本项目的Python依赖包括：
- ruamel.yaml>=0.17.0
- pyhocon>=0.3.59
- toml>=0.10.2
- configobj>=5.0.6
- Flask>=2.0.0

这些依赖会在项目启动时自动安装，使用配置的国内镜像源。