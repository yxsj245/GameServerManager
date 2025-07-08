import axios from 'axios'
import { FileItem, FileOperationResult, FileSearchResult, FileContent } from '@/types/file'

const API_BASE = '/api/files'

export class FileApiClient {
  // 获取目录内容
  async listDirectory(path: string = '/'): Promise<FileItem[]> {
    const response = await axios.get(`${API_BASE}/list`, {
      params: { path }
    })
    return response.data.data
  }

  // 读取文件内容
  async readFile(path: string, encoding: string = 'utf-8'): Promise<FileContent> {
    const response = await axios.get(`${API_BASE}/read`, {
      params: { path, encoding }
    })
    return response.data.data
  }

  // 保存文件内容
  async saveFile(path: string, content: string, encoding: string = 'utf-8'): Promise<FileOperationResult> {
    const response = await axios.post(`${API_BASE}/save`, {
      path,
      content,
      encoding
    })
    return response.data
  }

  // 创建目录
  async createDirectory(path: string): Promise<FileOperationResult> {
    const response = await axios.post(`${API_BASE}/mkdir`, {
      path
    })
    return response.data
  }

  // 删除文件或目录
  async deleteItems(paths: string[]): Promise<FileOperationResult> {
    const response = await axios.delete(`${API_BASE}/delete`, {
      data: { paths }
    })
    return response.data
  }

  // 重命名文件或目录
  async renameItem(oldPath: string, newPath: string): Promise<FileOperationResult> {
    const response = await axios.post(`${API_BASE}/rename`, {
      oldPath,
      newPath
    })
    return response.data
  }

  // 复制文件或目录
  async copyItem(sourcePath: string, targetPath: string): Promise<FileOperationResult> {
    const response = await axios.post(`${API_BASE}/copy`, {
      sourcePath,
      targetPath
    })
    return response.data
  }

  // 移动文件或目录
  async moveItem(sourcePath: string, targetPath: string): Promise<FileOperationResult> {
    const response = await axios.post(`${API_BASE}/move`, {
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
    const response = await axios.get(`${API_BASE}/search`, {
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
    const url = `${API_BASE}/download?path=${encodeURIComponent(path)}`
    const link = document.createElement('a')
    link.href = url
    link.download = ''
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // 上传文件
  async uploadFiles(targetPath: string, files: FileList): Promise<FileOperationResult> {
    const formData = new FormData()
    formData.append('targetPath', targetPath)
    
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i])
    }

    const response = await axios.post(`${API_BASE}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
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
    const response = await axios.post(`${API_BASE}/compress`, {
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
    const response = await axios.post(`${API_BASE}/extract`, {
      archivePath,
      targetPath
    })
    return response.data
  }
}

export const fileApiClient = new FileApiClient()