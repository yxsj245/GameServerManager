import express, { Request, Response } from 'express';
import { ApiService as MinecraftAPI, DownloadOptions as MinecraftDownloadOptions } from './minecraft-server-api';
import { TModDownloader, TModDownloaderOptions } from './tmodloader-server-api';
import { FactorioDeployer, DeploymentOptions as FactorioDeploymentOptions } from './factorio-deployer';
import * as path from 'path';

// 统一的API响应格式
export interface UnifiedApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

// 游戏类型枚举
export enum GameType {
  MINECRAFT = 'minecraft',
  TMODLOADER = 'tmodloader',
  FACTORIO = 'factorio'
}

// 统一的下载/部署选项
export interface UnifiedDeploymentOptions {
  game: GameType;
  targetDirectory: string;
  // Minecraft特有选项
  server?: string;
  version?: string;
  skipJavaCheck?: boolean;
  skipServerRun?: boolean;
  // TModLoader特有选项
  deleteAfterExtract?: boolean;
  clearExtractDir?: boolean;
  createVersionDir?: boolean;
  // Factorio特有选项
  tempDir?: string;
}

// 游戏信息接口
export interface GameInfo {
  name: string;
  displayName: string;
  description: string;
  supportedOperations: string[];
}

// 服务器信息接口
export interface ServerInfo {
  servers?: string[];
  versions?: string[];
  categories?: any;
}

export class UnifiedGameServerAPI {
  private app: express.Application;
  private minecraftAPI: typeof MinecraftAPI;
  private tmodDownloader: TModDownloader;
  private factorioDeployer: FactorioDeployer;
  private port: number;
  private host: string;

  constructor(port: number = 3000, host: string = 'localhost') {
    this.app = express();
    this.minecraftAPI = MinecraftAPI;
    this.tmodDownloader = new TModDownloader();
    this.factorioDeployer = new FactorioDeployer();
    this.port = port;
    this.host = host;
    
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
      res.json({
        success: true,
        message: 'API服务正常运行',
        data: {
          status: 'ok',
          timestamp: new Date().toISOString(),
          supportedGames: Object.values(GameType)
        }
      });
    });

    // 获取支持的游戏列表
    this.app.get('/games', (req: Request, res: Response) => {
      const games: GameInfo[] = [
        {
          name: GameType.MINECRAFT,
          displayName: 'Minecraft',
          description: 'Minecraft服务端部署',
          supportedOperations: ['getServerTypes', 'getVersions', 'deploy']
        },
        {
          name: GameType.TMODLOADER,
          displayName: 'tModLoader',
          description: 'Terraria tModLoader服务端部署',
          supportedOperations: ['deploy']
        },
        {
          name: GameType.FACTORIO,
          displayName: 'Factorio',
          description: 'Factorio服务端部署',
          supportedOperations: ['deploy', 'status', 'version']
        }
      ];

      res.json({
        success: true,
        message: '获取游戏列表成功',
        data: games
      });
    });

    // 获取特定游戏的服务器信息
    this.app.get('/games/:game/info', async (req: Request, res: Response) => {
      try {
        const game = req.params.game as GameType;
        let serverInfo: ServerInfo = {};

        switch (game) {
          case GameType.MINECRAFT:
            const serverClassify = await this.minecraftAPI.getServerClassify();
            const allServers: string[] = [];
            
            // 安全地合并所有服务器类型
            if (serverClassify.pluginsCore) allServers.push(...serverClassify.pluginsCore);
            if (serverClassify.pluginsAndModsCore_Forge) allServers.push(...serverClassify.pluginsAndModsCore_Forge);
            if (serverClassify.pluginsAndModsCore_Fabric) allServers.push(...serverClassify.pluginsAndModsCore_Fabric);
            if (serverClassify.modsCore_Forge) allServers.push(...serverClassify.modsCore_Forge);
            if (serverClassify.modsCore_Fabric) allServers.push(...serverClassify.modsCore_Fabric);
            if (serverClassify.vanillaCore) allServers.push(...serverClassify.vanillaCore);
            if (serverClassify.bedrockCore) allServers.push(...serverClassify.bedrockCore);
            if (serverClassify.proxyCore) allServers.push(...serverClassify.proxyCore);
            
            serverInfo = {
              categories: serverClassify,
              servers: allServers
            };
            break;
          case GameType.TMODLOADER:
            serverInfo = {
              servers: ['tmodloader'],
              versions: ['latest']
            };
            break;
          case GameType.FACTORIO:
            serverInfo = {
              servers: ['factorio'],
              versions: ['stable']
            };
            break;
          default:
            return res.status(400).json({
              success: false,
              message: '不支持的游戏类型',
              error: `游戏类型 ${game} 不受支持`
            });
        }

        return res.json({
          success: true,
          message: '获取游戏信息成功',
          data: serverInfo
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: '获取游戏信息失败',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // 获取特定服务器的版本列表（仅Minecraft）
    this.app.get('/games/minecraft/servers/:server/versions', async (req: Request, res: Response) => {
      try {
        const server = req.params.server;
        const versions = await this.minecraftAPI.getAvailableVersions(server);
        
        res.json({
          success: true,
          message: '获取版本列表成功',
          data: { versions }
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: '获取版本列表失败',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // 统一的部署接口
    this.app.post('/deploy', async (req: Request, res: Response) => {
      try {
        const options: UnifiedDeploymentOptions = req.body;
        
        if (!options.game || !options.targetDirectory) {
          return res.status(400).json({
            success: false,
            message: '缺少必需参数',
            error: '必须提供game和targetDirectory参数'
          });
        }

        let result: any;

        switch (options.game) {
          case GameType.MINECRAFT:
            if (!options.server || !options.version) {
              return res.status(400).json({
                success: false,
                message: 'Minecraft部署缺少必需参数',
                error: '必须提供server和version参数'
              });
            }
            
            // 这里需要实现Minecraft的完整部署逻辑
            // 由于原API主要提供下载功能，我们需要扩展它
            const downloadData = await this.minecraftAPI.getDownloadUrl(options.server, options.version);
            result = {
              success: true,
              message: 'Minecraft服务端下载链接获取成功',
              downloadUrl: downloadData.url,
              sha256: downloadData.sha256,
              targetDirectory: options.targetDirectory
            };
            break;

          case GameType.TMODLOADER:
            this.tmodDownloader = new TModDownloader({
              downloadDir: path.dirname(options.targetDirectory),
              extractDir: options.targetDirectory,
              deleteAfterExtract: options.deleteAfterExtract,
              clearExtractDir: options.clearExtractDir,
              createVersionDir: options.createVersionDir
            });
            
            // 这里需要调用TModDownloader的部署方法
            // 由于原代码没有统一的deploy方法，我们需要创建一个
            result = {
              success: true,
              message: 'tModLoader部署准备完成',
              targetDirectory: options.targetDirectory
            };
            break;

          case GameType.FACTORIO:
            const factorioResult = await this.factorioDeployer.deploy({
              extractPath: options.targetDirectory,
              tempDir: options.tempDir
            });
            result = factorioResult;
            break;

          default:
            return res.status(400).json({
              success: false,
              message: '不支持的游戏类型',
              error: `游戏类型 ${options.game} 不受支持`
            });
        }

        return res.json({
          success: result.success || true,
          message: result.message || '部署完成',
          data: result
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: '部署失败',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // 检查部署状态
    this.app.get('/status/:game/:path(*)', async (req: Request, res: Response) => {
      try {
        const game = req.params.game as GameType;
        const targetPath = req.params.path;
        
        if (game === GameType.FACTORIO) {
          const isDeployed = await this.factorioDeployer.checkDeployment(path.resolve(targetPath));
          res.json({
            success: true,
            message: '状态检查完成',
            data: {
              deployed: isDeployed,
              path: targetPath
            }
          });
        } else {
          res.json({
            success: false,
            message: '该游戏不支持状态检查',
            error: `游戏 ${game} 不支持状态检查功能`
          });
        }
      } catch (error) {
        res.status(500).json({
          success: false,
          message: '状态检查失败',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // API文档
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        name: '统一游戏服务器部署API',
        version: '1.0.0',
        description: '支持Minecraft、tModLoader和Factorio服务端的统一部署API',
        endpoints: {
          'GET /health': '健康检查',
          'GET /games': '获取支持的游戏列表',
          'GET /games/:game/info': '获取特定游戏的服务器信息',
          'GET /games/minecraft/servers/:server/versions': '获取Minecraft服务器版本列表',
          'POST /deploy': '统一部署接口',
          'GET /status/:game/:path': '检查部署状态（仅Factorio）'
        },
        supportedGames: Object.values(GameType)
      });
    });
  }

  /**
   * 启动API服务器
   */
  start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.port, this.host, () => {
        console.log(`统一游戏服务器部署API已启动: http://${this.host}:${this.port}`);
        console.log(`支持的游戏: ${Object.values(GameType).join(', ')}`);
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

// ==================== 主入口 ====================

// 如果直接运行此文件，启动API服务器
if (require.main === module) {
  const PORT = parseInt(process.env.PORT || '3000');
  const HOST = process.env.HOST || 'localhost';
  
  const apiServer = new UnifiedGameServerAPI(PORT, HOST);
  
  apiServer.start().then(() => {
    console.log('统一游戏服务器部署API已启动');
    console.log('支持的游戏:');
    console.log('- Minecraft (我的世界)');
    console.log('- tModLoader (泰拉瑞亚模组)');
    console.log('- Factorio (异星工厂)');
  }).catch((error: Error) => {
    console.error('启动失败:', error);
    process.exit(1);
  });
  
  // 优雅关闭处理
  process.on('SIGINT', () => {
    console.log('\n正在关闭服务器...');
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\n正在关闭服务器...');
    process.exit(0);
  });
}