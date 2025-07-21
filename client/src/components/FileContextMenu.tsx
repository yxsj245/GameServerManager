import React from 'react'
import {
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  ScissorOutlined,
  DownloadOutlined,
  CloudDownloadOutlined,
  FileOutlined,
  FolderOpenOutlined,
  EyeOutlined,
  SnippetsOutlined,
  FileZipOutlined,
  FolderOutlined,
  ConsoleSqlOutlined,
  SoundOutlined
} from '@ant-design/icons'
import { FileItem } from '@/types/file'
import { copyToClipboard } from '@/utils/clipboard'
import { useNotificationStore } from '@/stores/notificationStore'

interface FileContextMenuProps {
  children: React.ReactNode
  file: FileItem
  selectedFiles: Set<string>
  clipboard: {
    items: string[]
    operation: 'copy' | 'cut' | null
  }
  // 菜单全局状态props
  globalContextMenuInfo: {
    file: FileItem | null
    position: { x: number; y: number }
  } | null
  onOpen: (file: FileItem) => void
  onRename: (file: FileItem) => void
  onDelete: (files: FileItem[]) => void
  onDownload: (file: FileItem) => void
  onDownloadWithProgress: (file: FileItem) => void
  onCopy: (files: FileItem[]) => void
  onCut: (files: FileItem[]) => void
  onPaste: () => void
  onView: (file: FileItem) => void
  onCompress: (files: FileItem[]) => void
  onExtract: (file: FileItem) => void
  onOpenTerminal: (file: FileItem) => void
  onAddToPlaylist?: (files: FileItem[]) => void
  // 菜单全局状态props
  setGlobalContextMenuInfo: React.Dispatch<React.SetStateAction<{
    file: FileItem | null
    position: { x: number; y: number }
  } | null>>
}

export const FileContextMenu: React.FC<FileContextMenuProps> = ({
  children,
  file,
  selectedFiles,
  clipboard,
  globalContextMenuInfo,
  onOpen,
  onRename,
  onDelete,
  onDownload,
  onDownloadWithProgress,
  onCopy,
  onCut,
  onPaste,
  onView,
  onCompress,
  onExtract,
  onOpenTerminal,
  onAddToPlaylist,
  setGlobalContextMenuInfo
}) => {
  const { addNotification } = useNotificationStore()
  const isSelected = selectedFiles.has(file.path)
  const selectedCount = selectedFiles.size
  const isMultipleSelected = selectedCount > 1
  const contextMenuVisible = globalContextMenuInfo?.file?.path === file.path;
  const contextMenuPosition = globalContextMenuInfo?.position || { x: 0, y: 0 };
  // 解决右键菜单溢出问题
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = React.useState(contextMenuPosition);

  const getSelectedFiles = (): FileItem[] => {
    if (isSelected && isMultipleSelected) {
      // 如果当前文件被选中且有多个选中项，操作所有选中的文件
      return Array.from(selectedFiles).map(path => ({ ...file, path }))
    } else {
      // 否则只操作当前文件
      return [file]
    }
  }

  // 检查是否为音频文件
  const isAudioFile = (fileName: string): boolean => {
    const supportedFormats = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac']
    return supportedFormats.some(format => 
      fileName.toLowerCase().endsWith(format)
    )
  }

  // 检查是否为支持的压缩文件
  const isArchiveFile = (fileName: string): boolean => {
    const supportedFormats = ['.zip', '.tar', '.tar.gz', '.tar.xz', '.tgz']
    return supportedFormats.some(format => 
      fileName.toLowerCase().endsWith(format)
    )
  }

  // 检查选中的文件中是否有音频文件
  const hasAudioFiles = (): boolean => {
    const files = getSelectedFiles()
    return files.some(f => f.type === 'file' && isAudioFile(f.name))
  }

  const handleContextMenu = (event: React.MouseEvent) => {
  event.preventDefault();
  setGlobalContextMenuInfo({file, position: { x: event.clientX, y: event.clientY }});
  //日志
  console.log('显示右键菜单:', file.name);
  };

  const handleMenuClick = () => {
  setGlobalContextMenuInfo(null);
  };

  // 复制绝对路径到剪贴板
  const handleCopyAbsolutePath = async (file: FileItem) => {
    const absolutePath = file.path
    
    try {
      const success = await copyToClipboard(absolutePath)
      
      if (success) {
        addNotification({
          type: 'success',
          title: '复制成功',
          message: `已复制路径到剪贴板: ${absolutePath}`
        })
        console.log("路径已复制到剪贴板:", absolutePath)
      } else {
        addNotification({
          type: 'error',
          title: '复制失败',
          message: '无法复制路径到剪贴板，请手动复制'
        })
        console.error("无法复制路径到剪贴板")
      }
    } catch (err) {
      addNotification({
        type: 'error',
        title: '复制失败',
        message: '复制路径时发生错误'
      })
      console.error("复制路径时发生错误:", err)
    }
  }

  React.useEffect(() => {
    if (contextMenuVisible) {
      const handleClickOutside = () => setGlobalContextMenuInfo(null);
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenuVisible, setGlobalContextMenuInfo]);
  
  // 解决菜单溢出问题
  React.useLayoutEffect(() => {
    if (contextMenuVisible && menuRef.current) {
      const { x, y } = contextMenuPosition;
      const menuRect = menuRef.current.getBoundingClientRect();
      const menuWidth = menuRect.width;
      const menuHeight = menuRect.height;
      const winWidth = window.innerWidth;
      const winHeight = window.innerHeight;

      let adjustedX = x;
      let adjustedY = y;

      // 判断是否溢出右边或下边，需修正
      if (x + menuWidth > winWidth) {
        adjustedX = Math.max(0, x - menuWidth);
      }
      if (y + menuHeight > winHeight) {
        adjustedY = Math.max(0, y - menuHeight);
      }
      if (adjustedX !== adjustedPosition.x || adjustedY !== adjustedPosition.y) {
        setAdjustedPosition({ x: adjustedX, y: adjustedY });
      }
    }
    // 菜单关闭时回到初始坐标
    if (!contextMenuVisible && (adjustedPosition.x !== contextMenuPosition.x || adjustedPosition.y !== contextMenuPosition.y)) {
      setAdjustedPosition(contextMenuPosition);
    }
  }, [contextMenuVisible, contextMenuPosition, file.path, menuRef.current]);

  return (
    <>
      <div onContextMenu={handleContextMenu}>
        {children}
      </div>
      
      {contextMenuVisible && (
        <div
          className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-2 min-w-[160px]"
          ref={menuRef}
          style={{
            left: adjustedPosition.x,
            top: adjustedPosition.y,
            zIndex: 1000,
            opacity: adjustedPosition === contextMenuPosition ? 0 : 1,
            pointerEvents: adjustedPosition === contextMenuPosition ? 'none' : 'auto'
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
          
          {/* 从此文件夹处打开终端（仅文件夹） */}
          {file.type === 'directory' && (
            <div
              className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center"
              onClick={() => onOpenTerminal(file)}
            >
              <ConsoleSqlOutlined className="mr-2" />
              从此文件夹处打开终端
            </div>
          )}
          
          {/* 复制绝对路径 */}
          <div
            className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center"
            onClick={() => handleCopyAbsolutePath(file)}
          >
            <CopyOutlined className="mr-2" />
            复制绝对路径
          </div>

          {/* 添加到播放列表（仅音频文件） */}
          {onAddToPlaylist && hasAudioFiles() && (
            <div
              className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center"
              onClick={() => onAddToPlaylist(getSelectedFiles())}
            >
              <SoundOutlined className="mr-2" />
              {isMultipleSelected ? `添加 ${selectedCount} 项到播放列表` : '添加到播放列表'}
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
          
          {/* 粘贴 */}
          {clipboard.operation && clipboard.items.length > 0 && (
            <div
              className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center"
              onClick={onPaste}
            >
              <SnippetsOutlined className="mr-2" />
              粘贴 {clipboard.items.length} 项
            </div>
          )}
          
          <div className="border-t border-gray-200 dark:border-gray-600 my-1"></div>
          
          {/* 压缩 */}
          <div
            className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center"
            onClick={() => onCompress(getSelectedFiles())}
          >
            <FileZipOutlined className="mr-2" />
            {isMultipleSelected ? `压缩 ${selectedCount} 项` : '压缩'}
          </div>
          
          {/* 解压（支持多种压缩格式） */}
          {file.type === 'file' && !isMultipleSelected && 
            isArchiveFile(file.name) && (
            <div
              className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center"
              onClick={() => onExtract(file)}
            >
              <FolderOutlined className="mr-2" />
              解压
            </div>
          )}
          
          <div className="border-t border-gray-200 dark:border-gray-600 my-1"></div>
          
          {/* 下载（仅文件） */}
          {file.type === 'file' && !isMultipleSelected && (
            <>
              <div
                className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center"
                onClick={() => onDownload(file)}
              >
                <DownloadOutlined className="mr-2" />
                直接下载
              </div>
              <div
                className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center"
                onClick={() => onDownloadWithProgress(file)}
              >
                <CloudDownloadOutlined className="mr-2" />
                异步下载
              </div>
            </>
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