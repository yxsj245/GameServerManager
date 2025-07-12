import axios from 'axios';
import express, { Request, Response } from 'express';
import * as fs from 'fs-extra';
import { createWriteStream } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';

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
  private cancelled: boolean = false;
  private currentProcess?: any;
  private currentDownloadController?: AbortController;

  /**
   * 取消当前部署操作
   */
  cancel(): void {
    this.cancelled = true;
    
    // 终止当前进程
    if (this.currentProcess && !this.currentProcess.killed) {
      this.currentProcess.kill('SIGTERM');
      
      // 等待一段时间后强制终止
      setTimeout(() => {
        if (this.currentProcess && !this.currentProcess.killed) {
          this.currentProcess.kill('SIGKILL');
        }
      }, 5000);
    }
    
    // 取消当前下载
    if (this.currentDownloadController) {
      this.currentDownloadController.abort();
    }
    
    console.log('Factorio服务端部署已取消');
  }

  /**
   * 检查是否已取消
   */
  isCancelled(): boolean {
    return this.cancelled;
  }

  /**
   * 部署Factorio服务端
   * @param options 部署选项
   * @returns 部署结果
   */
  async deploy(options: DeploymentOptions): Promise<DeploymentResult> {
    this.cancelled = false; // 重置取消状态
    
    const tempDir = options.tempDir || this.defaultTempDir;
    const tempFilePath = path.join(tempDir, `factorio-server-${Date.now()}.tar.xz`);
    
    try {
      // 检查是否已取消
      if (this.cancelled) {
        throw new Error('操作已取消');
      }

      // 1. 下载服务端压缩包
      console.log('正在下载Factorio服务端...');
      await this.downloadServer(tempFilePath);

      // 检查是否已取消
      if (this.cancelled) {
        throw new Error('操作已取消');
      }

      // 2. 确保解压目录存在
      await fs.ensureDir(options.extractPath);

      // 3. 解压文件
      console.log('正在解压文件...');
      await this.extractServer(tempFilePath, options.extractPath);

      // 检查是否已取消
      if (this.cancelled) {
        throw new Error('操作已取消');
      }

      // 4. 清理临时文件
      await fs.remove(tempFilePath);
      
      // 5. 清理临时目录（如果指定了tempDir）
      if (options.tempDir && await fs.pathExists(options.tempDir)) {
        try {
          await fs.remove(options.tempDir);
          console.log(`已清理临时目录: ${options.tempDir}`);
        } catch (error) {
          console.warn('清理临时目录时出错:', error);
        }
      }

      // 6. 查找服务端可执行文件
      const serverExecutablePath = await this.findServerExecutable(options.extractPath);

      return {
        success: true,
        message: 'Factorio服务端部署成功',
        extractPath: options.extractPath,
        serverExecutablePath
      };
    } catch (error) {
      // 清理临时文件和目录
      try {
        if (await fs.pathExists(tempFilePath)) {
          await fs.remove(tempFilePath);
        }
        if (options.tempDir && await fs.pathExists(options.tempDir)) {
          await fs.remove(options.tempDir);
        }
      } catch (cleanupError) {
        console.warn('清理临时文件时出错:', cleanupError);
      }
      
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
    // 检查是否已取消
    if (this.cancelled) {
      throw new Error('操作已取消');
    }

    this.currentDownloadController = new AbortController();
    
    const response = await axios({
      method: 'GET',
      url: this.downloadUrl,
      responseType: 'stream',
      timeout: 300000, // 5分钟超时
      signal: this.currentDownloadController.signal
    });

    const writer = createWriteStream(filePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        if (this.cancelled) {
          fs.unlink(filePath).catch(() => {});
          reject(new Error('操作已取消'));
          return;
        }
        resolve();
      });
      
      writer.on('error', (error) => {
        fs.unlink(filePath).catch(() => {});
        reject(error);
      });
      
      response.data.on('error', (error: any) => {
        if (error.name === 'AbortError') {
          fs.unlink(filePath).catch(() => {});
          reject(new Error('操作已取消'));
        } else {
          reject(error);
        }
      });
    });
  }

  /**
   * 解压服务端文件
   * @param archivePath 压缩包路径
   * @param extractPath 解压路径
   */
  private async extractServer(archivePath: string, extractPath: string): Promise<void> {
    // 检查是否已取消
    if (this.cancelled) {
      throw new Error('操作已取消');
    }

    // 注意：这里假设下载的是tar.xz格式，实际可能需要根据真实格式调整
    // 由于yauzl主要用于zip文件，这里我们需要使用其他方法处理tar.xz
    // 简化处理，假设系统有tar命令可用
    const { spawn } = require('child_process');
    
    return new Promise((resolve, reject) => {
      const extractProcess = spawn('tar', ['-xf', archivePath, '-C', extractPath], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.currentProcess = extractProcess;

      extractProcess.on('close', (code: number) => {
        this.currentProcess = undefined;
        
        if (this.cancelled) {
          reject(new Error('操作已取消'));
          return;
        }

        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`解压失败，退出码: ${code}`));
        }
      });

      extractProcess.on('error', (error: Error) => {
        this.currentProcess = undefined;
        reject(new Error(`解压过程出错: ${error.message}`));
      });
    });
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

      const { exec } = require('child_process');
      const execPromise = promisify(exec);
      const { stdout } = await execPromise(`"${serverExecutable}" --version`);
      
      return stdout.trim();
    } catch (error) {
      return null;
    }
  }
}