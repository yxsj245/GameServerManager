import React from 'react'
import { Dropdown, Menu } from 'antd'
import type { MenuProps } from 'antd'
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

  const getSelectedFiles = (): FileItem[] => {
    if (isSelected && isMultipleSelected) {
      // 如果当前文件被选中且有多个选中项，操作所有选中的文件
      return Array.from(selectedFiles).map(path => ({ ...file, path }))
    } else {
      // 否则只操作当前文件
      return [file]
    }
  }

  const menuItems: MenuProps['items'] = [
    // 打开/查看
    {
      key: 'open',
      label: file.type === 'directory' ? '打开文件夹' : '打开文件',
      icon: file.type === 'directory' ? <FolderOpenOutlined /> : <FileOutlined />,
      onClick: () => onOpen(file)
    },
    
    // 查看（仅文件）
    ...(file.type === 'file' ? [{
      key: 'view',
      label: '预览',
      icon: <EyeOutlined />,
      onClick: () => onView(file)
    }] : []),
    
    { type: 'divider' as const },
    
    // 重命名（仅单个文件）
    ...(!isMultipleSelected ? [{
      key: 'rename',
      label: '重命名',
      icon: <EditOutlined />,
      onClick: () => onRename(file)
    }] : []),
    
    // 复制
    {
      key: 'copy',
      label: isMultipleSelected ? `复制 ${selectedCount} 项` : '复制',
      icon: <CopyOutlined />,
      onClick: () => onCopy(getSelectedFiles())
    },
    
    // 剪切
    {
      key: 'cut',
      label: isMultipleSelected ? `剪切 ${selectedCount} 项` : '剪切',
      icon: <ScissorOutlined />,
      onClick: () => onCut(getSelectedFiles())
    },
    
    { type: 'divider' as const },
    
    // 下载（仅文件）
    ...(file.type === 'file' && !isMultipleSelected ? [{
      key: 'download',
      label: '下载',
      icon: <DownloadOutlined />,
      onClick: () => onDownload(file)
    }] : []),
    
    // 删除
    {
      key: 'delete',
      label: isMultipleSelected ? `删除 ${selectedCount} 项` : '删除',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: () => onDelete(getSelectedFiles())
    }
  ]

  return (
    <Dropdown
      menu={{ items: menuItems }}
      trigger={['contextMenu']}
      placement="bottomLeft"
      overlayClassName="file-context-menu"
      overlayStyle={{
        minWidth: '160px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}
    >
      {children}
    </Dropdown>
  )
}