export interface FileItem {
  name: string
  path: string
  type: 'file' | 'directory'
  size: number
  modified: string
}

export interface FileOperationResult {
  status: 'success' | 'error'
  message: string
  data?: any
}

export interface FileUploadProgress {
  fileName: string
  progress: number
  status: 'uploading' | 'completed' | 'error'
}

export interface FileSearchResult {
  status: 'success' | 'error'
  results: FileItem[]
  total_found: number
  truncated: boolean
}

export interface FileContent {
  content: string
  encoding: string
  size: number
  modified: string
}