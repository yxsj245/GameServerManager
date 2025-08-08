import React, { useState, useEffect } from 'react'
import { useOnboardingStore } from '@/stores/onboardingStore'
import { useSystemStore } from '@/stores/systemStore'
import { 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Coffee,
  AlertCircle,
  Info,
  ExternalLink,
  RefreshCw
} from 'lucide-react'

interface JavaStatus {
  installed: boolean
  version?: string
  path?: string
  error?: string
}

const JavaOnboardingStep: React.FC = () => {
  const { completeStep } = useOnboardingStore()
  const { systemInfo } = useSystemStore()
  
  const [javaStatus, setJavaStatus] = useState<JavaStatus>({ installed: false })
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    checkJavaEnvironment()
  }, [])

  const checkJavaEnvironment = async () => {
    setIsChecking(true)
    try {
      const response = await fetch('/api/games/java/check', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('gsm3_token')}`
        }
      })
      const result = await response.json()
      
      if (result.success) {
        setJavaStatus(result.data)
        if (result.data.installed) {
          completeStep('java')
        }
      } else {
        setJavaStatus({ 
          installed: false, 
          error: result.error || '检查Java环境失败' 
        })
      }
    } catch (error) {
      console.error('检查Java环境失败:', error)
      setJavaStatus({ 
        installed: false, 
        error: '网络错误，请稍后重试' 
      })
    } finally {
      setIsChecking(false)
    }
  }

  const getInstallInstructions = () => {
    const isWindows = systemInfo?.platform?.toLowerCase().includes('windows')
    const isLinux = systemInfo?.platform?.toLowerCase().includes('linux')
    
    if (isWindows) {
      return {
        title: 'Windows 系统安装 Java',
        steps: [
          '访问 Oracle 官网或 OpenJDK 官网下载 Java',
          '下载适合您系统的 Java 安装包（推荐 Java 17 或更高版本）',
          '运行安装程序，按照向导完成安装',
          '安装完成后，Java 会自动添加到系统 PATH 中',
          '重新启动命令提示符或 PowerShell 以使环境变量生效'
        ],
        downloadLinks: [
          { name: 'Oracle JDK', url: 'https://www.oracle.com/java/technologies/downloads/' },
          { name: 'OpenJDK', url: 'https://openjdk.org/install/' },
          { name: 'Adoptium (推荐)', url: 'https://adoptium.net/' }
        ]
      }
    } else if (isLinux) {
      return {
        title: 'Linux 系统安装 Java',
        steps: [
          '使用包管理器安装 Java (推荐)',
          'Ubuntu/Debian: sudo apt update && sudo apt install openjdk-17-jdk',
          'CentOS/RHEL: sudo yum install java-17-openjdk-devel',
          'Arch Linux: sudo pacman -S jdk-openjdk',
          '或者从官网下载 tar.gz 包手动安装'
        ],
        downloadLinks: [
          { name: 'OpenJDK', url: 'https://openjdk.org/install/' },
          { name: 'Adoptium', url: 'https://adoptium.net/' }
        ]
      }
    } else {
      return {
        title: '安装 Java',
        steps: [
          '访问 Java 官网下载适合您系统的版本',
          '推荐安装 Java 17 或更高版本',
          '按照官方文档完成安装',
          '确保 Java 已添加到系统 PATH 中'
        ],
        downloadLinks: [
          { name: 'Oracle JDK', url: 'https://www.oracle.com/java/technologies/downloads/' },
          { name: 'OpenJDK', url: 'https://openjdk.org/install/' }
        ]
      }
    }
  }

  const installInstructions = getInstallInstructions()

  return (
    <div className="space-y-6">
      {/* Java 状态检查 */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Coffee className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Java 环境检测
            </h3>
          </div>
          <button
            onClick={checkJavaEnvironment}
            disabled={isChecking}
            className="flex items-center space-x-2 px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
            <span>重新检测</span>
          </button>
        </div>

        {isChecking ? (
          <div className="flex items-center space-x-3 py-4">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            <span className="text-gray-600 dark:text-gray-400">正在检测 Java 环境...</span>
          </div>
        ) : javaStatus.installed ? (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              <div>
                <h4 className="font-medium text-green-900 dark:text-green-100">
                  Java 环境已安装
                </h4>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  版本: {javaStatus.version}
                </p>
                {javaStatus.path && (
                  <p className="text-sm text-green-700 dark:text-green-300">
                    路径: {javaStatus.path}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              <div>
                <h4 className="font-medium text-red-900 dark:text-red-100">
                  未检测到 Java 环境
                </h4>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  {javaStatus.error || 'Java 未安装或不在 PATH 环境变量中'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 安装说明 */}
      {!javaStatus.installed && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            {installInstructions.title}
          </h3>
          
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">
                安装步骤:
              </h4>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 dark:text-gray-400">
                {installInstructions.steps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </div>

            <div>
              <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">
                下载链接:
              </h4>
              <div className="flex flex-wrap gap-2">
                {installInstructions.downloadLinks.map((link, index) => (
                  <a
                    key={index}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors text-sm"
                  >
                    <span>{link.name}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Java 用途说明 */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <p className="font-medium mb-2">Java 环境的用途:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>运行 Minecraft Java 版服务器 (Vanilla、Bukkit、Spigot、Paper 等)</li>
              <li>运行 Minecraft Forge 和 Fabric 模组服务器</li>
              <li>运行其他基于 Java 的游戏服务器</li>
              <li>某些游戏服务器管理工具也需要 Java 环境</li>
            </ul>
            <p className="mt-2 text-xs">
              <strong>注意:</strong> 如果您不需要运行 Java 游戏服务器，可以跳过此步骤。
            </p>
          </div>
        </div>
      </div>

      {/* 版本建议 */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
          <div className="text-sm text-yellow-700 dark:text-yellow-300">
            <p className="font-medium mb-2">Java 版本建议:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li><strong>Java 17:</strong> 推荐版本，支持最新的 Minecraft 服务器</li>
              <li><strong>Java 11:</strong> 兼容大部分 Minecraft 版本</li>
              <li><strong>Java 8:</strong> 仅适用于较老的 Minecraft 版本 (1.16 及以下)</li>
            </ul>
            <p className="mt-2 text-xs">
              建议安装 Java 17 以获得最佳兼容性和性能。
            </p>
          </div>
        </div>
      </div>

      {/* 完成按钮 */}
      {javaStatus.installed && (
        <div className="flex justify-end">
          <button
            onClick={() => completeStep('java')}
            className="flex items-center space-x-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Java 环境已就绪</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default JavaOnboardingStep
