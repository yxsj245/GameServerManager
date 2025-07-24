import React, { useEffect, useState } from 'react'
import { AlertTriangle, X, ExternalLink } from 'lucide-react'

interface BrowserCompatibilityCheckerProps {
  children: React.ReactNode
}

const BrowserCompatibilityChecker: React.FC<BrowserCompatibilityCheckerProps> = ({ children }) => {
  const [isCompatible, setIsCompatible] = useState(true)
  const [showWarning, setShowWarning] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    // 检测WebSocket支持
    const checkWebSocketSupport = () => {
      // 检查WebSocket是否存在
      if (typeof WebSocket === 'undefined') {
        return false
      }

      // 尝试创建WebSocket连接来进一步验证
      try {
        // 创建一个测试WebSocket连接（使用无效地址，只是为了测试构造函数）
        const testWs = new WebSocket('ws://test-compatibility-check')
        testWs.close()
        return true
      } catch (error) {
        return false
      }
    }

    // 检测其他必要的Web API
    const checkOtherAPIs = () => {
      // 检查必要的API支持
      const requiredAPIs = [
        'fetch',
        'Promise',
        'localStorage',
        'sessionStorage',
        'JSON'
      ]

      return requiredAPIs.every(api => typeof window[api as keyof Window] !== 'undefined')
    }

    const wsSupported = checkWebSocketSupport()
    const apisSupported = checkOtherAPIs()
    const compatible = wsSupported && apisSupported

    setIsCompatible(compatible)

    // 如果不兼容，显示警告（延迟一点时间以确保页面加载完成）
    if (!compatible) {
      setTimeout(() => {
        setShowWarning(true)
        setIsAnimating(true)
      }, 500)
    }
  }, [])

  const handleCloseWarning = () => {
    setIsAnimating(false)
    setTimeout(() => {
      setShowWarning(false)
    }, 300)
  }

  const getBrowserRecommendations = () => {
    const userAgent = navigator.userAgent.toLowerCase()
    
    if (userAgent.includes('chrome')) {
      return '请更新到最新版本的 Chrome 浏览器'
    } else if (userAgent.includes('firefox')) {
      return '请更新到最新版本的 Firefox 浏览器'
    } else if (userAgent.includes('safari')) {
      return '请更新到最新版本的 Safari 浏览器'
    } else if (userAgent.includes('edge')) {
      return '请更新到最新版本的 Edge 浏览器'
    } else {
      return '推荐使用 Chrome、Firefox、Safari 或 Edge 的最新版本'
    }
  }

  const getDownloadLinks = () => [
    { name: 'Chrome', url: 'https://www.google.com/chrome/' },
    { name: 'Firefox', url: 'https://www.mozilla.org/firefox/' },
    { name: 'Edge', url: 'https://www.microsoft.com/edge' },
    { name: 'Safari', url: 'https://www.apple.com/safari/' }
  ]

  return (
    <>
      {children}
      
      {/* 兼容性警告弹窗 */}
      {showWarning && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* 背景遮罩 */}
          <div 
            className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
              isAnimating ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={handleCloseWarning}
          />
          
          {/* 警告弹窗 */}
          <div 
            className={`relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 max-w-md w-full mx-4 transform transition-all duration-300 ${
              isAnimating ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'
            }`}
          >
            {/* 头部 */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0 w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    浏览器兼容性警告
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    检测到兼容性问题
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseWarning}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 
                          transition-all duration-200 ease-in-out hover:scale-110 hover:bg-gray-100 
                          dark:hover:bg-gray-700 rounded-full p-2 -m-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* 内容 */}
            <div className="p-6 space-y-4">
              <div className="space-y-3">
                <p className="text-gray-700 dark:text-gray-300">
                  您的浏览器不支持 WebSocket 协议或缺少必要的 Web API，这可能导致以下功能无法正常使用：
                </p>
                
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400 ml-4">
                  <li>实时终端连接</li>
                  <li>实时日志查看</li>
                  <li>服务器状态监控</li>
                  <li>即时通知推送</li>
                </ul>
                
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                    建议解决方案：
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    {getBrowserRecommendations()}
                  </p>
                </div>
              </div>
              
              {/* 浏览器下载链接 */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  推荐浏览器下载：
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {getDownloadLinks().map((browser) => (
                    <a
                      key={browser.name}
                      href={browser.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center space-x-2 px-3 py-2 text-sm 
                               bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 
                               border border-blue-200 dark:border-blue-800 rounded-lg 
                               hover:bg-blue-100 dark:hover:bg-blue-900/30 
                               transition-colors duration-200"
                    >
                      <span>{browser.name}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
            
            {/* 底部按钮 */}
            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleCloseWarning}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 
                         bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 
                         rounded-lg transition-colors duration-200"
              >
                我知道了
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 
                         rounded-lg transition-colors duration-200"
              >
                刷新页面
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default BrowserCompatibilityChecker