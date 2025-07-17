import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Button, 
  Input, 
  Breadcrumb, 
  Spin, 
  Empty, 
  message, 
  Tooltip,
  Space,
  Tabs,
  Card,
  Modal,
  Progress,
  Badge,
  Drawer
} from 'antd'
import {
  HomeOutlined,
  FolderOutlined,
  PlusOutlined,
  UploadOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SearchOutlined,
  LeftOutlined,
  RightOutlined,
  FileTextOutlined,
  SaveOutlined,
  CloseOutlined,
  CopyOutlined,
  ScissorOutlined,
  SnippetsOutlined,
  FileAddOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  BellOutlined,
  AppstoreOutlined,
  UnorderedListOutlined
} from '@ant-design/icons'
import { useFileStore } from '@/stores/fileStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { useMusicStore } from '@/stores/musicStore'
import { FileGridItem } from '@/components/FileGridItem'
import { FileListItem } from '@/components/FileListItem'
import { FileContextMenu } from '@/components/FileContextMenu'
import { 
  CreateDialog, 
  RenameDialog, 
  UploadDialog, 
  DeleteConfirmDialog 
} from '@/components/FileDialogs'
import { CompressDialog } from '@/components/CompressDialog'
import { MonacoEditor } from '@/components/MonacoEditor'
import { ImagePreview } from '@/components/ImagePreview'
import { FileItem } from '@/types/file'
import { fileApiClient } from '@/utils/fileApi'
import { isTextFile, isImageFile } from '@/utils/format'
import { normalizePath, getDirectoryPath, getBasename } from '@/utils/pathUtils'



const FileManagerPage: React.FC = () => {
  const {
    currentPath,
    files,
    selectedFiles,
    loading,
    error,
    clipboard,
    openFiles,
    activeFile,
    tasks,
    activeTasks,
    setCurrentPath,
    loadFiles,
    selectFile,
    unselectFile,
    clearSelection,
    toggleFileSelection,
    createFile,
    createDirectory,
    deleteSelectedFiles,
    renameFile,
    uploadFiles,
    copyFiles,
    cutFiles,
    pasteFiles,
    clearClipboard,
    compressFiles,
    extractArchive,
    openFile,
    closeFile,
    saveFile,
    setActiveFile,
    setError,
    updateFileContent,
    isFileModified,
    loadTasks,
    loadActiveTasks,
    getTask,
    deleteTask
  } = useFileStore()
  
  const { addNotification } = useNotificationStore()
  const { addToPlaylist } = useMusicStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  
  // 对话框状态
  const [createDialog, setCreateDialog] = useState<{
    visible: boolean
    type: 'file' | 'folder'
  }>({ visible: false, type: 'folder' })
  
  const [renameDialog, setRenameDialog] = useState<{
    visible: boolean
    file: FileItem | null
  }>({ visible: false, file: null })
  
  const [uploadDialog, setUploadDialog] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState(false)
  const [compressDialog, setCompressDialog] = useState<{
    visible: boolean
    files: FileItem[]
  }>({ visible: false, files: [] })
  
  // 路径输入
  const [pathInput, setPathInput] = useState('')
  const [isEditingPath, setIsEditingPath] = useState(false)
  
  // 搜索
  const [searchQuery, setSearchQuery] = useState('')
  
  // 历史记录
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  
  // 编辑器模态框
  const [editorModalVisible, setEditorModalVisible] = useState(false)
  
  // 图片预览模态框
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false)
  const [previewImagePath, setPreviewImagePath] = useState('')
  const [previewImageName, setPreviewImageName] = useState('')
  
  // 任务状态抽屉
  const [taskDrawerVisible, setTaskDrawerVisible] = useState(false)
  
  // 视图模式
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    const saved = localStorage.getItem('fileManager_viewMode')
    return (saved as 'grid' | 'list') || 'grid'
  })
  
  // 保存视图模式到localStorage
  const handleViewModeChange = (mode: 'grid' | 'list') => {
    setViewMode(mode)
    localStorage.setItem('fileManager_viewMode', mode)
  }

  // 右键菜单状态
  const [contextMenuInfo, setContextMenuInfo] = useState<{
    file: FileItem | null
    position: { x: number; y: number }
  } | null>(null);
  
  // 初始化
  useEffect(() => {
    // 检查 URL 参数中的路径
    const pathFromUrl = searchParams.get('path')
    if (pathFromUrl) {
      // 如果 URL 中有路径参数，设置为当前路径并加载
      setCurrentPath(pathFromUrl)
    } else {
      // 否则加载默认路径
      loadFiles()
    }
    
    // 初始加载任务列表
    loadActiveTasks()
  }, [searchParams, setCurrentPath, loadFiles, loadActiveTasks])
  
  // 定期刷新活动任务
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeTasks.length > 0) {
        loadActiveTasks()
        // 如果有任务完成，刷新文件列表
        const hasCompletedTasks = activeTasks.some(task => 
          task.status === 'completed' || task.status === 'failed'
        )
        if (hasCompletedTasks) {
          loadFiles()
        }
      }
    }, 2000) // 每2秒刷新一次
    
    return () => clearInterval(interval)
  }, [activeTasks, loadActiveTasks, loadFiles])
  
  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 检查焦点是否在输入框、文本区域或可编辑元素上
      const activeElement = document.activeElement
      const isInputFocused = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.getAttribute('contenteditable') === 'true' ||
        activeElement.closest('.ant-input') ||
        activeElement.closest('.ant-select') ||
        activeElement.closest('[role="textbox"]')
      )
      
      // 如果焦点在输入框上，不处理文件操作快捷键
      if (isInputFocused) {
        return
      }
      
      if (event.ctrlKey || event.metaKey) {
        switch (event.key.toLowerCase()) {
          case 'c':
            if (selectedFiles.size > 0) {
              event.preventDefault()
              const selectedFileItems = Array.from(selectedFiles).map(path => 
                files.find(f => f.path === path)
              ).filter(Boolean) as FileItem[]
              handleContextMenuCopy(selectedFileItems)
            }
            break
          case 'x':
            if (selectedFiles.size > 0) {
              event.preventDefault()
              const selectedFileItems = Array.from(selectedFiles).map(path => 
                files.find(f => f.path === path)
              ).filter(Boolean) as FileItem[]
              handleContextMenuCut(selectedFileItems)
            }
            break
          case 'v':
            if (clipboard.operation && clipboard.items.length > 0) {
              event.preventDefault()
              handlePaste()
            }
            break
        }
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedFiles, files, clipboard])
  
  // 错误处理
  useEffect(() => {
    if (error) {
      addNotification({
        type: 'error',
        title: '操作失败',
        message: error
      })
      setError(null)
    }
  }, [error, addNotification, setError])
  
  // 更新路径输入
  useEffect(() => {
    setPathInput(currentPath)
  }, [currentPath])
  
  // 导航到指定路径
  const navigateToPath = useCallback((newPath: string) => {
    const normalizedPath = normalizePath(newPath)
    
    // 更新历史记录
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(normalizedPath)
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
    
    setCurrentPath(normalizedPath)
  }, [history, historyIndex, setCurrentPath])
  
  // 后退
  const goBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      setCurrentPath(history[newIndex])
    }
  }
  
  // 前进
  const goForward = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      setCurrentPath(history[newIndex])
    }
  }
  
  // 上级目录
  const goUp = () => {
    const parentPath = getDirectoryPath(currentPath)
    if (parentPath !== currentPath) {
      navigateToPath(parentPath)
    }
  }
  
  // 处理路径输入
  const handlePathSubmit = () => {
    const trimmedInput = normalizePath(pathInput.trim())
    const current = normalizePath(currentPath)
    if (trimmedInput && trimmedInput !== current) {
      navigateToPath(trimmedInput)
    }
    setIsEditingPath(false)
  }
  
  // 文件点击处理
  const handleFileClick = (file: FileItem, event: React.MouseEvent) => {
    if (event.ctrlKey || event.metaKey) {
      // Ctrl/Cmd + 点击：多选
      toggleFileSelection(file.path)
    } else if (event.shiftKey && selectedFiles.size > 0) {
      // Shift + 点击：范围选择
      const lastSelected = Array.from(selectedFiles)[selectedFiles.size - 1]
      const lastIndex = files.findIndex(f => f.path === lastSelected)
      const currentIndex = files.findIndex(f => f.path === file.path)
      
      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex)
        const end = Math.max(lastIndex, currentIndex)
        const rangeFiles = files.slice(start, end + 1).map(f => f.path)
        
        clearSelection()
        rangeFiles.forEach(path => selectFile(path))
      }
    } else {
      // 普通点击：单选
      clearSelection()
      selectFile(file.path)
    }
  }
  
  // 文件双击处理
  const handleFileDoubleClick = (file: FileItem) => {
    if (file.type === 'directory') {
      navigateToPath(file.path)
    } else if (isImageFile(file.name)) {
      setPreviewImagePath(file.path)
      setPreviewImageName(file.name)
      setImagePreviewVisible(true)
    } else {
      // 默认使用文本编辑器打开所有非图片文件（包括无后缀文件和非标准后缀文件）
      openFile(file.path)
      setEditorModalVisible(true)
    }
  }
  
  // 右键菜单处理
  const handleContextMenuOpen = (file: FileItem) => {
    if (file.type === 'directory') {
      navigateToPath(file.path)
    } else {
      openFile(file.path)
      setEditorModalVisible(true)
    }
  }
  
  const handleContextMenuRename = (file: FileItem) => {
    setRenameDialog({ visible: true, file })
  }
  
  const handleContextMenuDelete = (files: FileItem[]) => {
    // 选中要删除的文件
    clearSelection()
    files.forEach(file => selectFile(file.path))
    setDeleteDialog(true)
  }
  
  const handleContextMenuDownload = (file: FileItem) => {
    fileApiClient.downloadFile(file.path)
    addNotification({
      type: 'success',
      title: '下载开始',
      message: `正在下载 ${file.name}`
    })
  }
  
  const handleContextMenuCopy = (files: FileItem[]) => {
    const filePaths = files.map(file => file.path)
    copyFiles(filePaths)
    addNotification({
      type: 'success',
      title: '复制成功',
      message: `已复制 ${files.length} 个项目到剪贴板`
    })
  }
  
  const handleContextMenuCut = (files: FileItem[]) => {
    const filePaths = files.map(file => file.path)
    cutFiles(filePaths)
    addNotification({
      type: 'success',
      title: '剪切成功',
      message: `已剪切 ${files.length} 个项目到剪贴板`
    })
  }
  
  // 粘贴处理
  const handlePaste = async () => {
    if (!clipboard.operation || clipboard.items.length === 0) {
      message.warning('剪贴板为空')
      return
    }
    
    const success = await pasteFiles()
    if (success) {
      const operationText = clipboard.operation === 'copy' ? '复制' : '移动'
      addNotification({
        type: 'success',
        title: '粘贴成功',
        message: `成功${operationText} ${clipboard.items.length} 个项目`
      })
    }
  }
  
  const handleContextMenuView = (file: FileItem) => {
    if (isTextFile(file.name)) {
      openFile(file.path)
      setEditorModalVisible(true)
    } else if (isImageFile(file.name)) {
      setPreviewImagePath(file.path)
      setPreviewImageName(file.name)
      setImagePreviewVisible(true)
    } else {
      message.info('该文件类型不支持预览')
    }
  }

  // 压缩处理
  const handleContextMenuCompress = (files: FileItem[]) => {
    setCompressDialog({ visible: true, files })
  }

  // 解压处理
  const handleContextMenuExtract = async (file: FileItem) => {
    const success = await extractArchive(file.path)
    if (success) {
      addNotification({
        type: 'success',
        title: '解压成功',
        message: `文件 "${file.name}" 解压完成`
      })
    }
  }

  // 从此文件夹处打开终端
  const handleContextMenuOpenTerminal = (file: FileItem) => {
    if (file.type === 'directory') {
      // 导航到终端页面，并传递文件夹路径作为查询参数
      navigate(`/terminal?cwd=${encodeURIComponent(file.path)}`)
      addNotification({
        type: 'success',
        title: '打开终端',
        message: `已在 "${file.name}" 文件夹中打开终端`
      })
    }
  }

  // 添加到播放列表
  const handleAddToPlaylist = (files: FileItem[]) => {
    addToPlaylist(files)
    addNotification({
      type: 'success',
      title: '添加成功',
      message: `已添加 ${files.length} 个文件到播放列表`
    })
  }
  
  // 对话框处理
  const handleCreateConfirm = async (name: string) => {
    if (createDialog.type === 'folder') {
      const success = await createDirectory(name)
      if (success) {
        addNotification({
          type: 'success',
          title: '创建成功',
          message: `文件夹 "${name}" 创建成功`
        })
      }
    } else {
      // 创建文件
      const filePath = await createFile(name)
      if (typeof filePath === 'string') {
        addNotification({
          type: 'success',
          title: '创建成功',
          message: `文件 "${name}" 创建成功`
        })
        // 自动打开新创建的文件
        await openFile(filePath)
        setEditorModalVisible(true)
      }
    }
    setCreateDialog({ visible: false, type: 'folder' })
  }
  
  const handleRenameConfirm = async (newName: string) => {
    if (renameDialog.file) {
      const success = await renameFile(renameDialog.file.path, newName)
      if (success) {
        addNotification({
          type: 'success',
          title: '重命名成功',
          message: `"${renameDialog.file.name}" 已重命名为 "${newName}"`
        })
      }
    }
    setRenameDialog({ visible: false, file: null })
  }
  
  const handleUploadConfirm = async (files: FileList, onProgress?: (progress: { fileName: string; progress: number; status: 'uploading' | 'completed' | 'error' }) => void) => {
    const success = await uploadFiles(files, onProgress)
    if (success) {
      addNotification({
        type: 'success',
        title: '上传成功',
        message: `成功上传 ${files.length} 个文件`
      })
      setUploadDialog(false)
    } else if (onProgress) {
      // 如果上传失败，通过进度回调通知错误状态
      onProgress({
        fileName: files.length === 1 ? files[0].name : `${files.length} 个文件`,
        progress: 0,
        status: 'error'
      })
    }
  }
  
  const handleDeleteConfirm = async () => {
    const success = await deleteSelectedFiles()
    if (success) {
      addNotification({
        type: 'success',
        title: '删除成功',
        message: `成功删除 ${selectedFiles.size} 个项目`
      })
    }
    setDeleteDialog(false)
  }

  const handleCompressConfirm = async (archiveName: string, format: string, compressionLevel: number) => {
    const filePaths = compressDialog.files.map(file => file.path)
    const success = await compressFiles(filePaths, archiveName, format)
    if (success) {
      addNotification({
        type: 'success',
        title: '压缩任务已下发',
        message: `异步操作，详细进度可查看任务栏 "${archiveName}"`
      })
    }
    setCompressDialog({ visible: false, files: [] })
  }
  
  // 编辑器相关
  const handleEditorChange = (path: string, content: string) => {
    updateFileContent(path, content)
  }

  const handleSaveFile = async (content?: string | React.MouseEvent) => {
    if (!activeFile) {
      addNotification({
        type: 'warning',
        title: '没有活动文件',
        message: '请先选择一个文件进行保存。'
      })
      return
    }

    let fileContent: string | undefined;
    
    if (typeof content === 'string') {
      fileContent = content;
    } else {
      fileContent = openFiles.get(activeFile);
    }

    if (fileContent === undefined) {
      addNotification({
        type: 'error',
        title: '无法保存文件',
        message: '找不到文件内容。'
      });
      return;
    }
    
    await saveFile(activeFile, fileContent)
  }
  
  // 生成面包屑
  const generateBreadcrumbs = () => {
    const parts = currentPath.split('/').filter(Boolean)
    const items = [
      {
        title: (
          <span className="flex items-center cursor-pointer" onClick={() => navigateToPath('/')}>
            <HomeOutlined className="mr-1" />
            根目录
          </span>
        )
      }
    ]
    
    let currentBreadcrumbPath = ''
    parts.forEach((part, index) => {
      currentBreadcrumbPath += '/' + part
      const breadcrumbPath = currentBreadcrumbPath
      
      items.push({
        title: (
          <span 
            className="cursor-pointer hover:text-blue-500 text-gray-900 dark:text-white"
            onClick={() => navigateToPath(breadcrumbPath)}
          >
            {part}
          </span>
        )
      })
    })
    
    return items
  }
  
  // 过滤文件
  const filteredFiles = files.filter(file => 
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  )
  
  // 获取任务状态图标
  const getTaskStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <ClockCircleOutlined style={{ color: '#faad14' }} />
      case 'running':
        return <LoadingOutlined style={{ color: '#1890ff' }} />
      case 'completed':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      case 'failed':
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
      default:
        return <ClockCircleOutlined />
    }
  }
  
  // 获取任务状态文本
  const getTaskStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return '等待中'
      case 'running':
        return '进行中'
      case 'completed':
        return '已完成'
      case 'failed':
        return '失败'
      default:
        return '未知'
    }
  }
  
  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* 工具栏 */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          {/* 导航按钮 */}
          <Space>
            <Tooltip title="后退">
              <Button 
                icon={<LeftOutlined />} 
                disabled={historyIndex <= 0}
                onClick={goBack}
              />
            </Tooltip>
            <Tooltip title="前进">
              <Button 
                icon={<RightOutlined />} 
                disabled={historyIndex >= history.length - 1}
                onClick={goForward}
              />
            </Tooltip>
            <Tooltip title="上级目录">
              <Button 
                icon={<FolderOutlined />} 
                onClick={goUp}
              />
            </Tooltip>
            <Tooltip title="刷新">
              <Button 
                icon={<ReloadOutlined />} 
                onClick={() => loadFiles()}
                loading={loading}
              />
            </Tooltip>
          </Space>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* 视图切换 */}
           <Space>
             <Tooltip title="网格视图">
               <motion.div
                 whileHover={{ scale: 1.05 }}
                 whileTap={{ scale: 0.95 }}
                 transition={{ duration: 0.2 }}
               >
                 <Button 
                   icon={<AppstoreOutlined />}
                   type={viewMode === 'grid' ? 'primary' : 'default'}
                   onClick={() => handleViewModeChange('grid')}
                 />
               </motion.div>
             </Tooltip>
             <Tooltip title="列表视图">
               <motion.div
                 whileHover={{ scale: 1.05 }}
                 whileTap={{ scale: 0.95 }}
                 transition={{ duration: 0.2 }}
               >
                 <Button 
                   icon={<UnorderedListOutlined />}
                   type={viewMode === 'list' ? 'primary' : 'default'}
                   onClick={() => handleViewModeChange('list')}
                 />
               </motion.div>
             </Tooltip>
           </Space>
          
          {/* 搜索 */}
          <Input
            placeholder="搜索文件..."
            prefix={<SearchOutlined />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64"
          />
          
          {/* 操作按钮 */}
          <Space>
            <Tooltip title="新建文件">
              <Button 
                icon={<FileAddOutlined />}
                onClick={() => setCreateDialog({ visible: true, type: 'file' })}
              >
                新建文件
              </Button>
            </Tooltip>
            <Tooltip title="新建文件夹">
              <Button 
                icon={<PlusOutlined />}
                onClick={() => setCreateDialog({ visible: true, type: 'folder' })}
              >
                新建文件夹
              </Button>
            </Tooltip>
            <Tooltip title="上传文件">
              <Button 
                icon={<UploadOutlined />}
                onClick={() => setUploadDialog(true)}
              >
                上传
              </Button>
            </Tooltip>
            {/* 剪贴板操作按钮 */}
            {selectedFiles.size > 0 && (
              <>
                <Tooltip title="复制选中项 (Ctrl+C)">
                  <Button 
                    icon={<CopyOutlined />}
                    onClick={() => {
                      const selectedFileItems = Array.from(selectedFiles).map(path => 
                        files.find(f => f.path === path)
                      ).filter(Boolean) as FileItem[]
                      handleContextMenuCopy(selectedFileItems)
                    }}
                  >
                    复制
                  </Button>
                </Tooltip>
                <Tooltip title="剪切选中项 (Ctrl+X)">
                  <Button 
                    icon={<ScissorOutlined />}
                    onClick={() => {
                      const selectedFileItems = Array.from(selectedFiles).map(path => 
                        files.find(f => f.path === path)
                      ).filter(Boolean) as FileItem[]
                      handleContextMenuCut(selectedFileItems)
                    }}
                  >
                    剪切
                  </Button>
                </Tooltip>
              </>
            )}
            {clipboard.operation && clipboard.items.length > 0 && (
              <Tooltip title={`粘贴 ${clipboard.items.length} 个项目 (Ctrl+V)`}>
                <Button 
                  type="primary"
                  icon={<SnippetsOutlined />}
                  onClick={handlePaste}
                >
                  粘贴 ({clipboard.items.length})
                </Button>
              </Tooltip>
            )}
            {selectedFiles.size > 0 && (
              <Tooltip title="删除选中项">
                <Button 
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => setDeleteDialog(true)}
                >
                  删除 ({selectedFiles.size})
                </Button>
              </Tooltip>
            )}
            {/* 任务状态按钮 */}
            <Tooltip title="查看任务状态">
              <Badge count={activeTasks.length} size="small">
                <Button 
                  icon={<BellOutlined />}
                  onClick={() => setTaskDrawerVisible(true)}
                >
                  任务
                </Button>
              </Badge>
            </Tooltip>
          </Space>
        </div>
      </div>
      
      {/* 路径栏 */}
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        {isEditingPath ? (
          <Input
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            onPressEnter={handlePathSubmit}
            onBlur={handlePathSubmit}
            autoFocus
          />
        ) : (
          <div onClick={() => setIsEditingPath(true)} className="cursor-pointer">
            <Breadcrumb items={generateBreadcrumbs()} />
          </div>
        )}
      </div>
      
      {/* 主内容区 */}
      <div className="flex-1 p-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Spin size="large" />
          </div>
        ) : filteredFiles.length === 0 ? (
          <Empty 
            description="此文件夹为空"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <AnimatePresence mode="wait">
            {viewMode === 'grid' ? (
              <motion.div
                key="grid-view"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4"
              >
                {filteredFiles.map((file, index) => (
                  <motion.div
                    key={file.path}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ 
                      duration: 0.3, 
                      delay: index * 0.02,
                      ease: "easeOut"
                    }}
                  >
                    <FileContextMenu
                      file={file}
                      selectedFiles={selectedFiles}
                      clipboard={clipboard}
                      onOpen={handleContextMenuOpen}
                      onRename={handleContextMenuRename}
                      onDelete={handleContextMenuDelete}
                      onDownload={handleContextMenuDownload}
                      onCopy={handleContextMenuCopy}
                      onCut={handleContextMenuCut}
                      onPaste={handlePaste}
                      onView={handleContextMenuView}
                      onCompress={handleContextMenuCompress}
                      onExtract={handleContextMenuExtract}
                      onOpenTerminal={handleContextMenuOpenTerminal}
                      onAddToPlaylist={handleAddToPlaylist}
                      // 全局菜单控制
                      globalContextMenuInfo={contextMenuInfo}
                      setGlobalContextMenuInfo={setContextMenuInfo}
                    >
                      <FileGridItem
                        file={file}
                        isSelected={selectedFiles.has(file.path)}
                        onClick={handleFileClick}
                        onDoubleClick={handleFileDoubleClick}
                      />
                    </FileContextMenu>
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="list-view"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="space-y-2"
              >
                {filteredFiles.map((file, index) => (
                  <motion.div
                    key={file.path}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ 
                      duration: 0.3, 
                      delay: index * 0.02,
                      ease: "easeOut"
                    }}
                  >
                    <FileContextMenu
                      file={file}
                      selectedFiles={selectedFiles}
                      clipboard={clipboard}
                      onOpen={handleContextMenuOpen}
                      onRename={handleContextMenuRename}
                      onDelete={handleContextMenuDelete}
                      onDownload={handleContextMenuDownload}
                      onCopy={handleContextMenuCopy}
                      onCut={handleContextMenuCut}
                      onPaste={handlePaste}
                      onView={handleContextMenuView}
                      onCompress={handleContextMenuCompress}
                      onExtract={handleContextMenuExtract}
                      onOpenTerminal={handleContextMenuOpenTerminal}
                      onAddToPlaylist={handleAddToPlaylist}
                      // 全局菜单控制
                      globalContextMenuInfo={contextMenuInfo}
                      setGlobalContextMenuInfo={setContextMenuInfo}
                      >
                      <FileListItem
                        file={file}
                        isSelected={selectedFiles.has(file.path)}
                        onClick={handleFileClick}
                        onDoubleClick={handleFileDoubleClick}
                      />
                    </FileContextMenu>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
      
      {/* 对话框 */}
      <CreateDialog
        visible={createDialog.visible}
        type={createDialog.type}
        onConfirm={handleCreateConfirm}
        onCancel={() => setCreateDialog({ visible: false, type: 'folder' })}
      />
      
      <RenameDialog
        visible={renameDialog.visible}
        currentName={renameDialog.file?.name || ''}
        onConfirm={handleRenameConfirm}
        onCancel={() => setRenameDialog({ visible: false, file: null })}
      />
      
      <UploadDialog
        visible={uploadDialog}
        onConfirm={handleUploadConfirm}
        onCancel={() => setUploadDialog(false)}
      />
      
      <DeleteConfirmDialog
        visible={deleteDialog}
        fileNames={Array.from(selectedFiles).map(path => path.split('/').pop() || '')}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteDialog(false)}
      />
      
      <CompressDialog
        visible={compressDialog.visible}
        fileCount={compressDialog.files.length}
        onConfirm={handleCompressConfirm}
        onCancel={() => setCompressDialog({ visible: false, files: [] })}
      />
      
      {/* 编辑器模态框 */}
      <Modal
        title="文本编辑器"
        open={editorModalVisible}
        onCancel={() => setEditorModalVisible(false)}
        width="90%"
        style={{ top: 20 }}
        styles={{ body: { height: '80vh', padding: 0 } }}
        footer={[
          <Button key="close" onClick={() => setEditorModalVisible(false)}>
            关闭
          </Button>,
          <Button 
            key="save" 
            type="primary" 
            icon={<SaveOutlined />}
            onClick={() => handleSaveFile()}
            disabled={!activeFile}
          >
            保存
          </Button>
        ]}
      >
        {openFiles.size > 0 && (
          <Tabs
            type="editable-card"
            activeKey={activeFile || undefined}
            onChange={setActiveFile}
            onEdit={(targetKey, action) => {
              if (action === 'remove' && typeof targetKey === 'string') {
                closeFile(targetKey)
                if (openFiles.size === 1) {
                  setEditorModalVisible(false)
                }
              } else if (action === 'add') {
                // 点击+号创建新文件
                setCreateDialog({ visible: true, type: 'file' })
                setEditorModalVisible(false)
              }
            }}
            className="h-full"
            items={Array.from(openFiles.entries()).map(([filePath, content]) => ({
              key: filePath,
              label: (
                <span className="flex items-center">
                  <FileTextOutlined className="mr-1" />
                  {getBasename(filePath)}
                  {isFileModified(filePath) && (
                    <span 
                      className="ml-1 w-2 h-2 bg-orange-500 rounded-full" 
                      title="文件已修改"
                    />
                  )}
                </span>
              ),
              closable: true,
              children: (
                <div style={{ height: 'calc(80vh - 100px)' }}>
                  <MonacoEditor
                    value={content || ''}
                    onChange={(value) => handleEditorChange(filePath, value)}
                    fileName={getBasename(filePath)}
                    onSave={(value) => handleSaveFile(value)}
                  />
                </div>
              )
            }))}
          />
        )}
      </Modal>
      
      {/* 图片预览模态框 */}
      <ImagePreview
        isOpen={imagePreviewVisible}
        onClose={() => setImagePreviewVisible(false)}
        imagePath={previewImagePath}
        fileName={previewImageName}
      />
      
      {/* 任务状态抽屉 */}
      <Drawer
        title="任务状态"
        placement="right"
        onClose={() => setTaskDrawerVisible(false)}
        open={taskDrawerVisible}
        width={400}
      >
        <div className="space-y-4">
          {activeTasks.length === 0 ? (
            <Empty 
              description="暂无活动任务"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            activeTasks.map((task) => (
              <Card key={task.id} size="small" className="mb-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {getTaskStatusIcon(task.status)}
                    <span className="font-medium">
                      {task.type === 'compress' ? '压缩' : '解压'}
                    </span>
                    <span className="text-gray-500">
                      {getTaskStatusText(task.status)}
                    </span>
                  </div>
                  {(task.status === 'completed' || task.status === 'failed') && (
                    <Button 
                      size="small" 
                      type="text" 
                      danger
                      onClick={async () => {
                        try {
                          const result = await deleteTask(task.id)
                          if (result.status === 'success') {
                            addNotification({
                              type: 'success',
                              title: '删除成功',
                              message: '任务已删除'
                            })
                          } else {
                            addNotification({
                              type: 'error',
                              title: '删除失败',
                              message: result.message || '删除任务失败'
                            })
                          }
                        } catch (error: any) {
                          addNotification({
                            type: 'error',
                            title: '删除失败',
                            message: error.message || '删除任务失败'
                          })
                        }
                      }}
                    >
                      删除
                    </Button>
                  )}
                </div>
                
                {task.status === 'running' && (
                  <Progress 
                    percent={task.progress || 0} 
                    size="small"
                    status="active"
                  />
                )}
                
                {task.message && (
                  <div className="text-sm text-gray-600 mt-2">
                    {task.message}
                  </div>
                )}
                
                <div className="text-xs text-gray-400 mt-2">
                  创建时间: {new Date(task.createdAt).toLocaleString()}
                  {task.updatedAt && (
                    <div>
                      更新时间: {new Date(task.updatedAt).toLocaleString()}
                    </div>
                  )}
                </div>
              </Card>
            ))
          )}
          
          {activeTasks.length > 0 && (
            <div className="text-center pt-4">
              <Button 
                type="primary" 
                onClick={() => {
                  loadActiveTasks()
                  loadTasks()
                }}
              >
                刷新任务状态
              </Button>
            </div>
          )}
        </div>
      </Drawer>
    </div>
  )
}

export default FileManagerPage