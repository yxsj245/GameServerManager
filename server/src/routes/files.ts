import { Router, Request, Response } from 'express'
import { promises as fs } from 'fs'
import * as fsSync from 'fs'
import path from 'path'
import multer from 'multer'
import { createReadStream, createWriteStream } from 'fs'
import archiver from 'archiver'
import unzipper from 'unzipper'
import { authenticateToken } from '../middleware/auth.js'

const router = Router()

// 配置文件上传
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), 'uploads')
      cb(null, uploadDir)
    },
    filename: (req, file, cb) => {
      // 处理中文文件名编码问题
      let originalName = file.originalname
      
      // 检测并修复文件名编码
      if (originalName && originalName.includes('�')) {
        // 如果包含乱码字符，尝试重新编码
        try {
          const buffer = Buffer.from(originalName, 'binary')
          originalName = buffer.toString('utf8')
        } catch (error) {
          console.warn('Failed to decode filename, using fallback')
        }
      }
      
      // 如果仍然有问题，使用安全的文件名
      if (!originalName || originalName.includes('�') || !/^[\u4e00-\u9fa5\w\s.-]+$/u.test(originalName)) {
        const timestamp = Date.now()
        const ext = path.extname(file.originalname) || '.tmp'
        originalName = `upload-${timestamp}${ext}`
      }
      
      // 直接使用原文件名，清理特殊字符
      let cleanedName = originalName.replace(/[^\u4e00-\u9fa5\w\s.-]/g, '_')
      
      cb(null, cleanedName)
    }
  }),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    files: 10 // 最多10个文件
  },
  fileFilter: (req, file, cb) => {
    // 处理文件名编码
    let originalName = file.originalname
    
    // 检测并修复文件名编码
    if (originalName && originalName.includes('�')) {
      try {
        const buffer = Buffer.from(originalName, 'binary')
        originalName = buffer.toString('utf8')
      } catch (error) {
        console.warn('Failed to decode filename in filter, keeping original')
      }
    }
    
    // 更新文件名
    file.originalname = originalName
    cb(null, true)
  }
})

// 安全路径检查
const isValidPath = (filePath: string): boolean => {
  if (!filePath || typeof filePath !== 'string') {
    return false
  }
  
  const normalizedPath = path.normalize(filePath)
  
  // 检查是否包含危险的路径遍历
  if (normalizedPath.includes('..')) {
    return false
  }
  
  // 在Windows上，路径可能以盘符开头（如 C:\）或UNC路径（如 \\server\share）
  // 在Unix系统上，绝对路径以 / 开头
  const isAbsolute = path.isAbsolute(normalizedPath)
  
  return isAbsolute
}

// 获取目录列表
router.get('/list', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { path: dirPath = '/' } = req.query
    
    if (!isValidPath(dirPath as string)) {
      return res.status(400).json({
        status: 'error',
        message: '无效的路径'
      })
    }

    const stats = await fs.stat(dirPath as string)
    if (!stats.isDirectory()) {
      return res.status(400).json({
        status: 'error',
        message: '指定路径不是目录'
      })
    }

    const items = await fs.readdir(dirPath as string)
    const files = []

    for (const item of items) {
      const itemPath = path.join(dirPath as string, item)
      try {
        const itemStats = await fs.stat(itemPath)
        files.push({
          name: item,
          path: itemPath,
          type: itemStats.isDirectory() ? 'directory' : 'file',
          size: itemStats.size,
          modified: itemStats.mtime.toISOString()
        })
      } catch (error) {
        // 跳过无法访问的文件
        continue
      }
    }

    res.json({
      status: 'success',
      data: files
    })
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
})

// 读取文件内容
router.get('/read', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { path: filePath, encoding = 'utf-8' } = req.query
    
    if (!isValidPath(filePath as string)) {
      return res.status(400).json({
        status: 'error',
        message: '无效的路径'
      })
    }

    const stats = await fs.stat(filePath as string)
    if (!stats.isFile()) {
      return res.status(400).json({
        status: 'error',
        message: '指定路径不是文件'
      })
    }

    const content = await fs.readFile(filePath as string, encoding as BufferEncoding)
    
    res.json({
      status: 'success',
      data: {
        content,
        encoding,
        size: stats.size,
        modified: stats.mtime.toISOString()
      }
    })
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
})

// 创建文件
router.post('/create', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { path: filePath, content = '', encoding = 'utf-8' } = req.body
    
    if (!filePath) {
      return res.status(400).json({
        status: 'error',
        message: '缺少文件路径'
      })
    }
    
    if (!isValidPath(filePath)) {
      return res.status(400).json({
        status: 'error',
        message: '无效的路径'
      })
    }

    // 检查文件是否已存在
    try {
      await fs.access(filePath)
      return res.status(400).json({
        status: 'error',
        message: '文件已存在'
      })
    } catch {
      // 文件不存在，可以创建
    }

    // 确保父目录存在
    const parentDir = path.dirname(filePath)
    await fs.mkdir(parentDir, { recursive: true })
    
    // 创建文件
    await fs.writeFile(filePath, content, encoding)
    
    res.json({
      status: 'success',
      message: '文件创建成功'
    })
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
})

// 保存文件内容
router.post('/save', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { path: filePath, content, encoding = 'utf-8' } = req.body
    
    if (!isValidPath(filePath)) {
      return res.status(400).json({
        status: 'error',
        message: '无效的路径'
      })
    }

    await fs.writeFile(filePath, content, encoding)
    
    res.json({
      status: 'success',
      message: '文件保存成功'
    })
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
})

// 创建目录
router.post('/mkdir', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { path: dirPath } = req.body
    
    if (!isValidPath(dirPath)) {
      return res.status(400).json({
        status: 'error',
        message: '无效的路径'
      })
    }

    await fs.mkdir(dirPath, { recursive: true })
    
    res.json({
      status: 'success',
      message: '目录创建成功'
    })
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
})

// 删除文件或目录
router.delete('/delete', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { paths } = req.body
    
    if (!Array.isArray(paths)) {
      return res.status(400).json({
        status: 'error',
        message: '路径必须是数组'
      })
    }

    for (const filePath of paths) {
      if (!isValidPath(filePath)) {
        return res.status(400).json({
          status: 'error',
          message: `无效的路径: ${filePath}`
        })
      }

      const stats = await fs.stat(filePath)
      if (stats.isDirectory()) {
        await fs.rm(filePath, { recursive: true, force: true })
      } else {
        await fs.unlink(filePath)
      }
    }
    
    res.json({
      status: 'success',
      message: '删除成功'
    })
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
})

// 重命名文件或目录
router.post('/rename', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { oldPath, newPath } = req.body
    
    // 添加调试日志
    console.log('重命名请求:', { oldPath, newPath })
    console.log('oldPath验证:', isValidPath(oldPath))
    console.log('newPath验证:', isValidPath(newPath))
    
    if (!oldPath || !newPath) {
      return res.status(400).json({
        status: 'error',
        message: '缺少必要的路径参数'
      })
    }
    
    if (!isValidPath(oldPath) || !isValidPath(newPath)) {
      return res.status(400).json({
        status: 'error',
        message: '无效的路径'
      })
    }

    await fs.rename(oldPath, newPath)
    
    res.json({
      status: 'success',
      message: '重命名成功'
    })
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
})

// 复制文件或目录
router.post('/copy', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { sourcePath, targetPath } = req.body
    
    if (!isValidPath(sourcePath) || !isValidPath(targetPath)) {
      return res.status(400).json({
        status: 'error',
        message: '无效的路径'
      })
    }

    const stats = await fs.stat(sourcePath)
    
    if (stats.isFile()) {
      await fs.copyFile(sourcePath, targetPath)
    } else {
      // 递归复制目录
      await copyDirectory(sourcePath, targetPath)
    }
    
    res.json({
      status: 'success',
      message: '复制成功'
    })
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
})

// 移动文件或目录
router.post('/move', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { sourcePath, targetPath } = req.body
    
    if (!isValidPath(sourcePath) || !isValidPath(targetPath)) {
      return res.status(400).json({
        status: 'error',
        message: '无效的路径'
      })
    }

    await fs.rename(sourcePath, targetPath)
    
    res.json({
      status: 'success',
      message: '移动成功'
    })
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
})

// 搜索文件
router.get('/search', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { 
      path: searchPath = '/home',
      query,
      type = 'all',
      case_sensitive = false,
      max_results = 100
    } = req.query
    
    if (!query) {
      return res.status(400).json({
        status: 'error',
        message: '搜索关键词不能为空'
      })
    }

    if (!isValidPath(searchPath as string)) {
      return res.status(400).json({
        status: 'error',
        message: '无效的路径'
      })
    }

    const results = await searchFiles(
      searchPath as string,
      query as string,
      type as string,
      case_sensitive === 'true',
      parseInt(max_results as string)
    )
    
    res.json({
      status: 'success',
      results,
      total_found: results.length,
      truncated: results.length >= parseInt(max_results as string)
    })
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
})

// 下载文件
router.get('/download', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { path: filePath } = req.query
    
    if (!isValidPath(filePath as string)) {
      return res.status(400).json({
        status: 'error',
        message: '无效的路径'
      })
    }

    const stats = await fs.stat(filePath as string)
    if (!stats.isFile()) {
      return res.status(400).json({
        status: 'error',
        message: '指定路径不是文件'
      })
    }

    const fileName = path.basename(filePath as string)
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.setHeader('Content-Type', 'application/octet-stream')
    
    const fileStream = createReadStream(filePath as string)
    fileStream.pipe(res)
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
})

// 上传文件
router.post('/upload', authenticateToken, upload.array('files'), async (req: Request, res: Response) => {
  console.log('Upload request received:')
  console.log('Body:', req.body)
  console.log('Files:', req.files)
  console.log('Files length:', req.files?.length)
  
  try {
    const { targetPath } = req.body
    const files = req.files as Express.Multer.File[]

    if (!targetPath) {
      console.log('Error: Invalid target path')
      return res.status(400).json({ success: false, message: 'Invalid target path' })
    }

    if (!files || files.length === 0) {
      console.log('Error: No files uploaded')
      return res.status(400).json({ success: false, message: 'No files uploaded' })
    }

    // 处理Windows路径格式，确保使用绝对路径
    let fullTargetPath: string
    if (path.isAbsolute(targetPath)) {
      fullTargetPath = targetPath
    } else {
      // 如果是相对路径，转换为绝对路径（基于当前工作目录）
      fullTargetPath = path.resolve(process.cwd(), targetPath.replace(/^\//, ''))
    }
    
    console.log('Resolved target path:', fullTargetPath)

    // 确保目标目录存在
    await fs.mkdir(fullTargetPath, { recursive: true })

    // 移动文件到目标目录
    const results = []
    for (const file of files) {
      try {
        // 处理中文文件名编码问题
        let originalName = file.originalname
        
        // 检测并修复文件名编码
        if (originalName && originalName.includes('�')) {
          try {
            const buffer = Buffer.from(originalName, 'binary')
            originalName = buffer.toString('utf8')
          } catch (error) {
            console.warn('Failed to decode filename in upload, using fallback')
          }
        }
        
        // 如果仍然有问题，使用安全的文件名
        if (!originalName || originalName.includes('�') || !/^[\u4e00-\u9fa5\w\s.-]+$/u.test(originalName)) {
          const timestamp = Date.now()
          const ext = path.extname(file.originalname) || '.tmp'
          originalName = `upload-${timestamp}${ext}`
        }
        
        // 清理文件名中的特殊字符
        originalName = originalName.replace(/[^\u4e00-\u9fa5\w\s.-]/g, '_')
        
        const targetFilePath = path.join(fullTargetPath, originalName)
        console.log(`Moving file from ${file.path} to ${targetFilePath}`)
        
        // 使用diskStorage时，文件已经在临时目录中，需要移动到目标目录
        await fs.rename(file.path, targetFilePath)
        results.push({ name: originalName, success: true })
      } catch (error: any) {
        console.error(`Failed to move file ${file.originalname}:`, error)
        results.push({ name: file.originalname, success: false, error: error.message })
        
        // 清理已上传的文件
        try {
          const fileExists = await fs.stat(file.path).then(() => true).catch(() => false)
          if (fileExists) {
            await fs.unlink(file.path)
          }
        } catch (unlinkError) {
          console.error(`Failed to cleanup file ${file.path}:`, unlinkError)
        }
      }
    }

    res.json({
      success: true,
      message: `Successfully uploaded ${results.filter(r => r.success).length} of ${files.length} files`,
      data: results
    })
  } catch (error: any) {
    console.error('Upload error:', error)
    res.status(500).json({ success: false, message: 'Upload failed', error: error.message })
  }
})

// 压缩文件夹
router.post('/compress', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { 
      sourcePaths, 
      targetPath, 
      archiveName, 
      format = 'zip', 
      compressionLevel = 6 
    } = req.body
    
    if (!Array.isArray(sourcePaths) || sourcePaths.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: '源路径不能为空'
      })
    }

    for (const sourcePath of sourcePaths) {
      if (!isValidPath(sourcePath)) {
        return res.status(400).json({
          status: 'error',
          message: `无效的源路径: ${sourcePath}`
        })
      }
    }

    if (!isValidPath(targetPath)) {
      return res.status(400).json({
        status: 'error',
        message: '无效的目标路径'
      })
    }

    const archivePath = path.join(targetPath, archiveName)
    
    await compressFiles(sourcePaths, archivePath, format, compressionLevel)
    
    res.json({
      status: 'success',
      message: '压缩完成',
      archivePath
    })
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
})

// 解压文件
router.post('/extract', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { archivePath, targetPath } = req.body
    
    if (!isValidPath(archivePath) || !isValidPath(targetPath)) {
      return res.status(400).json({
        status: 'error',
        message: '无效的路径'
      })
    }

    await extractArchive(archivePath, targetPath)
    
    res.json({
      status: 'success',
      message: '解压完成'
    })
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
})

// 辅助函数
async function copyDirectory(src: string, dest: string) {
  await fs.mkdir(dest, { recursive: true })
  const items = await fs.readdir(src)
  
  for (const item of items) {
    const srcPath = path.join(src, item)
    const destPath = path.join(dest, item)
    const stats = await fs.stat(srcPath)
    
    if (stats.isDirectory()) {
      await copyDirectory(srcPath, destPath)
    } else {
      await fs.copyFile(srcPath, destPath)
    }
  }
}

async function searchFiles(
  searchPath: string, 
  query: string, 
  type: string, 
  caseSensitive: boolean, 
  maxResults: number
): Promise<any[]> {
  const results: any[] = []
  const searchQuery = caseSensitive ? query : query.toLowerCase()
  
  async function searchRecursive(currentPath: string) {
    if (results.length >= maxResults) return
    
    try {
      const items = await fs.readdir(currentPath)
      
      for (const item of items) {
        if (results.length >= maxResults) break
        
        const itemPath = path.join(currentPath, item)
        const stats = await fs.stat(itemPath)
        const itemName = caseSensitive ? item : item.toLowerCase()
        
        if (itemName.includes(searchQuery)) {
          if (type === 'all' || 
              (type === 'file' && stats.isFile()) || 
              (type === 'directory' && stats.isDirectory())) {
            results.push({
              name: item,
              path: itemPath,
              type: stats.isDirectory() ? 'directory' : 'file',
              size: stats.size,
              modified: stats.mtime.toISOString(),
              parent_dir: currentPath
            })
          }
        }
        
        if (stats.isDirectory()) {
          await searchRecursive(itemPath)
        }
      }
    } catch (error) {
      // 跳过无法访问的目录
    }
  }
  
  await searchRecursive(searchPath)
  return results
}

async function compressFiles(
  sourcePaths: string[], 
  archivePath: string, 
  format: string, 
  compressionLevel: number
) {
  return new Promise<void>(async (resolve, reject) => {
    try {
      const output = createWriteStream(archivePath)
      const archive = archiver(format as any, {
        zlib: { level: compressionLevel }
      })
      
      output.on('close', () => resolve())
      archive.on('error', (err) => reject(err))
      
      archive.pipe(output)
      
      for (const sourcePath of sourcePaths) {
        const stats = await fs.stat(sourcePath)
        const name = path.basename(sourcePath)
        
        if (stats.isDirectory()) {
          archive.directory(sourcePath, name)
        } else {
          archive.file(sourcePath, { name })
        }
      }
      
      archive.finalize()
    } catch (error) {
      reject(error)
    }
  })
}

async function extractArchive(archivePath: string, targetPath: string) {
  return new Promise<void>(async (resolve, reject) => {
    try {
      const ext = path.extname(archivePath).toLowerCase()
      
      // 确保目标目录存在
      await fs.mkdir(targetPath, { recursive: true })
      
      if (ext === '.zip') {
        createReadStream(archivePath)
          .pipe(unzipper.Extract({ path: targetPath }))
          .on('close', () => resolve())
          .on('error', (err) => reject(err))
      } else {
        // 对于其他格式，返回不支持的错误
        reject(new Error(`不支持的压缩格式: ${ext}。目前只支持 .zip 格式`))
      }
    } catch (error) {
      reject(error)
    }
  })
}

export default router