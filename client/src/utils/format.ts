// 格式化文件大小
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 格式化日期
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) {
    // 今天
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    })
  } else if (diffDays === 1) {
    // 昨天
    return '昨天 ' + date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    })
  } else if (diffDays < 7) {
    // 一周内
    return diffDays + '天前'
  } else {
    // 超过一周
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  }
}

// 获取文件扩展名
export const getFileExtension = (fileName: string): string => {
  return fileName.split('.').pop()?.toLowerCase() || ''
}

// 判断是否为图片文件
export const isImageFile = (fileName: string): boolean => {
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp']
  return imageExts.includes(getFileExtension(fileName))
}

// 判断是否为文本文件
export const isTextFile = (fileName: string): boolean => {
  const textExts = [
    'txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'jsx', 'tsx',
    'py', 'java', 'cpp', 'c', 'h', 'php', 'go', 'rs', 'sql', 'yml', 'yaml',
    'ini', 'conf', 'log', 'csv', 'scss', 'less', 'vue', 'svelte'
  ]
  return textExts.includes(getFileExtension(fileName))
}

// 判断是否为视频文件
export const isVideoFile = (fileName: string): boolean => {
  const videoExts = ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v']
  return videoExts.includes(getFileExtension(fileName))
}

// 判断是否为音频文件
export const isAudioFile = (fileName: string): boolean => {
  const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma']
  return audioExts.includes(getFileExtension(fileName))
}

// 判断是否为压缩文件
export const isArchiveFile = (fileName: string): boolean => {
  const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz']
  return archiveExts.includes(getFileExtension(fileName))
}