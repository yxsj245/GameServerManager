import { spawn } from 'child_process'
import { promisify } from 'util'
import { exec } from 'child_process'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import logger from './logger.js'

const execAsync = promisify(exec)

// 获取当前文件的目录路径（ES模块兼容）
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Python脚本路径
const PYTHON_SCRIPT_PATH = path.join(__dirname, '..', 'Python', 'game_config_manager.py')

// Python环境状态管理
let pythonDepsInstalled = false
let pythonEnvironmentFailed = false
let pythonFailureCount = 0
const MAX_PYTHON_RETRY_COUNT = 3

/**
 * Python管理器类
 */
export class PythonManager {
  /**
   * 获取正确的Python命令
   */
  private static getPythonCommand(): string {
    const platform = os.platform()
    if (platform === 'win32') {
      return 'python'
    } else {
      return 'python3'
    }
  }

  /**
   * 检查Python命令是否可用
   */
  private static checkPythonCommand(command: string): Promise<boolean> {
    return new Promise((resolve) => {
      const testProcess = spawn(command, ['--version'], { stdio: 'ignore' })
      
      testProcess.on('close', (code) => {
        resolve(code === 0)
      })
      
      testProcess.on('error', () => {
        resolve(false)
      })
    })
  }

  /**
   * 获取可用的Python命令
   */
  public static async getAvailablePythonCommand(): Promise<string> {
    const platform = os.platform()
    
    if (platform === 'win32') {
      // Windows平台优先尝试python，然后尝试python3
      const commands = ['python', 'python3']
      for (const cmd of commands) {
        if (await this.checkPythonCommand(cmd)) {
          logger.info(`Windows平台使用Python命令: ${cmd}`)
          return cmd
        }
      }
    } else {
      // Linux/macOS平台优先尝试python3，然后尝试python
      const commands = ['python3', 'python']
      for (const cmd of commands) {
        if (await this.checkPythonCommand(cmd)) {
          logger.info(`${platform}平台使用Python命令: ${cmd}`)
          return cmd
        }
      }
    }
    
    throw new Error('未找到可用的Python命令')
  }

  /**
   * 调用Python脚本的辅助函数
   */
  public static callPythonScript(method: string, args: any[] = []): Promise<any> {
    return new Promise(async (resolve, reject) => {
      try {
        // 动态获取可用的Python命令
        const pythonCommand = await this.getAvailablePythonCommand()
        logger.info(`使用Python命令: ${pythonCommand}`)
        
        const pythonArgs = [PYTHON_SCRIPT_PATH, method, ...args.map(arg => JSON.stringify(arg))]
        const pythonProcess = spawn(pythonCommand, pythonArgs, {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            PYTHONIOENCODING: 'utf-8'
          }
        })

        let stdout = ''
        let stderr = ''

        pythonProcess.stdout.on('data', (data) => {
          stdout += data.toString('utf8')
        })

        pythonProcess.stderr.on('data', (data) => {
          stderr += data.toString('utf8')
        })

        pythonProcess.on('close', (code) => {
          // 记录Python脚本的stderr输出（包含日志信息）
          if (stderr) {
            logger.info(`Python脚本日志: ${stderr}`)
          }
          
          if (code === 0) {
            try {
              const result = JSON.parse(stdout)
              resolve(result)
            } catch (error) {
              logger.error(`JSON解析失败: ${error}, stdout: ${stdout}`)
              reject(new Error(`JSON解析失败: ${error}`))
            }
          } else {
            logger.error(`Python脚本执行失败，退出码: ${code}, stderr: ${stderr}, stdout: ${stdout}`)
            reject(new Error(`Python脚本执行失败: ${stderr}`))
          }
        })

        pythonProcess.on('error', (error) => {
          logger.error(`Python进程启动失败: ${error.message}`)
          reject(new Error(`启动Python进程失败: ${error.message}`))
        })
       } catch (error) {
         reject(error)
       }
     })
   }

  /**
   * 检查Python环境
   */
  public static async checkPythonEnvironment(): Promise<{
    available: boolean
    version?: string
    command?: string
    platform: string
    error?: string
  }> {
    try {
      const platform = os.platform()
      
      logger.info(`检测Python环境，平台: ${platform}`)
      
      // 使用动态检测获取可用的Python命令
      const pythonCommand = await this.getAvailablePythonCommand()
      
      logger.info(`检测Python环境，平台: ${platform}，使用命令: ${pythonCommand}`)
      
      const { stdout } = await execAsync(`${pythonCommand} --version`)
      const version = stdout.trim()
      
      logger.info(`Python环境检测成功: ${version}`)
      
      return {
        available: true,
        version: version,
        command: pythonCommand,
        platform: platform
      }
    } catch (error: any) {
      logger.error('Python环境检测异常:', error)
      
      return {
        available: false,
        error: `未检测到Python环境: ${error.message}`,
        platform: os.platform()
      }
    }
  }

  /**
   * 获取可用的游戏配置文件列表
   */
  public static async getAvailableConfigs(): Promise<any> {
    return await this.callPythonScript('get_available_configs')
  }

  /**
   * 获取指定游戏配置的模板结构
   */
  public static async getConfigSchema(configId: string): Promise<any> {
    return await this.callPythonScript('get_config_schema', [configId])
  }

  /**
   * 读取游戏配置文件
   */
  public static async readGameConfig(
    workingDirectory: string,
    schema: any,
    parser: string = 'configobj'
  ): Promise<any> {
    return await this.callPythonScript('read_game_config', [
      workingDirectory,
      schema,
      parser
    ])
  }

  /**
   * 保存游戏配置文件
   */
  public static async saveGameConfig(
    workingDirectory: string,
    schema: any,
    configData: any,
    parser: string = 'configobj'
  ): Promise<any> {
    return await this.callPythonScript('save_game_config', [
      workingDirectory,
      schema,
      configData,
      parser
    ])
  }
}

// 导出默认实例
export default PythonManager