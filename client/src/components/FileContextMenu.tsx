import React from 'react'
import {
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  ScissorOutlined,
  DownloadOutlined,
  FileOutlined,
  FolderOpenOutlined,
  EyeOutlined
} from '@ant-design/icons'
import { FileItem } from '@/types/file'

interface FileContextMenuProps {
  children: React.ReactNode
  file: FileItem
  selectedFiles: Set<string>
  onOpen: (file: FileItem) => void
  onRename: (file: FileItem) => void
  onDelete: (files: FileItem[]) => void
  onDownload: (file: FileItem) => void
  onCopy: (files: FileItem[]) => void
  onCut: (files: FileItem[]) => void
  onView: (file: FileItem) => void
}

export const FileContextMenu: React.FC<FileContextMenuProps> = ({
  children,
  file,
  selectedFiles,
  onOpen,
  onRename,
  onDelete,
  onDownload,
  onCopy,
  onCut,
  onView
}) => {
  const isSelected = selectedFiles.has(file.path)
  const selectedCount = selectedFiles.size
  const isMultipleSelected = selectedCount > 1
  const [contextMenuVisible, setContextMenuVisible] = React.useState(false)
  const [contextMenuPosition, setContextMenuPosition] = React.useState({ x: 0, y: 0 })

  const getSelectedFiles = (): FileItem[] => {
    if (isSelected && isMultipleSelected) {
      // 如果当前文件被选中且有多个选中项，操作所有选中的文件
      return Array.from(selectedFiles).map(path => ({ ...file, path }))
    } else {
      // 否则只操作当前文件
      return [file]
    }
  }

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault()
    setContextMenuPosition({ x: event.clientX, y: event.clientY })
    setContextMenuVisible(true)
    console.log('显示右键菜单:', file.name)
  }

  const handleMenuClick = () => {
    setContextMenuVisible(false)
  }

  React.useEffect(() => {
    const handleClickOutside = () => {
      setContextMenuVisible(false)
    }
    
    if (contextMenuVisible) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [contextMenuVisible])

  return (
    <>
      <div onContextMenu={handleContextMenu}>
        {children}
      </div>
      
      {contextMenuVisible && (
        <div
          className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-2 min-w-[160px]"
          style={{
            left: contextMenuPosition.x,
            top: contextMenuPosition.y,
            zIndex: 1000
          }}
          onClick={handleMenuClick}
        >
          {/* 打开/查看 */}
          <div
            className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center"
            onClick={() => {
              console.log('右键菜单 - 打开:', file.name)
              onOpen(file)
            }}
          >
            {file.type === 'directory' ? <FolderOpenOutlined className="mr-2" /> : <FileOutlined className="mr-2" />}
            {file.type === 'directory' ? '打开文件夹' : '打开文件'}
          </div>
          
          {/* 查看（仅文件） */}
          {file.type === 'file' && (
            <div
              className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center"
              onClick={() => onView(file)}
            >
              <EyeOutlined className="mr-2" />
              预览
            </div>
          )}
          
          <div className="border-t border-gray-200 dark:border-gray-600 my-1"></div>
          
          {/* 重命名（仅单个文件） */}
          {!isMultipleSelected && (
            <div
              className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center"
              onClick={() => onRename(file)}
            >
              <EditOutlined className="mr-2" />
              重命名
            </div>
          )}
          
          {/* 复制 */}
          <div
            className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center"
            onClick={() => onCopy(getSelectedFiles())}
          >
            <CopyOutlined className="mr-2" />
            {isMultipleSelected ? `复制 ${selectedCount} 项` : '复制'}
          </div>
          
          {/* 剪切 */}
          <div
            className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center"
            onClick={() => onCut(getSelectedFiles())}
          >
            <ScissorOutlined className="mr-2" />
            {isMultipleSelected ? `剪切 ${selectedCount} 项` : '剪切'}
          </div>
          
          <div className="border-t border-gray-200 dark:border-gray-600 my-1"></div>
          
          {/* 下载（仅文件） */}
          {file.type === 'file' && !isMultipleSelected && (
            <div
              className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center"
              onClick={() => onDownload(file)}
            >
              <DownloadOutlined className="mr-2" />
              下载
            </div>
          )}
          
          {/* 删除 */}
          <div
            className="px-4 py-2 hover:bg-red-100 dark:hover:bg-red-900/30 cursor-pointer flex items-center text-red-600 dark:text-red-400"
            onClick={() => onDelete(getSelectedFiles())}
          >
            <DeleteOutlined className="mr-2" />
            {isMultipleSelected ? `删除 ${selectedCount} 项` : '删除'}
          </div>
        </div>
      )}
    </>
  )
}