/**
 * 剪贴板工具函数
 * 提供兼容性更好的复制到剪贴板功能
 */

/**
 * 复制文本到剪贴板
 * 支持现代浏览器的 navigator.clipboard API 和传统的 document.execCommand 降级方案
 * @param text 要复制的文本
 * @returns Promise<boolean> 复制是否成功
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    // 优先使用现代 Clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    } else {
      // 降级方案：使用传统的 document.execCommand
      return fallbackCopyToClipboard(text)
    }
  } catch (err) {
    console.warn('Clipboard API 失败，尝试降级方案:', err)
    // 如果现代 API 失败，尝试降级方案
    return fallbackCopyToClipboard(text)
  }
}

/**
 * 降级方案：使用 document.execCommand 复制文本
 * @param text 要复制的文本
 * @returns boolean 复制是否成功
 */
const fallbackCopyToClipboard = (text: string): boolean => {
  try {
    // 创建临时的 textarea 元素
    const textArea = document.createElement('textarea')
    textArea.value = text
    
    // 设置样式使其不可见
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    textArea.style.top = '-999999px'
    textArea.style.opacity = '0'
    textArea.style.pointerEvents = 'none'
    
    // 添加到 DOM
    document.body.appendChild(textArea)
    
    // 选择文本
    textArea.focus()
    textArea.select()
    
    // 执行复制命令
    const successful = document.execCommand('copy')
    
    // 清理
    document.body.removeChild(textArea)
    
    return successful
  } catch (err) {
    console.error('降级复制方案也失败了:', err)
    return false
  }
}

/**
 * 检查是否支持剪贴板 API
 * @returns boolean 是否支持
 */
export const isClipboardSupported = (): boolean => {
  return !!(navigator.clipboard && window.isSecureContext) || document.queryCommandSupported?.('copy')
}