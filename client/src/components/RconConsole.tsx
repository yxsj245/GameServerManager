import React, { useState, useEffect, useRef } from 'react'
import { Terminal, Settings, Wifi, WifiOff, Send, Loader, AlertCircle, CheckCircle } from 'lucide-react'
import { RconConfig, RconConnectionStatus, RconCommandRequest, RconCommandResponse, RconState } from '@/types'
import { useNotificationStore } from '@/stores/notificationStore'
import apiClient from '@/utils/api'

const RconConsole: React.FC = () => {
  const { addNotification } = useNotificationStore()
  const [rconState, setRconState] = useState<RconState>({
    config: {
      host: 'localhost',
      port: 25575,
      password: '',
      timeout: 5000
    },
    connected: false,
    connecting: false,
    error: null,
    commandHistory: []
  })
  
  const [currentCommand, setCurrentCommand] = useState('')
  
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('')
  const [instances, setInstances] = useState<any[]>([])
  const [showConfig, setShowConfig] = useState(false)
  const [configAnimating, setConfigAnimating] = useState(false)
  const [isLoadingConfig, setIsLoadingConfig] = useState(false)
  const [isSavingConfig, setIsSavingConfig] = useState(false)
  
  const commandInputRef = useRef<HTMLInputElement>(null)
  const historyRef = useRef<HTMLDivElement>(null)

  // 获取实例列表
  useEffect(() => {
    fetchInstances()
  }, [])

  // 自动滚动到底部
  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight
    }
  }, [rconState.commandHistory])

  const fetchInstances = async () => {
    try {
      const response = await apiClient.getInstances()
      if (response.success) {
        setInstances(response.data || [])
      }
    } catch (error) {
      console.error('获取实例列表失败:', error)
    }
  }

  const loadRconConfig = async (instanceId: string) => {
    if (!instanceId) return
    
    try {
      setIsLoadingConfig(true)
      const response = await apiClient.getRconConfig(instanceId)
      if (response.success) {
        setRconState(prev => ({
          ...prev,
          config: { ...prev.config, ...response.data }
        }))
      }
    } catch (error) {
      console.error('加载RCON配置失败:', error)
      addNotification({
        type: 'error',
        title: '加载失败',
        message: '加载RCON配置失败'
      })
    } finally {
      setIsLoadingConfig(false)
    }
  }

  const saveRconConfig = async () => {
    if (!selectedInstanceId) {
      addNotification({
        type: 'error',
        title: '保存失败',
        message: '请先选择实例'
      })
      return
    }

    try {
      setIsSavingConfig(true)
      const response = await apiClient.saveRconConfig(selectedInstanceId, rconState.config!)
      if (response.success) {
        addNotification({
          type: 'success',
          title: '保存成功',
          message: 'RCON配置已保存'
        })
        setShowConfig(false)
        setTimeout(() => setConfigAnimating(false), 300)
      }
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: '保存失败',
        message: error.response?.data?.message || '保存RCON配置失败'
      })
    } finally {
      setIsSavingConfig(false)
    }
  }

  const connectRcon = async () => {
    if (!selectedInstanceId) {
      addNotification({
        type: 'error',
        title: '连接失败',
        message: '请先选择实例'
      })
      return
    }

    try {
      setRconState(prev => ({ ...prev, connecting: true, error: null }))
      const response = await apiClient.connectRcon(selectedInstanceId)
      if (response.success) {
        setRconState(prev => ({
          ...prev,
          connected: true,
          connecting: false,
          commandHistory: [
            ...prev.commandHistory,
            {
              command: '',
              response: `已连接到 ${prev.config?.host}:${prev.config?.port}`,
              timestamp: new Date().toLocaleTimeString()
            }
          ]
        }))
        addNotification({
          type: 'success',
          title: '连接成功',
          message: 'RCON连接已建立'
        })
      }
    } catch (error: any) {
      setRconState(prev => ({ 
        ...prev, 
        connecting: false,
        error: error.response?.data?.message || 'RCON连接失败'
      }))
      addNotification({
        type: 'error',
        title: '连接失败',
        message: error.response?.data?.message || 'RCON连接失败'
      })
    }
  }

  const disconnectRcon = async () => {
    if (!selectedInstanceId) return

    try {
      const response = await apiClient.disconnectRcon(selectedInstanceId)
      if (response.success) {
        setRconState(prev => ({
          ...prev,
          connected: false,
          error: null,
          commandHistory: [
            ...prev.commandHistory,
            {
              command: '',
              response: 'RCON连接已断开',
              timestamp: new Date().toLocaleTimeString()
            }
          ]
        }))
        addNotification({
          type: 'info',
          title: '连接断开',
          message: 'RCON连接已断开'
        })
      }
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: '断开失败',
        message: error.response?.data?.message || 'RCON断开失败'
      })
    }
  }

  const executeCommand = async () => {
    if (!selectedInstanceId || !currentCommand.trim() || !rconState.connected) return

    const command = currentCommand.trim()
    
    try {
      // 添加命令到历史记录
      setRconState(prev => ({
        ...prev,
        commandHistory: [
          ...prev.commandHistory,
          {
            command: command,
            response: '',
            timestamp: new Date().toLocaleTimeString()
          }
        ]
      }))

      setCurrentCommand('')

      const response = await apiClient.executeRconCommand(selectedInstanceId, command)
      
      // 更新最后一条记录的响应
      setRconState(prev => ({
        ...prev,
        commandHistory: prev.commandHistory.map((item, index) => 
          index === prev.commandHistory.length - 1 
            ? { ...item, response: response.data?.response || '命令执行完成' }
            : item
        )
      }))
    } catch (error: any) {
      // 更新最后一条记录的响应为错误信息
      setRconState(prev => ({
        ...prev,
        commandHistory: prev.commandHistory.map((item, index) => 
          index === prev.commandHistory.length - 1 
            ? { ...item, response: `错误: ${error.response?.data?.message || '命令执行失败'}` }
            : item
        )
      }))
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && rconState.connected && currentCommand.trim()) {
      executeCommand()
    }
  }

  const handleInstanceChange = (instanceId: string) => {
    setSelectedInstanceId(instanceId)
    if (instanceId) {
      loadRconConfig(instanceId)
    }
    // 断开当前连接
    if (rconState.connected) {
      disconnectRcon()
    }
  }

  const handleShowConfig = () => {
    setShowConfig(true)
    setTimeout(() => setConfigAnimating(true), 10)
  }

  const handleCloseConfig = () => {
    setConfigAnimating(false)
    setTimeout(() => setShowConfig(false), 300)
  }

  const getConnectionStatusIcon = () => {
    if (rconState.connecting) {
      return <Loader className="w-4 h-4 animate-spin text-yellow-500" />
    }
    return rconState.connected ? 
      <CheckCircle className="w-4 h-4 text-green-500" /> : 
      <AlertCircle className="w-4 h-4 text-red-500" />
  }

  const getConnectionStatusText = () => {
    if (rconState.connecting) return '连接中...'
    return rconState.connected ? '已连接' : '未连接'
  }

  const getConnectionStatusColor = () => {
    if (rconState.connecting) return 'text-yellow-600 bg-yellow-100'
    return rconState.connected ? 
      'text-green-600 bg-green-100' : 
      'text-red-600 bg-red-100'
  }

  return (
    <div className="space-y-6">
      {/* 实例选择和连接状态 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <Terminal className="w-5 h-5 mr-2" />
            RCON控制台
          </h3>
          <div className="flex items-center space-x-2">
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${getConnectionStatusColor()}`}>
              {getConnectionStatusIcon()}
              <span>{getConnectionStatusText()}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 选择实例 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              选择实例
            </label>
            <select
              value={selectedInstanceId}
              onChange={(e) => handleInstanceChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">请选择实例</option>
              {instances.map((instance) => (
                <option key={instance.id} value={instance.id}>
                  {instance.name}
                </option>
              ))}
            </select>
          </div>

          {/* 连接操作 */}
          <div className="flex items-end space-x-2">
            <button
              onClick={handleShowConfig}
              disabled={!selectedInstanceId}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span>配置</span>
            </button>
            
            {rconState.connected ? (
              <button
                onClick={disconnectRcon}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <WifiOff className="w-4 h-4" />
                <span>断开</span>
              </button>
            ) : (
              <button
                onClick={connectRcon}
                disabled={!selectedInstanceId || rconState.connecting}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {rconState.connecting ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Wifi className="w-4 h-4" />
                )}
                <span>{rconState.connecting ? '连接中...' : '连接'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 控制台区域 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">命令控制台</h4>
        
        {/* 命令历史 */}
        <div 
          ref={historyRef}
          className="bg-gray-900 text-green-400 p-4 rounded-lg h-64 overflow-y-auto font-mono text-sm mb-4"
        >
          {rconState.commandHistory.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              {selectedInstanceId ? '等待命令输入...' : '请先选择实例并连接RCON'}
            </div>
          ) : (
            rconState.commandHistory.map((entry, index) => (
              <div key={index} className="mb-2">
                <div className="text-blue-400">
                    [{entry.timestamp}] &gt; {entry.command}
                  </div>
                {entry.response && (
                  <div className="text-green-400 ml-4">
                    {entry.response}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* 命令输入 */}
        <div className="flex space-x-2">
          <input
            ref={commandInputRef}
            type="text"
            value={currentCommand}
            onChange={(e) => setCurrentCommand(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={!rconState.connected}
            placeholder={rconState.connected ? "输入RCON命令..." : "请先连接RCON"}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={executeCommand}
            disabled={!rconState.connected || !currentCommand.trim()}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
            <span>发送</span>
          </button>
        </div>
      </div>

      {/* 配置模态框 */}
      {showConfig && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 transition-opacity duration-300 ${
          configAnimating ? 'opacity-100' : 'opacity-0'
        }`}>
          <div className={`bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 transform transition-all duration-300 ${
            configAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          }`}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              RCON配置
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  主机地址
                </label>
                <input
                  type="text"
                  value={rconState.config.host}
                  onChange={(e) => setRconState(prev => ({
                    ...prev,
                    config: { ...prev.config, host: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="localhost"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  端口
                </label>
                <input
                  type="number"
                  value={rconState.config.port}
                  onChange={(e) => setRconState(prev => ({
                    ...prev,
                    config: { ...prev.config, port: parseInt(e.target.value) || 25575 }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="25575"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  密码
                </label>
                <input
                  type="password"
                  value={rconState.config.password}
                  onChange={(e) => setRconState(prev => ({
                    ...prev,
                    config: { ...prev.config, password: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="输入RCON密码"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  超时时间 (毫秒)
                </label>
                <input
                  type="number"
                  value={rconState.config.timeout}
                  onChange={(e) => setRconState(prev => ({
                    ...prev,
                    config: { ...prev.config, timeout: parseInt(e.target.value) || 5000 }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="5000"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={handleCloseConfig}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={saveRconConfig}
                disabled={isSavingConfig || isLoadingConfig}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSavingConfig ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Settings className="w-4 h-4" />
                )}
                <span>{isSavingConfig ? '保存中...' : '保存'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RconConsole