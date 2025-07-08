import { Router, Request, Response } from 'express'
import { promises as fs } from 'fs'
import path from 'path'
import { createReadStream, createWriteStream } from 'fs'
import archiver from 'archiver'
import unzipper from 'unzipper'
import multer from 'multer'

const router = Router()

// 配置文件上传
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
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
  
  // 添加调试日志
  console.log('路径验证:', {
    original: filePath,
    normalized: normalizedPath,
    isAbsolute,
    platform: process.platform
  })
  
  return isAbsolute
}

// 获取目录内容
router.get('/list', async (req: Request, res: Response) => {
  try {
    const { path: dirPath = '/home' } = req.query
    
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
router.get('/read', async (req: Request, res: Response) => {
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

// 保存文件内容
router.post('/save', async (req: Request, res: Response) => {
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
router.post('/mkdir', async (req: Request, res: Response) => {
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
router.delete('/delete', async (req: Request, res: Response) => {
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
        await fs.rmdir(filePath, { recursive: true })
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
router.post('/rename', async (req: Request, res: Response) => {
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
router.post('/copy', async (req: Request, res: Response) => {
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
router.post('/move', async (req: Request, res: Response) => {
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
router.get('/search', async (req: Request, res: Response) => {
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
router.get('/download', async (req: Request, res: Response) => {
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
router.post('/upload', upload.array('files'), async (req: Request, res: Response) => {
  try {
    const { targetPath } = req.body
    const files = req.files as Express.Multer.File[]
    
    if (!isValidPath(targetPath)) {
      return res.status(400).json({
        status: 'error',
        message: '无效的目标路径'
      })
    }

    if (!files || files.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: '没有上传文件'
      })
    }

    const uploadedFiles = []
    
    for (const file of files) {
      const targetFilePath = path.join(targetPath, file.originalname)
      await fs.rename(file.path, targetFilePath)
      uploadedFiles.push({
        name: file.originalname,
        path: targetFilePath,
        size: file.size
      })
    }
    
    res.json({
      status: 'success',
      message: '文件上传成功',
      files: uploadedFiles
    })
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
})

// 压缩文件夹
router.post('/compress', async (req: Request, res: Response) => {
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
router.post('/extract', async (req: Request, res: Response) => {
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
  return new Promise<void>((resolve, reject) => {
    const output = createWriteStream(archivePath)
    const archive = archiver(format as any, {
      zlib: { level: compressionLevel }
    })
    
    output.on('close', () => resolve())
    archive.on('error', (err) => reject(err))
    
    archive.pipe(output)
    
    for (const sourcePath of sourcePaths) {
      const stats = require('fs').statSync(sourcePath)
      const name = path.basename(sourcePath)
      
      if (stats.isDirectory()) {
        archive.directory(sourcePath, name)
      } else {
        archive.file(sourcePath, { name })
      }
    }
    
    archive.finalize()
  })
}

async function extractArchive(archivePath: string, targetPath: string) {
  return new Promise<void>((resolve, reject) => {
    createReadStream(archivePath)
      .pipe(unzipper.Extract({ path: targetPath }))
      .on('close', () => resolve())
      .on('error', (err) => reject(err))
  })
}

export default router