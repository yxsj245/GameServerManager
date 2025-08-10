import React, { useEffect, useState } from 'react'
import { AlertTriangle, X, ExternalLink } from 'lucide-react'

interface BrowserCompatibilityCheckerProps {
  children: React.ReactNode
}

const BrowserCompatibilityChecker: React.FC<BrowserCompatibilityCheckerProps> = ({ children }) => {
  const [isCompatible, setIsCompatible] = useState(true)
  const [showWarning, setShowWarning] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [userDismissed, setUserDismissed] = useState(false)

  useEffect(() => {
    // 检查用户是否已经忽略了警告
    const dismissedKey = 'gsm3_browser_compatibility_dismissed'
    const isDismissed = localStorage.getItem(dismissedKey) === 'true'
    if (isDismissed) {
      setUserDismissed(true)
      return
    }
    // 检测WebSocket支持
    const checkWebSocketSupport = () => {
      // 检查WebSocket是否存在
      if (typeof WebSocket === 'undefined') {
        console.warn('WebSocket API不可用')
        return false
      }

      // 检查Socket.IO相关的API支持
      try {
        // 检查WebSocket构造函数是否可用
        if (typeof WebSocket !== 'function') {
          console.warn('WebSocket不是一个构造函数')
          return false
        }

        // 检查必要的WebSocket属性和方法
        const requiredWebSocketFeatures = [
          'CONNECTING',
          'OPEN',
          'CLOSING',
          'CLOSED'
        ]

        // 验证WebSocket常量是否存在
        for (const feature of requiredWebSocketFeatures) {
          if (typeof WebSocket[feature as keyof typeof WebSocket] === 'undefined') {
            console.warn(`WebSocket缺少必要的常量: ${feature}`)
            return false
          }
        }

        // 在HTTPS环境下，进行更宽松的检测
        // 因为实际的Socket.IO连接会使用polling作为fallback
        if (window.location.protocol === 'https:') {
          console.info('HTTPS环境下使用宽松的WebSocket检测模式')
          return true // 在HTTPS环境下，如果基本API存在就认为支持
        }

        return true
      } catch (error) {
        console.warn('WebSocket支持检测失败:', error)
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
        'JSON',
        'XMLHttpRequest', // Socket.IO的polling传输需要
        'EventSource'     // Socket.IO的某些功能可能需要
      ]

      return requiredAPIs.every(api => {
        const apiExists = typeof window[api as keyof Window] !== 'undefined'
        if (!apiExists) {
          console.warn(`缺少必要的API: ${api}`)
        }
        return apiExists
      })
    }

    // 检测Socket.IO相关的功能支持
    const checkSocketIOSupport = () => {
      try {
        // 检查是否支持ArrayBuffer（Socket.IO二进制数据传输需要）
        if (typeof ArrayBuffer === 'undefined') {
          console.warn('不支持ArrayBuffer')
          return false
        }

        // 检查是否支持Blob（文件传输可能需要）
        if (typeof Blob === 'undefined') {
          console.warn('不支持Blob')
          return false
        }

        // 检查是否支持URL对象（某些功能可能需要）
        if (typeof URL === 'undefined') {
          console.warn('不支持URL对象')
          return false
        }

        return true
      } catch (error) {
        console.warn('Socket.IO功能检测失败:', error)
        return false
      }
    }

    const wsSupported = checkWebSocketSupport()
    const apisSupported = checkOtherAPIs()
    const socketIOSupported = checkSocketIOSupport()
    const compatible = wsSupported && apisSupported && socketIOSupported

    // 调试信息
    console.info('浏览器兼容性检查结果:', {
      webSocketSupported: wsSupported,
      apisSupported: apisSupported,
      socketIOSupported: socketIOSupported,
      compatible: compatible,
      protocol: window.location.protocol,
      userAgent: navigator.userAgent
    })

    if (!compatible) {
      console.warn('检测到浏览器兼容性问题，但这可能是误报。如果WebSocket连接实际工作正常，可以忽略此警告。')
    }

    setIsCompatible(compatible)

    // 如果不兼容且用户没有忽略警告，显示警告（延迟一点时间以确保页面加载完成）
    if (!compatible && !isDismissed) {
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

  const handleDismissWarning = () => {
    const dismissedKey = 'gsm3_browser_compatibility_dismissed'
    localStorage.setItem(dismissedKey, 'true')
    setUserDismissed(true)
    handleCloseWarning()
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
                  检测到您的浏览器可能不完全支持 WebSocket 协议或缺少必要的 Web API。
                </p>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                    重要提示：
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    如果您能正常使用终端、查看日志等功能，说明连接正常工作，可以安全地忽略此警告。
                    本系统使用 Socket.IO 技术，会自动选择最佳的连接方式。
                  </p>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400">
                  如果遇到以下功能异常，可能需要更新浏览器：
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
            <div className="flex justify-between items-center p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleDismissWarning}
                className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400
                         hover:text-gray-800 dark:hover:text-gray-200
                         transition-colors duration-200"
              >
                不再提醒
              </button>
              <div className="flex space-x-3">
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
        </div>
      )}
    </>
  )
}

export default BrowserCompatibilityChecker