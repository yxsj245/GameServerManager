import React from 'react'
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

interface FileGridItemProps {
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

export const FileGridItem: React.FC<FileGridItemProps> = ({
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
    <div
        className={`
         relative group cursor-pointer p-4 rounded-lg border-2
          hover:shadow-lg hover:border-blue-300
        ${isSelected 
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md' 
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750'
        }
        ${file.type === 'directory' ? 'border-dashed' : ''}
      `}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {/* 选中状态指示器 */}
      {isSelected && (
        <div className="absolute top-2 right-2 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
          <div className="w-2 h-2 bg-white rounded-full"></div>
        </div>
      )}

      {/* 文件图标 */}
      <div className="flex flex-col items-center space-y-3">
        <div className="text-4xl">
          {getFileIcon(file.name, file.type)}
        </div>

        {/* 文件名 */}
        <div className="text-center w-full">
          <div 
            className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate px-1"
            title={file.name}
          >
            {file.name}
          </div>
          
          {/* 文件信息 */}
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 space-y-1">
            {file.type === 'file' && (
              <div>{formatFileSize(file.size)}</div>
            )}
            <div>{formatDate(file.modified)}</div>
          </div>
        </div>
      </div>

      {/* 悬停效果 */}

    </div>
  )
}