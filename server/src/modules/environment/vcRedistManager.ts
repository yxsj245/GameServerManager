import path from 'path'
import fs from 'fs-extra'
import os from 'os'
import axios from 'axios'
import logger from '../../utils/logger'
import { spawn } from 'child_process'

export interface VcRedistEnvironment {
  version: string
  platform: string
  downloadUrl: string
  installed: boolean
  installPath?: string
  architecture: 'x86' | 'x64' | 'arm64'
}

export class VcRedistManager {
  private installDir: string

  constructor() {
    // 设置安装目录
    this.installDir = path.join(process.cwd(), 'data', 'vcredist')
  }

  /**
   * 确保安装目录存在
   */
  private async ensureInstallDir(): Promise<void> {
    await fs.ensureDir(this.installDir)
  }

  /**
   * 获取版本目录路径
   */
  private getVersionDir(version: string, arch: string): string {
    return path.join(this.installDir, `${version}_${arch}`)
  }

  /**
   * 检查Visual C++运行库是否已安装（通过注册表）
   */
  private async checkVcRedistInstalled(version: string, arch: string): Promise<boolean> {
    if (os.platform() !== 'win32') {
      return false
    }

    try {
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)

      // 使用更详细的检测方法：查询32/64位注册表视图
      const searchPatterns = this.getSearchPatterns(version, arch)
      const baseKey = 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
      const regViews = [' /reg:64', ' /reg:32']

      for (const pattern of searchPatterns) {
        for (const view of regViews) {
          try {
            const { stdout } = await execAsync(`reg query "${baseKey}" /s /f "${pattern}" /d${view}`)
            if (stdout.includes('Microsoft Visual C++') && stdout.includes(pattern)) {
              logger.info(`检测到已安装: ${version} ${arch} (${view.trim()})`)
              return true
            }
          } catch (error) {
            continue
          }
        }
      }

      // 如果主要检测失败，尝试备用检测方法
      return await this.fallbackDetection(version, arch)
    } catch (error) {
      logger.error(`检查 ${version} ${arch} 安装状态失败:`, error)
      return false
    }
  }

  /**
   * 获取搜索模式
   */
  private getSearchPatterns(version: string, arch: string): string[] {
    const patterns: { [key: string]: string[] } = {
      '2015-2022': [
        `Microsoft Visual C++ 2015-2022 Redistributable (${arch})`,
        `Microsoft Visual C++ 2022 Redistributable (${arch})`,
        `Microsoft Visual C++ 2019 Redistributable (${arch})`,
        `Microsoft Visual C++ 2017 Redistributable (${arch})`,
        `Microsoft Visual C++ 2015 Redistributable (${arch})`
      ],
      '2013': [
        `Microsoft Visual C++ 2013 Redistributable (${arch})`
      ],
      '2012': [
        `Microsoft Visual C++ 2012 Redistributable (${arch})`
      ],
      '2010': [
        `Microsoft Visual C++ 2010 Redistributable Package (${arch})`
      ]
    }

    return patterns[version] || []
  }

  /**
   * 备用检测方法
   */
  private async fallbackDetection(version: string, arch: string): Promise<boolean> {
    try {
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)

      // 检查系统文件
      const systemFiles = this.getSystemFiles(version, arch)

      for (const file of systemFiles) {
        try {
          const { stdout } = await execAsync(`dir "${file}" 2>nul`)
          if (stdout.includes(path.basename(file))) {
            logger.info(`通过系统文件检测到: ${version} ${arch} - ${file}`)
            return true
          }
        } catch (error) {
          continue
        }
      }

      return false
    } catch (error) {
      logger.error(`备用检测失败:`, error)
      return false
    }
  }

  /**
   * 获取系统文件路径
   */
  private getSystemFiles(version: string, arch: string): string[] {
    const systemRoot = process.env.SystemRoot || 'C:\\Windows'
    const system32 = path.join(systemRoot, 'System32')
    const sysWow64 = path.join(systemRoot, 'SysWOW64')

    const files: { [key: string]: { [key: string]: string[] } } = {
      '2015-2022': {
        'x64': [
          path.join(system32, 'msvcp140.dll'),
          path.join(system32, 'vcruntime140.dll'),
          path.join(system32, 'vcruntime140_1.dll')
        ],
        'x86': [
          path.join(sysWow64, 'msvcp140.dll'),
          path.join(sysWow64, 'vcruntime140.dll')
        ]
      },
      '2013': {
        'x64': [
          path.join(system32, 'msvcp120.dll'),
          path.join(system32, 'msvcr120.dll')
        ],
        'x86': [
          path.join(sysWow64, 'msvcp120.dll'),
          path.join(sysWow64, 'msvcr120.dll')
        ]
      },
      '2012': {
        'x64': [
          path.join(system32, 'msvcp110.dll'),
          path.join(system32, 'msvcr110.dll')
        ],
        'x86': [
          path.join(sysWow64, 'msvcp110.dll'),
          path.join(sysWow64, 'msvcr110.dll')
        ]
      },
      '2010': {
        'x64': [
          path.join(system32, 'msvcp100.dll'),
          path.join(system32, 'msvcr100.dll')
        ],
        'x86': [
          path.join(sysWow64, 'msvcp100.dll'),
          path.join(sysWow64, 'msvcr100.dll')
        ]
      }
    }

    return files[version]?.[arch] || []
  }



  /**
   * 获取所有Visual C++运行库环境状态
   */
  async getVcRedistEnvironments(): Promise<VcRedistEnvironment[]> {
    await this.ensureInstallDir()

    // 只在Windows平台上提供
    if (os.platform() !== 'win32') {
      return []
    }

    const environments: VcRedistEnvironment[] = []
    const versions = ['2015-2022', '2013', '2012', '2010']
    const architectures: ('x86' | 'x64')[] = ['x86', 'x64']

    for (const version of versions) {
      for (const arch of architectures) {
        const installed = await this.checkVcRedistInstalled(version, arch)
        const versionDir = this.getVersionDir(version, arch)

        environments.push({
          version: `Visual C++ ${version}`,
          platform: 'win32',
          downloadUrl: this.getDownloadUrl(version, arch),
          installed,
          installPath: installed ? versionDir : undefined,
          architecture: arch
        })
      }
    }

    return environments
  }

  /**
   * 获取下载URL
   */
  private getDownloadUrl(version: string, arch: string): string {
    const urlMap: { [key: string]: { [key: string]: string } } = {
      '2015-2022': {
        'x86': 'https://aka.ms/vs/17/release/vc_redist.x86.exe',
        'x64': 'https://aka.ms/vs/17/release/vc_redist.x64.exe'
      },
      '2013': {
        'x86': 'https://download.microsoft.com/download/2/E/6/2E61CFA4-993B-4DD4-91DA-3737CD5CD6E3/vcredist_x86.exe',
        'x64': 'https://download.microsoft.com/download/2/E/6/2E61CFA4-993B-4DD4-91DA-3737CD5CD6E3/vcredist_x64.exe'
      },
      '2012': {
        'x86': 'https://download.microsoft.com/download/1/6/B/16B06F60-3B20-4FF2-B699-5E9B7962F9AE/VSU_4/vcredist_x86.exe',
        'x64': 'https://download.microsoft.com/download/1/6/B/16B06F60-3B20-4FF2-B699-5E9B7962F9AE/VSU_4/vcredist_x64.exe'
      },
      '2010': {
        'x86': 'https://download.microsoft.com/download/1/6/5/165255E7-1014-4D0A-B094-B6A430A6BFFC/vcredist_x86.exe',
        'x64': 'https://download.microsoft.com/download/1/6/5/165255E7-1014-4D0A-B094-B6A430A6BFFC/vcredist_x64.exe'
      }
    }

    return urlMap[version]?.[arch] || ''
  }

  /**
   * 下载文件
   */
  private async downloadFile(
    url: string,
    filePath: string,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    const response = await axios({
      method: 'GET',
      url,
      responseType: 'stream',
      timeout: 300000, // 5分钟超时
    })

    const totalLength = parseInt(response.headers['content-length'] || '0', 10)
    let downloadedLength = 0

    const writer = fs.createWriteStream(filePath)

    response.data.on('data', (chunk: Buffer) => {
      downloadedLength += chunk.length
      if (totalLength > 0 && onProgress) {
        const progress = Math.round((downloadedLength / totalLength) * 100)
        onProgress(progress)
      }
    })

    response.data.pipe(writer)

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve)
      writer.on('error', reject)
    })
  }

  /**
   * 安装Visual C++运行库
   */
  async installVcRedist(
    version: string,
    architecture: string,
    downloadUrl: string,
    onProgress?: (stage: 'download' | 'install', progress: number) => void
  ): Promise<void> {
    if (os.platform() !== 'win32') {
      throw new Error('Visual C++运行库只能在Windows系统上安装')
    }

    await this.ensureInstallDir()

    const versionDir = this.getVersionDir(version, architecture)

    // 检查是否已安装
    const installed = await this.checkVcRedistInstalled(version, architecture)
    if (installed) {
      throw new Error(`Visual C++ ${version} ${architecture} 已经安装`)
    }

    logger.info(`开始安装 Visual C++ ${version} ${architecture}，下载地址: ${downloadUrl}`)

    try {
      // 创建版本目录
      await fs.ensureDir(versionDir)

      // 下载文件
      const fileName = `vcredist_${architecture}.exe`
      const downloadPath = path.join(versionDir, fileName)

      await this.downloadFile(downloadUrl, downloadPath, (progress) => {
        onProgress?.('download', progress)
      })

      // 安装运行库
      onProgress?.('install', 0)
      await this.executeInstaller(downloadPath)
      onProgress?.('install', 100)

      // 等待一段时间让系统完成注册表更新
      await new Promise(resolve => setTimeout(resolve, 3000))

      // 验证安装是否成功
      const installed = await this.checkVcRedistInstalled(version, architecture)
      if (!installed) {
        logger.warn(`安装完成但检测不到 ${version} ${architecture}，可能需要等待系统更新`)
      }

      logger.info(`Visual C++ ${version} ${architecture} 安装完成，检测状态: ${installed ? '已安装' : '待确认'}`)
    } catch (error) {
      logger.error(`安装 Visual C++ ${version} ${architecture} 失败:`, error)

      // 清理失败的安装
      try {
        if (await fs.pathExists(versionDir)) {
          await fs.remove(versionDir)
        }
      } catch (cleanupError) {
        logger.error('清理失败的安装目录失败:', cleanupError)
      }

      throw error
    }
  }

  /**
   * 执行安装程序
   */
  private async executeInstaller(installerPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // 使用静默安装参数
      const process = spawn(installerPath, ['/quiet', '/norestart'], {
        stdio: 'pipe'
      })

      let stderr = ''

      process.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      process.on('close', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`安装失败，退出代码: ${code}, 错误信息: ${stderr}`))
        }
      })

      process.on('error', (error) => {
        reject(new Error(`启动安装程序失败: ${error.message}`))
      })
    })
  }

  /**
   * 卸载Visual C++运行库
   */
  async uninstallVcRedist(version: string, architecture: string): Promise<void> {
    if (os.platform() !== 'win32') {
      throw new Error('Visual C++运行库只能在Windows系统上卸载')
    }

    const installed = await this.checkVcRedistInstalled(version, architecture)
    if (!installed) {
      throw new Error(`Visual C++ ${version} ${architecture} 未安装`)
    }

    logger.info(`开始卸载 Visual C++ ${version} ${architecture}`)

    try {
      const uninstallString = await this.getUninstallString(version, architecture)
      if (!uninstallString) {
        throw new Error('未找到卸载程序')
      }

      await this.executeUninstaller(uninstallString)

      // 等待一段时间让系统完成卸载
      await new Promise(resolve => setTimeout(resolve, 2000))

      // 验证卸载是否成功
      const stillInstalled = await this.checkVcRedistInstalled(version, architecture)
      if (stillInstalled) {
        logger.warn(`卸载完成但仍检测到 ${version} ${architecture}`)
      }

      logger.info(`Visual C++ ${version} ${architecture} 卸载完成`)
    } catch (error) {
      logger.error(`卸载 Visual C++ ${version} ${architecture} 失败:`, error)
      throw error
    }
  }

  /**
   * 获取卸载字符串
   */
  private async getUninstallString(version: string, architecture: string): Promise<string | null> {
    try {
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)

      const searchPatterns = this.getSearchPatterns(version, architecture)
      const baseKey = 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
      const regViews = [' /reg:64', ' /reg:32']

      for (const pattern of searchPatterns) {
        for (const view of regViews) {
          try {
            // 搜索卸载字符串，优先 QuietUninstallString
            const { stdout } = await execAsync(`reg query "${baseKey}" /s /f "${pattern}" /d${view}`)

            if (stdout.includes('Microsoft Visual C++') && stdout.includes(pattern)) {
              // 提取注册表键路径
              const lines = stdout.split('\n')
              for (const line of lines) {
                if (line.includes('HKEY_LOCAL_MACHINE') && line.includes('Uninstall')) {
                  const keyPath = line.trim()
                  try {
                    // 优先QuietUninstallString
                    const { stdout: quietInfo } = await execAsync(`reg query "${keyPath}" /v QuietUninstallString`)
                    const quietMatch = quietInfo.match(/QuietUninstallString\s+REG_SZ\s+(.+)/)
                    if (quietMatch) {
                      return quietMatch[1].trim()
                    }
                  } catch (_) {}

                  try {
                    const { stdout: uninstallInfo } = await execAsync(`reg query "${keyPath}" /v UninstallString`)
                    const match = uninstallInfo.match(/UninstallString\s+REG_SZ\s+(.+)/)
                    if (match) {
                      return match[1].trim()
                    }
                  } catch (error) {
                    continue
                  }
                }
              }
            }
          } catch (error) {
            continue
          }
        }
      }

      return null
    } catch (error) {
      logger.error('获取卸载字符串失败:', error)
      return null
    }
  }

  /**
   * 执行卸载程序
   */
  private async executeUninstaller(uninstallString: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // 解析卸载命令
      let command = uninstallString
      let args: string[] = []

      const trimmed = uninstallString.trim()

      // MSI卸载（控制面板同源）
      if (trimmed.toLowerCase().startsWith('msiexec')) {
        const parts = trimmed.split(' ')
        command = parts.shift()!.replace(/"/g, '')
        args = parts
        // 标准静默卸载参数
        if (!args.some(a => a.toLowerCase() === '/x')) {
          // 如果没有/x，尝试从GUID中构造；这里假设卸载字符串已经包含/x {GUID}
        }
        if (!args.some(a => a.toLowerCase() === '/quiet' || a.toLowerCase() === '/qn')) {
          args.push('/quiet')
        }
        if (!args.some(a => a.toLowerCase() === '/norestart')) {
          args.push('/norestart')
        }
      } else if (trimmed.includes('.exe')) {
        // 常规EXE卸载
        const parts = trimmed.split(' ')
        command = parts[0].replace(/"/g, '')
        args = parts.slice(1)
        // 添加静默卸载参数
        if (!args.some(arg => /\/quiet|\/silent|\/S|\-s/i.test(arg))) {
          args.push('/quiet', '/norestart')
        }
      }

      logger.info(`执行卸载命令: ${command} ${args.join(' ')}`)

      const proc = spawn(command, args, {
        stdio: 'pipe'
      })

      let stderr = ''

      proc.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      proc.on('close', (code) => {
        // Windows Installer 3010 表示需要重启，视为成功
        if (code === 0 || code === 3010) {
          resolve()
        } else {
          reject(new Error(`卸载失败，退出代码: ${code}, 错误信息: ${stderr}`))
        }
      })

      proc.on('error', (error) => {
        reject(new Error(`启动卸载程序失败: ${error.message}`))
      })
    })
  }

  /**
   * 验证Visual C++运行库安装
   */
  async verifyVcRedist(version: string, architecture: string): Promise<{ installed: boolean; registryInfo?: string }> {
    if (os.platform() !== 'win32') {
      throw new Error('Visual C++运行库只能在Windows系统上验证')
    }

    const installed = await this.checkVcRedistInstalled(version, architecture)

    if (installed) {
      // 获取注册表信息
      try {
        const { exec } = await import('child_process')
        const { promisify } = await import('util')
        const execAsync = promisify(exec)

        const searchPatterns = this.getSearchPatterns(version, architecture)

        for (const pattern of searchPatterns) {
          try {
            const { stdout } = await execAsync(`reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall" /s /f "${pattern}" /d`)
            if (stdout.includes('Microsoft Visual C++') && stdout.includes(pattern)) {
              return {
                installed: true,
                registryInfo: stdout
              }
            }
          } catch (error) {
            continue
          }
        }
      } catch (error) {
        logger.error(`获取注册表信息失败:`, error)
      }
    }

    return { installed }
  }
}
