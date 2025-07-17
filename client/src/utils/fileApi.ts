import axios, { AxiosInstance } from 'axios'
import { FileItem, FileOperationResult, FileSearchResult, FileContent, Task } from '@/types/file'

const API_BASE = '/api/files'

export class FileApiClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: '',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // 请求拦截器 - 自动添加认证token
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('gsm3_token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )
  }
  // 获取目录内容
  async listDirectory(path: string = '/'): Promise<FileItem[]> {
    const response = await this.client.get(`${API_BASE}/list`, {
      params: { path }
    })
    return response.data.data
  }

  // 读取文件内容
  async readFile(path: string, encoding: string = 'utf-8'): Promise<FileContent> {
    const response = await this.client.get(`${API_BASE}/read-content`, {
      params: { path, encoding }
    })
    return response.data.data
  }

  // 获取图片预览URL
  getImagePreviewUrl(path: string): string {
    // 将Windows路径转换为Unix风格，然后对路径进行编码
    // 但不要对整个路径进行encodeURIComponent，因为这会编码斜杠
    const normalizedPath = path.replace(/\\/g, '/')
    const encodedPath = normalizedPath.split('/').map(segment => encodeURIComponent(segment)).join('/')
    // 确保返回完整的URL路径
    return `${window.location.origin}${API_BASE}/preview?path=${encodedPath}`
  }

  // 保存文件内容
  async saveFile(path: string, content: string, encoding: string = 'utf-8'): Promise<FileOperationResult> {
    const response = await this.client.post(`${API_BASE}/save`, {
      path,
      content,
      encoding
    })
    return response.data
  }

  // 创建文件
  async createFile(path: string, content: string = '', encoding: string = 'utf-8'): Promise<FileOperationResult> {
    const response = await this.client.post(`${API_BASE}/create`, {
      path,
      content,
      encoding
    })
    return response.data
  }

  // 创建目录
  async createDirectory(path: string): Promise<FileOperationResult> {
    const response = await this.client.post(`${API_BASE}/mkdir`, {
      dirPath: path
    })
    return response.data
  }

  // 删除文件或目录
  async deleteItems(paths: string[]): Promise<FileOperationResult> {
    const response = await this.client.delete(`${API_BASE}/delete`, {
      data: { paths }
    })
    return response.data
  }

  // 重命名文件或目录
  async renameItem(oldPath: string, newPath: string): Promise<FileOperationResult> {
    const response = await this.client.post(`${API_BASE}/rename`, {
      oldPath,
      newPath
    })
    return response.data
  }

  // 复制文件或目录
  async copyItem(sourcePath: string, targetPath: string): Promise<FileOperationResult> {
    const response = await this.client.post(`${API_BASE}/copy`, {
      sourcePath,
      targetPath
    })
    return response.data
  }

  // 移动文件或目录
  async moveItem(sourcePath: string, targetPath: string): Promise<FileOperationResult> {
    const response = await this.client.post(`${API_BASE}/move`, {
      sourcePath,
      targetPath
    })
    return response.data
  }

  // 搜索文件
  async searchFiles(
    searchPath: string,
    query: string,
    type: string = 'all',
    caseSensitive: boolean = false,
    maxResults: number = 100
  ): Promise<FileSearchResult> {
    const response = await this.client.get(`${API_BASE}/search`, {
      params: {
        path: searchPath,
        query,
        type,
        case_sensitive: caseSensitive,
        max_results: maxResults
      }
    })
    return response.data
  }

  // 下载文件
  downloadFile(path: string): void {
    const token = localStorage.getItem('gsm3_token')
    const url = `${API_BASE}/download?path=${encodeURIComponent(path)}`
    
    // 创建一个临时的a标签进行下载，但需要处理认证
    fetch(url, {
      headers: {
        'Authorization': token ? `Bearer ${token}` : ''
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`下载失败: ${response.status}`)
      }
      
      // 从响应头中获取文件名
      const contentDisposition = response.headers.get('Content-Disposition')
      let fileName = path.split('/').pop() || 'download'
      
      if (contentDisposition) {
        // 尝试从 Content-Disposition 头中提取文件名
        // 优先使用 UTF-8 编码的文件名 (filename*=UTF-8'')
        const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/)
        if (utf8Match) {
          try {
            fileName = decodeURIComponent(utf8Match[1])
          } catch (e) {
            console.warn('Failed to decode UTF-8 filename:', e)
          }
        } else {
          // 回退到普通的 filename
          const normalMatch = contentDisposition.match(/filename="([^"]+)"/)
          if (normalMatch) {
            fileName = normalMatch[1]
          }
        }
      }
      
      return response.blob().then(blob => ({ blob, fileName }))
    })
    .then(({ blob, fileName }) => {
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
      
      console.log('文件下载成功:', fileName)
    })
    .catch(error => {
      console.error('下载失败:', error)
      // 可以在这里添加用户友好的错误提示
    })
  }

  // 上传文件
  async uploadFiles(
    targetPath: string, 
    files: FileList, 
    onProgress?: (progress: { fileName: string; progress: number; status: 'uploading' | 'completed' | 'error' }) => void
  ): Promise<FileOperationResult> {
    const formData = new FormData()
    formData.append('targetPath', targetPath)
    
    // 处理文件名编码，确保中文文件名正确传输
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      
      // 检查文件名是否包含中文字符
      const hasChineseChars = /[\u4e00-\u9fa5]/.test(file.name)
      
      if (hasChineseChars) {
        // 对于包含中文的文件名，创建一个新的File对象确保编码正确
        const blob = new Blob([file], { type: file.type })
        const newFile = new File([blob], file.name, {
          type: file.type,
          lastModified: file.lastModified
        })
        formData.append('files', newFile, file.name)
        console.log('Uploading Chinese filename:', file.name)
      } else {
        formData.append('files', file)
      }
    }

    const response = await this.client.post(`${API_BASE}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          // 对于多文件上传，这里简化处理，显示总体进度
          onProgress({
            fileName: files.length === 1 ? files[0].name : `${files.length} 个文件`,
            progress,
            status: progress === 100 ? 'completed' : 'uploading'
          })
        }
      }
    })
    return response.data
  }

  // 压缩文件
  async compressFiles(
    sourcePaths: string[],
    targetPath: string,
    archiveName: string,
    format: string = 'zip',
    compressionLevel: number = 6
  ): Promise<FileOperationResult> {
    const response = await this.client.post(`${API_BASE}/compress`, {
      sourcePaths,
      targetPath,
      archiveName,
      format,
      compressionLevel
    })
    return response.data
  }

  // 解压文件
  async extractArchive(archivePath: string, targetPath: string): Promise<FileOperationResult> {
    const response = await this.client.post(`${API_BASE}/extract`, {
      archivePath,
      targetPath
    })
    return response.data
  }

  // 获取所有任务
  async getTasks(): Promise<Task[]> {
    const response = await this.client.get(`${API_BASE}/tasks`)
    return response.data.data
  }

  // 获取活动任务
  async getActiveTasks(): Promise<Task[]> {
    const response = await this.client.get(`${API_BASE}/tasks/active`)
    return response.data.data
  }

  // 获取单个任务状态
  async getTask(taskId: string): Promise<Task> {
    const response = await this.client.get(`${API_BASE}/tasks/${taskId}`)
    return response.data.data
  }

  // 删除任务
  async deleteTask(taskId: string): Promise<FileOperationResult> {
    const response = await this.client.delete(`${API_BASE}/tasks/${taskId}`)
    return response.data
  }

  // 获取系统盘符
  async getDrives(): Promise<Array<{ label: string; value: string; type: string }>> {
    const response = await this.client.get(`${API_BASE}/drives`)
    return response.data.data
  }
}

export const fileApiClient = new FileApiClient()