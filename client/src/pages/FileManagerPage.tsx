import React, { useEffect, useState, useCallback } from 'react'
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
  Modal
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
  FileAddOutlined
} from '@ant-design/icons'
import { useFileStore } from '@/stores/fileStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { FileGridItem } from '@/components/FileGridItem'
import { FileContextMenu } from '@/components/FileContextMenu'
import { 
  CreateDialog, 
  RenameDialog, 
  UploadDialog, 
  DeleteConfirmDialog 
} from '@/components/FileDialogs'
import { CompressDialog } from '@/components/CompressDialog'
import { MonacoEditor } from '@/components/MonacoEditor'
import { FileItem } from '@/types/file'
import { fileApiClient } from '@/utils/fileApi'
import { isTextFile } from '@/utils/format'
import { normalizePath, getDirectoryPath, getBasename } from '@/utils/pathUtils'

const { TabPane } = Tabs

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
    updateFileContent
  } = useFileStore()
  
  const { addNotification } = useNotificationStore()
  
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
  
  // 初始化
  useEffect(() => {
    loadFiles()
  }, [])
  
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
    if (pathInput.trim()) {
      navigateToPath(pathInput.trim())
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
    } else if (isTextFile(file.name)) {
      openFile(file.path)
      setEditorModalVisible(true)
    } else {
      // 非文本文件，提示下载
      message.info('该文件类型不支持在线编辑，请下载查看')
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
  
  const handleUploadConfirm = async (files: FileList) => {
    const success = await uploadFiles(files)
    if (success) {
      addNotification({
        type: 'success',
        title: '上传成功',
        message: `成功上传 ${files.length} 个文件`
      })
    }
    setUploadDialog(false)
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
        title: '压缩成功',
        message: `成功创建压缩文件 "${archiveName}"`
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
            {filteredFiles.map((file) => (
              <FileContextMenu
                key={file.path}
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
              >
                <FileGridItem
                  file={file}
                  isSelected={selectedFiles.has(file.path)}
                  onClick={handleFileClick}
                  onDoubleClick={handleFileDoubleClick}
                />
              </FileContextMenu>
            ))}
          </div>
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
        bodyStyle={{ height: '80vh', padding: 0 }}
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
          >
            {Array.from(openFiles.entries()).map(([filePath, content]) => (
              <TabPane
                key={filePath}
                tab={
                  <span className="flex items-center">
                    <FileTextOutlined className="mr-1" />
                    {getBasename(filePath)}
                  </span>
                }
                closable
              >
                <div style={{ height: 'calc(80vh - 100px)' }}>
                  <MonacoEditor
                    value={content}
                    onChange={(value) => handleEditorChange(filePath, value)}
                    fileName={getBasename(filePath)}
                    onSave={(value) => handleSaveFile(value)}
                  />
                </div>
              </TabPane>
            ))}
          </Tabs>
        )}
      </Modal>
    </div>
  )
}

export default FileManagerPage