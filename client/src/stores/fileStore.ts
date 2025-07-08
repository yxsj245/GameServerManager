import { create } from 'zustand'
import { FileItem } from '@/types/file'
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
  activeFile: string | null
  
  // 操作方法
  setCurrentPath: (path: string) => void
  loadFiles: (path?: string) => Promise<void>
  selectFile: (path: string) => void
  selectMultipleFiles: (paths: string[]) => void
  unselectFile: (path: string) => void
  clearSelection: () => void
  toggleFileSelection: (path: string) => void
  
  // 文件操作
  createDirectory: (name: string) => Promise<boolean>
  deleteSelectedFiles: () => Promise<boolean>
  renameFile: (oldPath: string, newName: string) => Promise<boolean>
  uploadFiles: (files: FileList) => Promise<boolean>
  
  // 剪贴板操作
  copyFiles: (filePaths: string[]) => void
  cutFiles: (filePaths: string[]) => void
  pasteFiles: () => Promise<boolean>
  clearClipboard: () => void
  
  // 编辑器操作
  openFile: (path: string) => Promise<void>
  closeFile: (path: string) => void
  saveFile: (path: string, content: string) => Promise<boolean>
  setActiveFile: (path: string | null) => void
  
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
  activeFile: null,

  // 设置当前路径
  setCurrentPath: (path: string) => {
    set({ currentPath: path })
    get().loadFiles(path)
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
  uploadFiles: async (files: FileList) => {
    const { currentPath } = get()
    
    try {
      await fileApiClient.uploadFiles(currentPath, files)
      await get().loadFiles()
      return true
    } catch (error: any) {
      set({ error: error.message || '上传文件失败' })
      return false
    }
  },

  // 打开文件
  openFile: async (path: string) => {
    const { openFiles } = get()
    
    if (openFiles.has(path)) {
      set({ activeFile: path })
      return
    }
    
    try {
      const fileContent = await fileApiClient.readFile(path)
      const newOpenFiles = new Map(openFiles)
      newOpenFiles.set(path, fileContent.content)
      
      set({ 
        openFiles: newOpenFiles, 
        activeFile: path 
      })
    } catch (error: any) {
      set({ error: error.message || '打开文件失败' })
    }
  },

  // 关闭文件
  closeFile: (path: string) => {
    const { openFiles, activeFile } = get()
    const newOpenFiles = new Map(openFiles)
    newOpenFiles.delete(path)
    
    const newActiveFile = activeFile === path ? 
      (newOpenFiles.size > 0 ? Array.from(newOpenFiles.keys())[0] : null) : 
      activeFile
    
    set({ 
      openFiles: newOpenFiles, 
      activeFile: newActiveFile 
    })
  },

  // 保存文件
  saveFile: async (path: string, content: string) => {
    try {
      await fileApiClient.saveFile(path, content)
      const { openFiles } = get()
      const newOpenFiles = new Map(openFiles)
      newOpenFiles.set(path, content)
      
      set({ openFiles: newOpenFiles })
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
  }
}))