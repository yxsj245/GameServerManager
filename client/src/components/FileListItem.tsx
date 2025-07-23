import React from 'react'
import { motion } from 'framer-motion'
import { FileItem } from '@/types/file'
import {
  FolderOutlined,
  FileTextOutlined,
  FileImageOutlined,
  FileZipOutlined,
  VideoCameraOutlined,
  AudioOutlined,
  CodeOutlined,
  FileOutlined
} from '@ant-design/icons'
import { formatFileSize, formatDate } from '@/utils/format'

interface FileListItemProps {
  file: FileItem
  isSelected: boolean
  onClick: (file: FileItem, event: React.MouseEvent) => void
  onDoubleClick: (file: FileItem) => void
}

// 根据文件扩展名获取图标
const getFileIcon = (fileName: string, type: string) => {
  if (type === 'directory') {
    return <FolderOutlined className="text-blue-500" />
  }

  const ext = fileName.split('.').pop()?.toLowerCase()
  
  switch (ext) {
    case 'txt':
    case 'md':
    case 'doc':
    case 'docx':
      return <FileTextOutlined className="text-blue-600" />
    
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'bmp':
    case 'svg':
    case 'webp':
      return <FileImageOutlined className="text-green-500" />
    
    case 'zip':
    case 'rar':
    case '7z':
    case 'tar':
    case 'gz':
      return <FileZipOutlined className="text-orange-500" />
    
    case 'mp4':
    case 'avi':
    case 'mkv':
    case 'mov':
    case 'wmv':
    case 'flv':
      return <VideoCameraOutlined className="text-red-500" />
    
    case 'mp3':
    case 'wav':
    case 'flac':
    case 'aac':
    case 'ogg':
      return <AudioOutlined className="text-purple-500" />
    
    case 'js':
    case 'ts':
    case 'jsx':
    case 'tsx':
    case 'html':
    case 'css':
    case 'scss':
    case 'json':
    case 'xml':
    case 'py':
    case 'java':
    case 'cpp':
    case 'c':
    case 'php':
    case 'go':
    case 'rs':
      return <CodeOutlined className="text-indigo-500" />
    
    default:
      return <FileOutlined className="text-gray-500" />
  }
}

export const FileListItem: React.FC<FileListItemProps> = ({
  file,
  isSelected,
  onClick,
  onDoubleClick
}) => {
  const handleClick = (event: React.MouseEvent) => {
    onClick(file, event)
  }

  const handleDoubleClick = () => {
    onDoubleClick(file)
  }

  return (
    <motion.div
      data-file-item="true"
      className={`
        relative group cursor-pointer p-3 rounded-lg border select-none
        hover:shadow-md hover:border-blue-300 transition-all duration-200
        ${isSelected 
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md' 
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750'
        }
      `}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      whileHover={{ 
        scale: 1.01,
        x: 4,
        transition: { duration: 0.2, ease: "easeOut" }
      }}
      whileTap={{ 
        scale: 0.99,
        transition: { duration: 0.1 }
      }}
    >
      <div className="flex items-center space-x-3">
        {/* 选中状态指示器 */}
        {isSelected && (
          <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
            <div className="w-2 h-2 bg-white rounded-full"></div>
          </div>
        )}
        
        {/* 文件图标 */}
        <div className="text-2xl flex-shrink-0">
          {getFileIcon(file.name, file.type)}
        </div>

        {/* 文件信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            {/* 文件名 */}
            <div 
              className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate pr-4"
              title={file.name}
            >
              {file.name}
            </div>
            
            {/* 文件大小 */}
            <div className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
              {file.type === 'file' ? formatFileSize(file.size) : '--'}
            </div>
          </div>
          
          {/* 修改时间 */}
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {formatDate(file.modified)}
          </div>
        </div>
      </div>
    </motion.div>
  )
}