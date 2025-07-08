/**
 * 浏览器兼容的路径处理工具函数
 * 替代Node.js的path模块在浏览器环境中的使用
 */

/**
 * 标准化路径，类似于path.normalize
 * @param pathStr 要标准化的路径
 * @returns 标准化后的路径
 */
export function normalizePath(pathStr: string): string {
  if (!pathStr) return '/'
  
  // 将反斜杠转换为正斜杠
  let normalized = pathStr.replace(/\\/g, '/')
  
  // 确保以/开头
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized
  }
  
  // 处理多个连续的斜杠
  normalized = normalized.replace(/\/+/g, '/')
  
  // 处理 . 和 .. 路径段
  const parts = normalized.split('/').filter(part => part !== '')
  const stack: string[] = []
  
  for (const part of parts) {
    if (part === '..') {
      if (stack.length > 0) {
        stack.pop()
      }
    } else if (part !== '.') {
      stack.push(part)
    }
  }
  
  // 重新构建路径
  const result = '/' + stack.join('/')
  return result === '/' ? '/' : result
}

/**
 * 获取路径的目录部分，类似于path.dirname
 * @param pathStr 文件路径
 * @returns 目录路径
 */
export function getDirectoryPath(pathStr: string): string {
  if (!pathStr || pathStr === '/') return '/'
  
  const normalized = normalizePath(pathStr)
  const lastSlashIndex = normalized.lastIndexOf('/')
  
  if (lastSlashIndex === 0) {
    return '/'
  }
  
  return normalized.substring(0, lastSlashIndex)
}

/**
 * 连接路径，类似于path.join
 * @param paths 要连接的路径段
 * @returns 连接后的路径
 */
export function joinPaths(...paths: string[]): string {
  if (paths.length === 0) return '/'
  
  const joined = paths
    .filter(path => path && path.length > 0)
    .join('/')
  
  return normalizePath(joined)
}

/**
 * 获取文件名，类似于path.basename
 * @param pathStr 文件路径
 * @param ext 可选的扩展名，如果提供则会从结果中移除
 * @returns 文件名
 */
export function getBasename(pathStr: string, ext?: string): string {
  if (!pathStr) return ''
  
  const normalized = normalizePath(pathStr)
  const parts = normalized.split('/')
  let basename = parts[parts.length - 1] || ''
  
  if (ext && basename.endsWith(ext)) {
    basename = basename.substring(0, basename.length - ext.length)
  }
  
  return basename
}

/**
 * 获取文件扩展名，类似于path.extname
 * @param pathStr 文件路径
 * @returns 文件扩展名（包含点号）
 */
export function getExtension(pathStr: string): string {
  if (!pathStr) return ''
  
  const basename = getBasename(pathStr)
  const lastDotIndex = basename.lastIndexOf('.')
  
  if (lastDotIndex === -1 || lastDotIndex === 0) {
    return ''
  }
  
  return basename.substring(lastDotIndex)
}

/**
 * 检查路径是否为绝对路径
 * @param pathStr 要检查的路径
 * @returns 是否为绝对路径
 */
export function isAbsolute(pathStr: string): boolean {
  return pathStr && pathStr.startsWith('/')
}

/**
 * 获取相对路径
 * @param from 起始路径
 * @param to 目标路径
 * @returns 相对路径
 */
export function getRelativePath(from: string, to: string): string {
  const fromNormalized = normalizePath(from)
  const toNormalized = normalizePath(to)
  
  if (fromNormalized === toNormalized) {
    return '.'
  }
  
  const fromParts = fromNormalized.split('/').filter(part => part !== '')
  const toParts = toNormalized.split('/').filter(part => part !== '')
  
  // 找到公共前缀
  let commonLength = 0
  const minLength = Math.min(fromParts.length, toParts.length)
  
  for (let i = 0; i < minLength; i++) {
    if (fromParts[i] === toParts[i]) {
      commonLength++
    } else {
      break
    }
  }
  
  // 构建相对路径
  const upLevels = fromParts.length - commonLength
  const downParts = toParts.slice(commonLength)
  
  const relativeParts: string[] = []
  
  // 添加向上的路径
  for (let i = 0; i < upLevels; i++) {
    relativeParts.push('..')
  }
  
  // 添加向下的路径
  relativeParts.push(...downParts)
  
  return relativeParts.length === 0 ? '.' : relativeParts.join('/')
}