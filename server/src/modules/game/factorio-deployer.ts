import axios from 'axios';
import express, { Request, Response } from 'express';
import * as fs from 'fs-extra';
import { createWriteStream } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';
import { exec } from 'child_process';

// ==================== 接口定义 ====================

export interface DeploymentOptions {
  extractPath: string;
  tempDir?: string;
}

export interface DeploymentResult {
  success: boolean;
  message: string;
  extractPath?: string;
  serverExecutablePath?: string;
}

export interface ApiServerOptions {
  port?: number;
  host?: string;
}

// ==================== Factorio部署器类 ====================

export class FactorioDeployer {
  private readonly downloadUrl = 'https://factorio.com/get-download/stable/headless/linux64';
  private readonly defaultTempDir = os.tmpdir();

  /**
   * 部署Factorio服务端
   * @param options 部署选项
   * @returns 部署结果
   */
  async deploy(options: DeploymentOptions): Promise<DeploymentResult> {
    try {
      const tempDir = options.tempDir || this.defaultTempDir;
      const tempFilePath = path.join(tempDir, `factorio-server-${Date.now()}.tar.xz`);

      // 1. 下载服务端压缩包
      console.log('正在下载Factorio服务端...');
      await this.downloadServer(tempFilePath);

      // 2. 确保解压目录存在
      await fs.ensureDir(options.extractPath);

      // 3. 解压文件
      console.log('正在解压文件...');
      await this.extractServer(tempFilePath, options.extractPath);

      // 4. 清理临时文件
      await fs.remove(tempFilePath);

      // 5. 查找服务端可执行文件
      const serverExecutablePath = await this.findServerExecutable(options.extractPath);

      return {
        success: true,
        message: 'Factorio服务端部署成功',
        extractPath: options.extractPath,
        serverExecutablePath
      };
    } catch (error) {
      return {
        success: false,
        message: `部署失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 下载服务端文件
   * @param filePath 保存路径
   */
  private async downloadServer(filePath: string): Promise<void> {
    const response = await axios({
      method: 'GET',
      url: this.downloadUrl,
      responseType: 'stream',
      timeout: 300000, // 5分钟超时
    });

    const writer = createWriteStream(filePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }

  /**
   * 解压服务端文件
   * @param archivePath 压缩包路径
   * @param extractPath 解压路径
   */
  private async extractServer(archivePath: string, extractPath: string): Promise<void> {
    // 注意：这里假设下载的是tar.xz格式，实际可能需要根据真实格式调整
    // 由于yauzl主要用于zip文件，这里我们需要使用其他方法处理tar.xz
    // 简化处理，假设系统有tar命令可用
    const execPromise = promisify(exec);
    
    try {
      // 尝试使用tar命令解压
      await execPromise(`tar -xf "${archivePath}" -C "${extractPath}"`);
    } catch (error) {
      // 如果tar命令不可用，抛出错误
      throw new Error(`解压失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 查找服务端可执行文件
   * @param extractPath 解压路径
   * @returns 可执行文件路径
   */
  private async findServerExecutable(extractPath: string): Promise<string | undefined> {
    const possiblePaths = [
      path.join(extractPath, 'factorio', 'bin', 'x64', 'factorio'),
      path.join(extractPath, 'bin', 'x64', 'factorio'),
      path.join(extractPath, 'factorio')
    ];

    for (const execPath of possiblePaths) {
      if (await fs.pathExists(execPath)) {
        return execPath;
      }
    }

    return undefined;
  }

  /**
   * 检查部署状态
   * @param extractPath 解压路径
   * @returns 是否已部署
   */
  async checkDeployment(extractPath: string): Promise<boolean> {
    const serverExecutable = await this.findServerExecutable(extractPath);
    return serverExecutable !== undefined;
  }

  /**
   * 获取服务端版本信息
   * @param extractPath 解压路径
   * @returns 版本信息
   */
  async getServerVersion(extractPath: string): Promise<string | null> {
    try {
      const serverExecutable = await this.findServerExecutable(extractPath);
      if (!serverExecutable) {
        return null;
      }

      const execPromise = promisify(exec);
      const { stdout } = await execPromise(`"${serverExecutable}" --version`);
      
      return stdout.trim();
    } catch (error) {
      return null;
    }
  }
}

// ==================== API服务器类 ====================

export class ApiServer {
  private app: express.Application;
  private deployer: FactorioDeployer;
  private port: number;
  private host: string;

  constructor(options: ApiServerOptions = {}) {
    this.app = express();
    this.deployer = new FactorioDeployer();
    this.port = options.port || 3000;
    this.host = options.host || 'localhost';
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // CORS支持
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });
  }

  private setupRoutes(): void {
    // 健康检查
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // 部署服务端
    this.app.post('/deploy', async (req: Request, res: Response) => {
      try {
        const { extractPath, tempDir } = req.body;
        
        if (!extractPath) {
          return res.status(400).json({
            success: false,
            message: '缺少必需参数: extractPath'
          });
        }

        const options: DeploymentOptions = {
          extractPath: path.resolve(extractPath),
          tempDir: tempDir ? path.resolve(tempDir) : undefined
        };

        const result = await this.deployer.deploy(options);
        
        if (result.success) {
          return res.json(result);
        } else {
          return res.status(500).json(result);
        }
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: `服务器错误: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    });

    // 检查部署状态
    this.app.get('/status/:extractPath(*)', async (req: Request, res: Response) => {
      try {
        const extractPath = req.params.extractPath;
        
        if (!extractPath) {
          return res.status(400).json({
            success: false,
            message: '缺少必需参数: extractPath'
          });
        }

        const isDeployed = await this.deployer.checkDeployment(path.resolve(extractPath));
        
        return res.json({
          success: true,
          deployed: isDeployed,
          extractPath: path.resolve(extractPath)
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: `服务器错误: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    });

    // 获取服务端版本
    this.app.get('/version/:extractPath(*)', async (req: Request, res: Response) => {
      try {
        const extractPath = req.params.extractPath;
        
        if (!extractPath) {
          return res.status(400).json({
            success: false,
            message: '缺少必需参数: extractPath'
          });
        }

        const version = await this.deployer.getServerVersion(path.resolve(extractPath));
        
        return res.json({
          success: true,
          version: version,
          extractPath: path.resolve(extractPath)
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: `服务器错误: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    });

    // API文档
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        name: 'Factorio Server Deployer API',
        version: '1.0.0',
        endpoints: {
          'GET /health': '健康检查',
          'POST /deploy': '部署服务端 - Body: { extractPath: string, tempDir?: string }',
          'GET /status/:extractPath': '检查部署状态',
          'GET /version/:extractPath': '获取服务端版本'
        }
      });
    });
  }

  /**
   * 启动API服务器
   */
  start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.port, this.host, () => {
        console.log(`Factorio部署API服务器已启动: http://${this.host}:${this.port}`);
        resolve();
      });
    });
  }

  /**
   * 获取Express应用实例
   */
  getApp(): express.Application {
    return this.app;
  }
}

// ==================== 使用示例 ====================

/**
 * 示例1: 直接使用FactorioDeployer类
 */
export async function directUsageExample() {
  console.log('=== 直接使用示例 ===');
  
  const deployer = new FactorioDeployer();
  
  // 部署到指定路径
  const result = await deployer.deploy({
    extractPath: path.join(__dirname, '../factorio-server'),
    tempDir: path.join(__dirname, '../temp')
  });
  
  console.log('部署结果:', result);
  
  if (result.success) {
    // 检查部署状态
    const isDeployed = await deployer.checkDeployment(result.extractPath!);
    console.log('部署状态:', isDeployed);
    
    // 获取版本信息
    const version = await deployer.getServerVersion(result.extractPath!);
    console.log('服务端版本:', version);
  }
}

/**
 * 示例2: 使用API服务器
 */
export async function apiServerExample() {
  console.log('=== API服务器示例 ===');
  
  const server = new ApiServer({
    port: 3001,
    host: 'localhost'
  });
  
  await server.start();
  
  console.log('API服务器已启动，可以通过以下方式调用:');
  console.log('POST http://localhost:3001/deploy');
  console.log('Body: { "extractPath": "./factorio-server", "tempDir": "./temp" }');
  console.log('');
  console.log('GET http://localhost:3001/status/factorio-server');
  console.log('GET http://localhost:3001/version/factorio-server');
}

/**
 * 示例3: 在其他项目中作为依赖使用
 */
export class MyFactorioManager {
  private deployer: FactorioDeployer;
  
  constructor() {
    this.deployer = new FactorioDeployer();
  }
  
  async setupServer(serverPath: string): Promise<boolean> {
    try {
      const result = await this.deployer.deploy({
        extractPath: serverPath
      });
      
      return result.success;
    } catch (error) {
      console.error('设置服务器失败:', error);
      return false;
    }
  }
  
  async isServerReady(serverPath: string): Promise<boolean> {
    return await this.deployer.checkDeployment(serverPath);
  }
}

// ==================== 主入口 ====================

// // 如果直接运行此文件，启动API服务器
// if (require.main === module) {
//   const server = new ApiServer({
//     port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
//     host: process.env.HOST || 'localhost'
//   });
  
//   server.start().then(() => {
//     console.log('Factorio部署服务已启动');
//   }).catch((error: Error) => {
//     console.error('启动失败:', error);
//     process.exit(1);
//   });
// }