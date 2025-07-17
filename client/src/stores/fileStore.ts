import { create } from 'zustand'
import { FileItem, Task, FileOperationResult } from '@/types/file'
import { fileApiClient } from '@/utils/fileApi'

interface FileStore {
  // 状态
  currentPath: string
  files: FileItem[]
  selectedFiles: Set<string>
  loading: boolean
  error: string | null
  
  // 剪贴板相关
  clipboard: {
    items: string[] // 文件路径数组
    operation: 'copy' | 'cut' | null // 操作类型
  }
  
  // 编辑器相关
  openFiles: Map<string, string> // path -> content
  originalFiles: Map<string, string> // path -> original content
  activeFile: string | null
  
  // 任务相关
  tasks: Task[]
  activeTasks: Task[]
  
  // 操作方法
  setCurrentPath: (path: string) => void
  loadFiles: (path?: string) => Promise<void>
  selectFile: (path: string) => void
  selectMultipleFiles: (paths: string[]) => void
  unselectFile: (path: string) => void
  clearSelection: () => void
  toggleFileSelection: (path: string) => void
  
  // 文件操作
  createFile: (name: string, content?: string) => Promise<boolean>
  createDirectory: (name: string) => Promise<boolean>
  deleteSelectedFiles: () => Promise<boolean>
  renameFile: (oldPath: string, newName: string) => Promise<boolean>
  uploadFiles: (files: FileList, onProgress?: (progress: { fileName: string; progress: number; status: 'uploading' | 'completed' | 'error' }) => void) => Promise<boolean>
  
  // 剪贴板操作
  copyFiles: (filePaths: string[]) => void
  cutFiles: (filePaths: string[]) => void
  pasteFiles: () => Promise<boolean>
  clearClipboard: () => void
  
  // 压缩解压操作
  compressFiles: (filePaths: string[], archiveName: string, format?: string) => Promise<boolean>
  extractArchive: (archivePath: string) => Promise<boolean>
  
  // 编辑器操作
  openFile: (path: string) => Promise<void>
  closeFile: (path: string) => void
  saveFile: (path: string, content: string) => Promise<boolean>
  setActiveFile: (path: string | null) => void
  updateFileContent: (path: string, content: string) => void
  isFileModified: (path: string) => boolean
  
  // 任务管理
  loadTasks: () => Promise<void>
  loadActiveTasks: () => Promise<void>
  getTask: (taskId: string) => Promise<Task | null>
  deleteTask: (taskId: string) => Promise<FileOperationResult>
  
  // 工具方法
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useFileStore = create<FileStore>((set, get) => ({
  // 初始状态
  currentPath: '/',
  files: [],
  selectedFiles: new Set(),
  loading: false,
  error: null,
  clipboard: {
    items: [],
    operation: null
  },
  openFiles: new Map(),
  originalFiles: new Map(),
  activeFile: null,
  tasks: [],
  activeTasks: [],

  // 设置当前路径
  setCurrentPath: (path: string) => {
    const currentState = get()
    // 只有当路径真正改变时才更新状态和加载文件
    if (currentState.currentPath !== path) {
      set({ currentPath: path })
      get().loadFiles(path)
    }
  },

  // 加载文件列表
  loadFiles: async (path?: string) => {
    const targetPath = path || get().currentPath
    set({ loading: true, error: null })
    
    try {
      const files = await fileApiClient.listDirectory(targetPath)
      // 排序：文件夹优先，然后按名称排序
      const sortedFiles = files.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })
      
      set({ 
        files: sortedFiles, 
        currentPath: targetPath,
        loading: false,
        selectedFiles: new Set() // 清空选择
      })
    } catch (error: any) {
      set({ 
        error: error.message || '加载文件列表失败', 
        loading: false 
      })
    }
  },

  // 选择文件
  selectFile: (path: string) => {
    const selectedFiles = new Set(get().selectedFiles)
    selectedFiles.add(path)
    set({ selectedFiles })
  },

  // 选择多个文件
  selectMultipleFiles: (paths: string[]) => {
    const selectedFiles = new Set(get().selectedFiles)
    paths.forEach(path => selectedFiles.add(path))
    set({ selectedFiles })
  },

  // 取消选择文件
  unselectFile: (path: string) => {
    const selectedFiles = new Set(get().selectedFiles)
    selectedFiles.delete(path)
    set({ selectedFiles })
  },

  // 清空选择
  clearSelection: () => {
    set({ selectedFiles: new Set() })
  },

  // 切换文件选择状态
  toggleFileSelection: (path: string) => {
    const selectedFiles = new Set(get().selectedFiles)
    if (selectedFiles.has(path)) {
      selectedFiles.delete(path)
    } else {
      selectedFiles.add(path)
    }
    set({ selectedFiles })
  },

  // 创建文件
  createFile: async (name: string, content: string = '') => {
    const { currentPath } = get()
    const newPath = `${currentPath}/${name}`.replace(/\/+/g, '/')
    
    try {
      await fileApiClient.createFile(newPath, content)
      await get().loadFiles()
      return true
    } catch (error: any) {
      set({ error: error.message || '创建文件失败' })
      return false
    }
  },

  // 创建目录
  createDirectory: async (name: string) => {
    const { currentPath } = get()
    const newPath = `${currentPath}/${name}`.replace(/\/+/g, '/')
    
    try {
      await fileApiClient.createDirectory(newPath)
      await get().loadFiles()
      return true
    } catch (error: any) {
      set({ error: error.message || '创建目录失败' })
      return false
    }
  },

  // 删除选中的文件
  deleteSelectedFiles: async () => {
    const { selectedFiles } = get()
    if (selectedFiles.size === 0) return false
    
    try {
      await fileApiClient.deleteItems(Array.from(selectedFiles))
      await get().loadFiles()
      set({ selectedFiles: new Set() })
      return true
    } catch (error: any) {
      set({ error: error.message || '删除文件失败' })
      return false
    }
  },

  // 重命名文件
  renameFile: async (oldPath: string, newName: string) => {
    // 兼容Windows和Unix路径分隔符
    const separator = oldPath.includes('\\') ? '\\' : '/'
    const pathParts = oldPath.split(separator)
    pathParts[pathParts.length - 1] = newName
    const newPath = pathParts.join(separator)
    
    try {
      await fileApiClient.renameItem(oldPath, newPath)
      await get().loadFiles()
      return true
    } catch (error: any) {
      set({ error: error.message || '重命名失败' })
      return false
    }
  },

  // 上传文件
  uploadFiles: async (files: FileList, onProgress?: (progress: { fileName: string; progress: number; status: 'uploading' | 'completed' | 'error' }) => void) => {
    const { currentPath } = get()
    
    try {
      await fileApiClient.uploadFiles(currentPath, files, onProgress)
      await get().loadFiles()
      return true
    } catch (error: any) {
      set({ error: error.message || '上传文件失败' })
      if (onProgress) {
        onProgress({
          fileName: files.length === 1 ? files[0].name : `${files.length} 个文件`,
          progress: 0,
          status: 'error'
        })
      }
      return false
    }
  },

  // 打开文件
  openFile: async (path: string) => {
    const { openFiles, originalFiles } = get()
    
    if (openFiles.has(path)) {
      set({ activeFile: path })
      return
    }
    
    try {
      const fileContent = await fileApiClient.readFile(path)
      
      // 检查返回的数据是否有效
      if (!fileContent || typeof fileContent.content === 'undefined') {
        throw new Error('文件内容为空或格式错误')
      }
      
      const newOpenFiles = new Map(openFiles)
      const newOriginalFiles = new Map(originalFiles)
      newOpenFiles.set(path, fileContent.content || '')
      newOriginalFiles.set(path, fileContent.content || '')
      
      set({ 
        openFiles: newOpenFiles,
        originalFiles: newOriginalFiles,
        activeFile: path 
      })
    } catch (error: any) {
      set({ error: error.message || '打开文件失败' })
      console.error('打开文件失败:', error)
    }
  },

  // 关闭文件
  closeFile: (path: string) => {
    const { openFiles, originalFiles, activeFile } = get()
    const newOpenFiles = new Map(openFiles)
    const newOriginalFiles = new Map(originalFiles)
    newOpenFiles.delete(path)
    newOriginalFiles.delete(path)
    
    const newActiveFile = activeFile === path ? 
      (newOpenFiles.size > 0 ? Array.from(newOpenFiles.keys())[0] : null) : 
      activeFile
    
    set({ 
      openFiles: newOpenFiles,
      originalFiles: newOriginalFiles,
      activeFile: newActiveFile 
    })
  },

  // 保存文件
  saveFile: async (path: string, content: string) => {
    try {
      await fileApiClient.saveFile(path, content)
      const { openFiles, originalFiles } = get()
      const newOpenFiles = new Map(openFiles)
      const newOriginalFiles = new Map(originalFiles)
      newOpenFiles.set(path, content)
      newOriginalFiles.set(path, content) // 保存后更新原始内容
      
      set({ 
        openFiles: newOpenFiles,
        originalFiles: newOriginalFiles
      })
      return true
    } catch (error: any) {
      set({ error: error.message || '保存文件失败' })
      return false
    }
  },

  // 设置活动文件
  setActiveFile: (path: string | null) => {
    set({ activeFile: path })
  },

  // 设置加载状态
  setLoading: (loading: boolean) => {
    set({ loading })
  },

  // 设置错误信息
  setError: (error: string | null) => {
    set({ error })
  },

  // 复制文件到剪贴板
  copyFiles: (filePaths: string[]) => {
    set({ 
      clipboard: {
        items: [...filePaths],
        operation: 'copy'
      }
    })
  },

  // 剪切文件到剪贴板
  cutFiles: (filePaths: string[]) => {
    set({ 
      clipboard: {
        items: [...filePaths],
        operation: 'cut'
      }
    })
  },

  // 粘贴文件
  pasteFiles: async () => {
    const { clipboard, currentPath } = get()
    if (!clipboard.operation || clipboard.items.length === 0) {
      return false
    }

    try {
      if (clipboard.operation === 'copy') {
        // 复制操作
        for (const sourcePath of clipboard.items) {
          // 兼容Windows和Unix路径分隔符
          const separator = sourcePath.includes('\\') ? '\\' : '/'
          const fileName = sourcePath.split(separator).pop() || 'unknown'
          const targetPath = `${currentPath}${separator}${fileName}`.replace(/[\/\\]+/g, separator)
          
          await fileApiClient.copyItem(sourcePath, targetPath)
        }
      } else if (clipboard.operation === 'cut') {
        // 剪切操作
        for (const sourcePath of clipboard.items) {
          // 兼容Windows和Unix路径分隔符
          const separator = sourcePath.includes('\\') ? '\\' : '/'
          const fileName = sourcePath.split(separator).pop() || 'unknown'
          const targetPath = `${currentPath}${separator}${fileName}`.replace(/[\/\\]+/g, separator)
          
          await fileApiClient.moveItem(sourcePath, targetPath)
        }
        // 剪切后清空剪贴板
        get().clearClipboard()
      }
      
      await get().loadFiles()
      return true
    } catch (error: any) {
      set({ error: error.message || '粘贴操作失败' })
      return false
    }
  },

  // 清空剪贴板
  clearClipboard: () => {
    set({ 
      clipboard: {
        items: [],
        operation: null
      }
    })
  },

  // 压缩文件
  compressFiles: async (filePaths: string[], archiveName: string, format: string = 'zip') => {
    const { currentPath } = get()
    
    try {
      const result = await fileApiClient.compressFiles(filePaths, currentPath, archiveName, format)
      // 立即刷新活动任务列表
      await get().loadActiveTasks()
      return true
    } catch (error: any) {
      set({ error: error.message || '压缩文件失败' })
      return false
    }
  },

  // 解压文件
  extractArchive: async (archivePath: string) => {
    const { currentPath } = get()
    
    try {
      const result = await fileApiClient.extractArchive(archivePath, currentPath)
      // 立即刷新活动任务列表
      await get().loadActiveTasks()
      return true
    } catch (error: any) {
      set({ error: error.message || '解压文件失败' })
      return false
    }
  },

  // 更新文件内容
  updateFileContent: (path: string, content: string) => {
    const { openFiles } = get()
    const newOpenFiles = new Map(openFiles)
    newOpenFiles.set(path, content)
    set({ openFiles: newOpenFiles })
  },

  // 检查文件是否已修改
  isFileModified: (path: string) => {
    const { openFiles, originalFiles } = get()
    const currentContent = openFiles.get(path)
    const originalContent = originalFiles.get(path)
    return currentContent !== originalContent
  },
  
  // 任务管理
  loadTasks: async () => {
    try {
      const tasks = await fileApiClient.getTasks()
      set({ tasks })
    } catch (error: any) {
      set({ error: error.message || '加载任务列表失败' })
    }
  },

  loadActiveTasks: async () => {
    try {
      const activeTasks = await fileApiClient.getActiveTasks()
      set({ activeTasks })
    } catch (error: any) {
      set({ error: error.message || '加载活动任务失败' })
    }
  },

  getTask: async (taskId: string) => {
    try {
      return await fileApiClient.getTask(taskId)
    } catch (error: any) {
      set({ error: error.message || '获取任务状态失败' })
      return null
    }
  },

  deleteTask: async (taskId: string) => {
    try {
      const result = await fileApiClient.deleteTask(taskId)
      if (result.status === 'success') {
        // 刷新任务列表
        await get().loadActiveTasks()
        await get().loadTasks()
      }
      return result
    } catch (error: any) {
      set({ error: error.message || '删除任务失败' })
      return { status: 'error', message: error.message || '删除任务失败' }
    }
  }
}))