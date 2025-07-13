import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import winston from 'winston'

export interface CaptchaData {
  id: string
  code: string
  createdAt: string
  expiresAt: string
  used: boolean
}

export interface CaptchaResult {
  id: string
  svg: string
}

export class CaptchaManager {
  private captchas: Map<string, CaptchaData> = new Map()
  private captchaFilePath: string
  private logger: winston.Logger
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(logger: winston.Logger) {
    this.logger = logger
    this.captchaFilePath = path.join(process.cwd(), 'data', 'captchas.json')
  }

  async initialize(): Promise<void> {
    try {
      // 确保data目录存在
      const dataDir = path.dirname(this.captchaFilePath)
      await fs.mkdir(dataDir, { recursive: true })

      // 加载验证码数据
      await this.loadCaptchas()

      // 启动清理定时器（每5分钟清理一次过期验证码）
      this.startCleanupTimer()

      this.logger.info('验证码管理器初始化完成')
    } catch (error) {
      this.logger.error('验证码管理器初始化失败:', error)
      throw error
    }
  }

  private async loadCaptchas(): Promise<void> {
    try {
      const captchaData = await fs.readFile(this.captchaFilePath, 'utf-8')
      const captchas = JSON.parse(captchaData) as CaptchaData[]
      
      this.captchas.clear()
      const now = new Date()
      
      // 只加载未过期的验证码
      captchas.forEach(captcha => {
        if (new Date(captcha.expiresAt) > now) {
          this.captchas.set(captcha.id, captcha)
        }
      })
      
      this.logger.info(`加载了 ${this.captchas.size} 个有效验证码`)
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        this.logger.info('验证码文件不存在，将创建新文件')
      } else {
        this.logger.error('加载验证码文件失败:', error)
        throw error
      }
    }
  }

  private async saveCaptchas(): Promise<void> {
    try {
      const captchas = Array.from(this.captchas.values())
      await fs.writeFile(this.captchaFilePath, JSON.stringify(captchas, null, 2), 'utf-8')
    } catch (error) {
      this.logger.error('保存验证码文件失败:', error)
      throw error
    }
  }

  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredCaptchas()
    }, 5 * 60 * 1000) // 5分钟
  }

  private async cleanupExpiredCaptchas(): Promise<void> {
    const now = new Date()
    let cleanedCount = 0

    for (const [id, captcha] of this.captchas.entries()) {
      if (new Date(captcha.expiresAt) <= now) {
        this.captchas.delete(id)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      await this.saveCaptchas()
      this.logger.info(`清理了 ${cleanedCount} 个过期验证码`)
    }
  }

  generateCaptcha(): CaptchaResult {
    // 生成4位随机数字验证码
    const code = Math.floor(1000 + Math.random() * 9000).toString()
    const id = crypto.randomUUID()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000) // 5分钟过期

    const captchaData: CaptchaData = {
      id,
      code,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      used: false
    }

    this.captchas.set(id, captchaData)
    this.saveCaptchas().catch(error => {
      this.logger.error('保存验证码失败:', error)
    })

    // 生成简单的SVG验证码
    const svg = this.generateSVG(code)

    return {
      id,
      svg
    }
  }

  private generateSVG(code: string): string {
    const width = 120
    const height = 40
    const fontSize = 18
    
    // 生成随机颜色
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8']
    const bgColor = '#F8F9FA'
    
    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`
    svg += `<rect width="${width}" height="${height}" fill="${bgColor}"/>`
    
    // 添加干扰线
    for (let i = 0; i < 3; i++) {
      const x1 = Math.random() * width
      const y1 = Math.random() * height
      const x2 = Math.random() * width
      const y2 = Math.random() * height
      const color = colors[Math.floor(Math.random() * colors.length)]
      svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1" opacity="0.3"/>`
    }
    
    // 添加验证码字符
    for (let i = 0; i < code.length; i++) {
      const char = code[i]
      const x = 20 + i * 20 + (Math.random() - 0.5) * 8
      const y = 25 + (Math.random() - 0.5) * 6
      const rotation = (Math.random() - 0.5) * 30
      const color = colors[Math.floor(Math.random() * colors.length)]
      
      svg += `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="${color}" transform="rotate(${rotation} ${x} ${y})">${char}</text>`
    }
    
    // 添加干扰点
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * width
      const y = Math.random() * height
      const color = colors[Math.floor(Math.random() * colors.length)]
      svg += `<circle cx="${x}" cy="${y}" r="1" fill="${color}" opacity="0.5"/>`
    }
    
    svg += '</svg>'
    return svg
  }

  verifyCaptcha(id: string, code: string): boolean {
    const captcha = this.captchas.get(id)
    
    if (!captcha) {
      return false
    }
    
    // 检查是否过期
    if (new Date() > new Date(captcha.expiresAt)) {
      this.captchas.delete(id)
      this.saveCaptchas().catch(error => {
        this.logger.error('保存验证码失败:', error)
      })
      return false
    }
    
    // 检查是否已使用
    if (captcha.used) {
      return false
    }
    
    // 验证码码
    if (captcha.code.toLowerCase() !== code.toLowerCase()) {
      return false
    }
    
    // 标记为已使用
    captcha.used = true
    this.saveCaptchas().catch(error => {
      this.logger.error('保存验证码失败:', error)
    })
    
    return true
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }
}