import { Router, Request, Response } from 'express'
import { InstanceManager } from '../modules/instance/InstanceManager.js'
import { authenticateToken } from '../middleware/auth.js'
import logger from '../utils/logger.js'
import os from 'os'
import https from 'https'
import http from 'http'
import { spawn, exec } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import { promisify } from 'util'

const execAsync = promisify(exec)

const router = Router()

// 注意：这里需要在实际使用时注入InstanceManager实例
let instanceManager: InstanceManager

// 设置InstanceManager实例的函数
export function setInstanceManager(manager: InstanceManager) {
  instanceManager = manager
}

// 获取所有实例
router.get('/', authenticateToken, (req: Request, res: Response) => {
  try {
    if (!instanceManager) {
      return res.status(500).json({ 
        success: false, 
        error: '实例管理器未初始化' 
      })
    }
    
    const instances = instanceManager.getInstances()
    res.json({
      success: true,
      data: instances
    })
  } catch (error: any) {
    logger.error('获取实例列表失败:', error)
    res.status(500).json({
      success: false,
      error: '获取实例列表失败',
      message: error.message
    })
  }
})

// 获取实例市场列表
router.get('/market', authenticateToken, async (req: Request, res: Response) => {
  try {
    // 确定系统类型
    const platform = os.platform()
    let systemType = 'Linux'
    if (platform === 'win32') {
      systemType = 'Windows'
    }
    
    // 请求第二个服务获取实例市场数据
    const marketUrl = `http://langlangy.server.xiaozhuhouses.asia:10002/api/instances?system_type=${systemType}`
    
    logger.info(`请求实例市场数据: ${marketUrl}`)
    
    // 使用Promise包装http请求
    const marketData = await new Promise((resolve, reject) => {
      const url = new URL(marketUrl)
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'GSM3-Server/1.0'
        }
      }
      
      const req = http.request(options, (response) => {
        let data = ''
        
        response.on('data', (chunk) => {
          data += chunk
        })
        
        response.on('end', () => {
           try {
             if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
               const jsonData = JSON.parse(data)
               resolve(jsonData)
             } else {
               logger.error(`API请求失败 - 状态码: ${response.statusCode}, 响应内容: ${data}`)
               reject(new Error(`HTTP error! status: ${response.statusCode}, response: ${data}`))
             }
           } catch (parseError) {
             logger.error(`JSON解析失败: ${parseError}, 原始数据: ${data}`)
             reject(new Error(`JSON parse error: ${parseError}`))
           }
         })
      })
      
      req.on('error', (error) => {
        reject(error)
      })
      
      req.setTimeout(10000, () => {
        req.destroy()
        reject(new Error('Request timeout'))
      })
      
      req.end()
    })
    
    res.json({
      success: true,
      data: marketData
    })
  } catch (error: any) {
    logger.error('获取实例市场列表失败:', error)
    res.status(500).json({
      success: false,
      error: '获取实例市场列表失败',
      message: error.message
    })
  }
})

// 获取单个实例
router.get('/:id', authenticateToken, (req: Request, res: Response) => {
  try {
    if (!instanceManager) {
      return res.status(500).json({ 
        success: false, 
        error: '实例管理器未初始化' 
      })
    }
    
    const { id } = req.params
    const instance = instanceManager.getInstance(id)
    
    if (!instance) {
      return res.status(404).json({
        success: false,
        error: '实例不存在'
      })
    }
    
    res.json({
      success: true,
      data: instance
    })
  } catch (error: any) {
    logger.error('获取实例失败:', error)
    res.status(500).json({
      success: false,
      error: '获取实例失败',
      message: error.message
    })
  }
})

// 创建实例
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!instanceManager) {
      return res.status(500).json({ 
        success: false, 
        error: '实例管理器未初始化' 
      })
    }
    
    const { name, description, workingDirectory, startCommand, autoStart, stopCommand } = req.body
    
    // 验证必填字段
    if (!name || !workingDirectory || !startCommand) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段',
        message: '实例名称、工作目录和启动命令为必填项'
      })
    }
    
    // 验证停止命令
    if (stopCommand && !['ctrl+c', 'stop', 'exit'].includes(stopCommand)) {
      return res.status(400).json({
        success: false,
        error: '无效的停止命令',
        message: '停止命令必须是 ctrl+c、stop 或 exit 之一'
      })
    }
    
    const instanceData = {
      name: name.trim(),
      description: description?.trim() || '',
      workingDirectory: workingDirectory.trim(),
      startCommand: startCommand.trim(),
      autoStart: Boolean(autoStart),
      stopCommand: stopCommand || 'ctrl+c'
    }
    
    const instance = await instanceManager.createInstance(instanceData)
    
    logger.info(`用户创建实例: ${instance.name}`)
    
    res.status(201).json({
      success: true,
      data: instance,
      message: '实例创建成功'
    })
  } catch (error: any) {
    logger.error('创建实例失败:', error)
    res.status(500).json({
      success: false,
      error: '创建实例失败',
      message: error.message
    })
  }
})

// 更新实例
router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!instanceManager) {
      return res.status(500).json({ 
        success: false, 
        error: '实例管理器未初始化' 
      })
    }
    
    const { id } = req.params
    const { name, description, workingDirectory, startCommand, autoStart, stopCommand } = req.body
    
    // 验证必填字段
    if (!name || !workingDirectory || !startCommand) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段',
        message: '实例名称、工作目录和启动命令为必填项'
      })
    }
    
    // 验证停止命令
    if (stopCommand && !['ctrl+c', 'stop', 'exit'].includes(stopCommand)) {
      return res.status(400).json({
        success: false,
        error: '无效的停止命令',
        message: '停止命令必须是 ctrl+c、stop 或 exit 之一'
      })
    }
    
    const instanceData = {
      name: name.trim(),
      description: description?.trim() || '',
      workingDirectory: workingDirectory.trim(),
      startCommand: startCommand.trim(),
      autoStart: Boolean(autoStart),
      stopCommand: stopCommand || 'ctrl+c'
    }
    
    const instance = await instanceManager.updateInstance(id, instanceData)
    
    if (!instance) {
      return res.status(404).json({
        success: false,
        error: '实例不存在'
      })
    }
    
    logger.info(`用户更新实例: ${instance.name}`)
    
    res.json({
      success: true,
      data: instance,
      message: '实例更新成功'
    })
  } catch (error: any) {
    logger.error('更新实例失败:', error)
    
    if (error.message === '无法修改正在运行的实例配置') {
      return res.status(400).json({
        success: false,
        error: '无法修改正在运行的实例配置',
        message: '请先停止实例再进行修改'
      })
    }
    
    res.status(500).json({
      success: false,
      error: '更新实例失败',
      message: error.message
    })
  }
})

// 删除实例
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!instanceManager) {
      return res.status(500).json({ 
        success: false, 
        error: '实例管理器未初始化' 
      })
    }
    
    const { id } = req.params
    const success = await instanceManager.deleteInstance(id)
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: '实例不存在'
      })
    }
    
    logger.info(`用户删除实例: ${id}`)
    
    res.json({
      success: true,
      message: '实例删除成功'
    })
  } catch (error: any) {
    logger.error('删除实例失败:', error)
    res.status(500).json({
      success: false,
      error: '删除实例失败',
      message: error.message
    })
  }
})

// 启动实例
router.post('/:id/start', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!instanceManager) {
      return res.status(500).json({ 
        success: false, 
        error: '实例管理器未初始化' 
      })
    }
    
    const { id } = req.params
    const result = await instanceManager.startInstance(id)
    
    logger.info(`用户启动实例: ${id}`)
    
    res.json({
      success: true,
      message: '实例启动成功',
      data: {
        terminalSessionId: result.terminalSessionId
      }
    })
  } catch (error: any) {
    logger.error('启动实例失败:', error)
    
    let statusCode = 500
    if (error.message.includes('不存在') || error.message.includes('已在运行') || error.message.includes('正在启动')) {
      statusCode = 400
    }
    
    res.status(statusCode).json({
      success: false,
      error: '启动实例失败',
      message: error.message
    })
  }
})

// 停止实例
router.post('/:id/stop', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!instanceManager) {
      return res.status(500).json({ 
        success: false, 
        error: '实例管理器未初始化' 
      })
    }
    
    const { id } = req.params
    await instanceManager.stopInstance(id)
    
    logger.info(`用户停止实例: ${id}`)
    
    res.json({
      success: true,
      message: '实例停止成功'
    })
  } catch (error: any) {
    logger.error('停止实例失败:', error)
    
    let statusCode = 500
    if (error.message.includes('不存在') || error.message.includes('未在运行')) {
      statusCode = 400
    }
    
    res.status(statusCode).json({
      success: false,
      error: '停止实例失败',
      message: error.message
    })
  }
})

// 获取实例状态
router.get('/:id/status', authenticateToken, (req: Request, res: Response) => {
  try {
    if (!instanceManager) {
      return res.status(500).json({ 
        success: false, 
        error: '实例管理器未初始化' 
      })
    }
    
    const { id } = req.params
    const status = instanceManager.getInstanceStatus(id)
    
    if (!status) {
      return res.status(404).json({
        success: false,
        error: '实例不存在'
      })
    }
    
    res.json({
      success: true,
      data: status
    })
  } catch (error: any) {
    logger.error('获取实例状态失败:', error)
    res.status(500).json({
      success: false,
      error: '获取实例状态失败',
      message: error.message
    })
  }
})

// 向实例发送输入
router.post('/:id/input', authenticateToken, (req: Request, res: Response) => {
  try {
    if (!instanceManager) {
      return res.status(500).json({ 
        success: false, 
        error: '实例管理器未初始化' 
      })
    }
    
    const { id } = req.params
    const { input } = req.body
    
    if (typeof input !== 'string') {
      return res.status(400).json({
        success: false,
        error: '无效的输入',
        message: '输入必须是字符串'
      })
    }
    
    const success = instanceManager.sendInput(id, input)
    
    if (!success) {
      return res.status(400).json({
        success: false,
        error: '发送输入失败',
        message: '实例不存在或未在运行'
      })
    }
    
    res.json({
      success: true,
      message: '输入发送成功'
    })
  } catch (error: any) {
    logger.error('发送输入失败:', error)
    res.status(500).json({
      success: false,
      error: '发送输入失败',
      message: error.message
    })
  }
})

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Python脚本路径
const PYTHON_SCRIPT_PATH = path.join(__dirname, '..', 'Python', 'game_config_manager.py')

// Python依赖安装状态
let pythonDepsInstalled = false

// 安装Python依赖
function installPythonDependencies(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (pythonDepsInstalled) {
      resolve()
      return
    }
    
    const requirementsPath = path.join(__dirname, '..', 'Python', 'requirements.txt')
    
    // 国内镜像源列表，按优先级排序
    const mirrors = [
      {
        url: 'https://pypi.tuna.tsinghua.edu.cn/simple/',
        host: 'pypi.tuna.tsinghua.edu.cn',
        name: '清华大学镜像源'
      },
      {
        url: 'https://mirrors.aliyun.com/pypi/simple/',
        host: 'mirrors.aliyun.com',
        name: '阿里云镜像源'
      },
      {
        url: 'https://pypi.douban.com/simple/',
        host: 'pypi.douban.com',
        name: '豆瓣镜像源'
      }
    ]
    
    let currentMirrorIndex = 0
    
    function tryInstallWithMirror() {
      if (currentMirrorIndex >= mirrors.length) {
        logger.warn('所有镜像源都尝试失败，将尝试直接运行脚本')
        resolve() // 即使安装失败也继续，可能依赖已经存在
        return
      }
      
      const mirror = mirrors[currentMirrorIndex]
      logger.info(`尝试使用${mirror.name}安装Python依赖`)
      
      const installProcess = spawn('pip', [
        'install', 
        '-r', 
        requirementsPath,
        '-i', 
        mirror.url,
        '--trusted-host',
        mirror.host,
        '--timeout',
        '60'
      ], {
        stdio: ['pipe', 'pipe', 'pipe']
      })
      
      let stderr = ''
      installProcess.stderr.on('data', (data) => {
        stderr += data.toString()
      })
      
      installProcess.on('close', (code) => {
        if (code === 0) {
          pythonDepsInstalled = true
          logger.info(`Python依赖安装成功，使用${mirror.name}`)
          resolve()
        } else {
          logger.warn(`${mirror.name}安装失败: ${stderr}`)
          currentMirrorIndex++
          tryInstallWithMirror() // 尝试下一个镜像源
        }
      })
      
      installProcess.on('error', (error) => {
        logger.warn(`${mirror.name}启动失败: ${error.message}`)
        currentMirrorIndex++
        tryInstallWithMirror() // 尝试下一个镜像源
      })
    }
    
    tryInstallWithMirror()
  })
}

// 调用Python脚本的辅助函数
function callPythonScript(method: string, args: any[] = []): Promise<any> {
  return new Promise(async (resolve, reject) => {
    try {
      // 确保Python依赖已安装
      await installPythonDependencies()
      
      const pythonArgs = [PYTHON_SCRIPT_PATH, method, ...args.map(arg => JSON.stringify(arg))]
      const pythonProcess = spawn('python', pythonArgs, {
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
         reject(new Error(`启动Python进程失败: ${error.message}`))
       })
     } catch (error) {
       reject(error)
     }
   })
 }

// 获取可用的游戏配置文件列表
router.get('/configs/available', authenticateToken, async (req: Request, res: Response) => {
  try {
    const result = await callPythonScript('get_available_configs')
    res.json({
      success: true,
      data: result
    })
  } catch (error: any) {
    logger.error('获取游戏配置列表失败:', error)
    res.status(500).json({
      success: false,
      error: '获取游戏配置列表失败',
      message: error.message
    })
  }
})

// 获取指定游戏配置的模板结构
router.get('/configs/schema/:configId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { configId } = req.params
    const decodedConfigId = decodeURIComponent(configId)
    const result = await callPythonScript('get_config_schema', [decodedConfigId])
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: '配置模板不存在'
      })
    }
    
    res.json({
      success: true,
      data: result
    })
  } catch (error: any) {
    logger.error('获取配置模板失败:', error)
    res.status(500).json({
      success: false,
      error: '获取配置模板失败',
      message: error.message
    })
  }
})

// 读取实例的游戏配置文件
router.get('/:instanceId/configs/:configId', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!instanceManager) {
      return res.status(500).json({ 
        success: false, 
        error: '实例管理器未初始化' 
      })
    }
    
    const { instanceId, configId } = req.params
    const decodedConfigId = decodeURIComponent(configId)
    
    // 获取实例信息
    const instance = instanceManager.getInstance(instanceId)
    if (!instance) {
      return res.status(404).json({
        success: false,
        error: '实例不存在'
      })
    }
    
    // 获取配置模板
    const schema = await callPythonScript('get_config_schema', [decodedConfigId])
    if (!schema) {
      return res.status(404).json({
        success: false,
        error: '配置模板不存在'
      })
    }
    
    // 从配置模板中获取正确的解析器类型
    const parser = schema.meta?.parser || 'configobj'
    logger.info(`使用解析器: ${parser} 读取配置: ${decodedConfigId}`)
    
    // 读取配置文件
    const result = await callPythonScript('read_game_config', [
      instance.workingDirectory,
      schema,
      parser
    ])
    
    res.json({
      success: true,
      data: result
    })
  } catch (error: any) {
    logger.error('读取游戏配置失败:', error)
    res.status(500).json({
      success: false,
      error: '读取游戏配置失败',
      message: error.message
    })
  }
})

// 保存实例的游戏配置文件
router.post('/:instanceId/configs/:configId', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!instanceManager) {
      return res.status(500).json({ 
        success: false, 
        error: '实例管理器未初始化' 
      })
    }
    
    const { instanceId, configId } = req.params
    const { configData } = req.body
    const decodedConfigId = decodeURIComponent(configId)
    
    if (!configData) {
      return res.status(400).json({
        success: false,
        error: '缺少配置数据'
      })
    }
    
    // 获取实例信息
    const instance = instanceManager.getInstance(instanceId)
    if (!instance) {
      return res.status(404).json({
        success: false,
        error: '实例不存在'
      })
    }
    
    // 获取配置模板
    const schema = await callPythonScript('get_config_schema', [decodedConfigId])
    if (!schema) {
      return res.status(404).json({
        success: false,
        error: '配置模板不存在'
      })
    }
    
    // 从配置模板中获取正确的解析器类型
    const parser = schema.meta?.parser || 'configobj'
    logger.info(`使用解析器: ${parser} 保存配置: ${decodedConfigId}`)
    
    // 保存配置文件
    const result = await callPythonScript('save_game_config', [
      instance.workingDirectory,
      schema,
      configData,
      parser
    ])
    
    if (result) {
      logger.info(`用户保存游戏配置: 实例=${instanceId}, 配置=${decodedConfigId}, 解析器=${parser}`)
      res.json({
        success: true,
        message: '配置保存成功'
      })
    } else {
      res.status(500).json({
        success: false,
        error: '配置保存失败'
      })
    }
  } catch (error: any) {
    logger.error('保存游戏配置失败:', error)
    res.status(500).json({
      success: false,
      error: '保存游戏配置失败',
      message: error.message
    })
  }
})

// Python环境检测
router.get('/python/check', authenticateToken, async (req: Request, res: Response) => {
  try {
    const platform = os.platform()
    let pythonCommand = 'python'
    
    // Linux和macOS系统优先使用python3
    if (platform === 'linux' || platform === 'darwin') {
      pythonCommand = 'python3'
    }
    
    logger.info(`检测Python环境，平台: ${platform}，使用命令: ${pythonCommand}`)
    
    const { stdout } = await execAsync(`${pythonCommand} --version`)
    const version = stdout.trim()
    
    logger.info(`Python环境检测成功: ${version}`)
    
    res.json({
      success: true,
      data: {
        available: true,
        version: version,
        command: pythonCommand,
        platform: platform
      }
    })
  } catch (error: any) {
    logger.error('Python环境检测异常:', error)
    
    res.json({
      success: true,
      data: {
        available: false,
        error: `未检测到Python环境: ${error.message}`,
        platform: os.platform()
      }
    })
  }
})

// 导出设置函数和路由
export function setupInstanceRoutes(manager: InstanceManager) {
  setInstanceManager(manager)
  return router
}

export default router