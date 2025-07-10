import { createWriteStream, createReadStream } from 'fs'
import { promises as fs } from 'fs'
import * as path from 'path'
import archiver from 'archiver'
import unzipper from 'unzipper'
import { taskManager, Task } from './taskManager.js'

export class CompressionWorker {
  async compressFiles(
    taskId: string,
    sourcePaths: string[],
    archivePath: string,
    format: string,
    compressionLevel: number
  ) {
    try {
      taskManager.updateTask(taskId, {
        status: 'running',
        message: '开始压缩文件...',
        progress: 0
      })

      await new Promise<void>((resolve, reject) => {
        const output = createWriteStream(archivePath)
        const archive = archiver(format as any, {
          zlib: { level: compressionLevel }
        })

        let totalFiles = 0
        let processedFiles = 0

        // 计算总文件数
        const countFiles = async (paths: string[]) => {
          for (const sourcePath of paths) {
            const stats = await fs.stat(sourcePath)
            if (stats.isDirectory()) {
              const items = await fs.readdir(sourcePath)
              const fullPaths = items.map(item => path.join(sourcePath, item))
              totalFiles += await countFiles(fullPaths)
            } else {
              totalFiles++
            }
          }
          return totalFiles
        }

        countFiles(sourcePaths).then(() => {
          taskManager.updateTask(taskId, {
            message: `准备压缩 ${totalFiles} 个文件...`,
            progress: 5
          })
        })

        output.on('close', () => {
          taskManager.updateTask(taskId, {
            status: 'completed',
            message: '压缩完成',
            progress: 100
          })
          resolve()
        })

        archive.on('error', (err) => {
          taskManager.updateTask(taskId, {
            status: 'failed',
            message: `压缩失败: ${err.message}`,
            progress: 0
          })
          reject(err)
        })

        archive.on('progress', (progress) => {
          if (totalFiles > 0) {
            const percent = Math.min(95, Math.floor((progress.entries.processed / totalFiles) * 90) + 5)
            taskManager.updateTask(taskId, {
              message: `正在压缩... (${progress.entries.processed}/${totalFiles})`,
              progress: percent
            })
          }
        })

        archive.pipe(output)

        // 添加文件到压缩包
        Promise.all(sourcePaths.map(async (sourcePath) => {
          const stats = await fs.stat(sourcePath)
          const name = path.basename(sourcePath)

          if (stats.isDirectory()) {
            archive.directory(sourcePath, name)
          } else {
            archive.file(sourcePath, { name })
          }
        })).then(() => {
          archive.finalize()
        }).catch(reject)
      })
    } catch (error: any) {
      taskManager.updateTask(taskId, {
        status: 'failed',
        message: `压缩失败: ${error.message}`,
        progress: 0
      })
      throw error
    }
  }

  async extractArchive(taskId: string, archivePath: string, targetPath: string) {
    try {
      taskManager.updateTask(taskId, {
        status: 'running',
        message: '开始解压文件...',
        progress: 0
      })

      const ext = path.extname(archivePath).toLowerCase()

      // 确保目标目录存在
      await fs.mkdir(targetPath, { recursive: true })

      if (ext === '.zip') {
        await new Promise<void>((resolve, reject) => {
          let extractedFiles = 0
          let totalFiles = 0

          const stream = createReadStream(archivePath)
            .pipe(unzipper.Parse())

          stream.on('entry', async (entry) => {
            totalFiles++
            const fileName = entry.path
            const type = entry.type
            const filePath = path.join(targetPath, fileName)

            if (type === 'File') {
              try {
                // 确保文件所在的目录存在
                const fileDir = path.dirname(filePath)
                await fs.mkdir(fileDir, { recursive: true })
                
                entry.pipe(createWriteStream(filePath))
                entry.on('close', () => {
                  extractedFiles++
                  const progress = Math.floor((extractedFiles / totalFiles) * 90) + 5
                  taskManager.updateTask(taskId, {
                    message: `正在解压... (${extractedFiles}/${totalFiles})`,
                    progress: Math.min(95, progress)
                  })
                })
              } catch (error) {
                console.error(`创建目录失败: ${path.dirname(filePath)}`, error)
                entry.autodrain()
              }
            } else if (type === 'Directory') {
              // 处理目录条目
              try {
                await fs.mkdir(filePath, { recursive: true })
              } catch (error) {
                console.error(`创建目录失败: ${filePath}`, error)
              }
              entry.autodrain()
            } else {
              entry.autodrain()
            }
          })

          stream.on('close', () => {
            taskManager.updateTask(taskId, {
              status: 'completed',
              message: '解压完成',
              progress: 100
            })
            resolve()
          })

          stream.on('error', (err) => {
            taskManager.updateTask(taskId, {
              status: 'failed',
              message: `解压失败: ${err.message}`,
              progress: 0
            })
            reject(err)
          })
        })
      } else {
        throw new Error(`不支持的压缩格式: ${ext}。目前只支持 .zip 格式`)
      }
    } catch (error: any) {
      taskManager.updateTask(taskId, {
        status: 'failed',
        message: `解压失败: ${error.message}`,
        progress: 0
      })
      throw error
    }
  }
}

export const compressionWorker = new CompressionWorker()