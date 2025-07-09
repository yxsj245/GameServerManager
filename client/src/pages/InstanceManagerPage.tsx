import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  Play,
  Square,
  Edit,
  Trash2,
  FolderOpen,
  Settings,
  Activity,
  Clock,
  Terminal,
  AlertCircle,
  CheckCircle,
  Loader,
  Server
} from 'lucide-react'
import { Instance, CreateInstanceRequest } from '@/types'
import { useNotificationStore } from '@/stores/notificationStore'
import apiClient from '@/utils/api'
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog'

const InstanceManagerPage: React.FC = () => {
  const navigate = useNavigate()
  const { addNotification } = useNotificationStore()
  const [instances, setInstances] = useState<Instance[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingInstance, setEditingInstance] = useState<Instance | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [instanceToDelete, setInstanceToDelete] = useState<Instance | null>(null)
  const [formData, setFormData] = useState<CreateInstanceRequest>({
    name: '',
    description: '',
    workingDirectory: '',
    startCommand: '',
    autoStart: false,
    stopCommand: 'ctrl+c'
  })

  // 获取实例列表
  const fetchInstances = async () => {
    try {
      setLoading(true)
      const response = await apiClient.getInstances()
      if (response.success) {
        setInstances(response.data || [])
      }
    } catch (error) {
      console.error('获取实例列表失败:', error)
      addNotification({
        type: 'error',
        title: '获取失败',
        message: '无法获取实例列表'
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInstances()
  }, [])

  // 创建实例
  const handleCreateInstance = async () => {
    try {
      const response = await apiClient.createInstance(formData)
      if (response.success) {
        addNotification({
          type: 'success',
          title: '创建成功',
          message: `实例 "${formData.name}" 已创建`
        })
        setShowCreateModal(false)
        resetForm()
        fetchInstances()
      }
    } catch (error: any) {
      console.error('创建实例失败:', error)
      
      // 获取具体的错误消息
      let errorMessage = '无法创建实例'
      if (error.message) {
        errorMessage = error.message
      } else if (error.error) {
        errorMessage = error.error
      }
      
      addNotification({
        type: 'error',
        title: '创建失败',
        message: errorMessage
      })
    }
  }

  // 更新实例
  const handleUpdateInstance = async () => {
    if (!editingInstance) return
    
    try {
      const response = await apiClient.updateInstance(editingInstance.id, formData)
      if (response.success) {
        addNotification({
          type: 'success',
          title: '更新成功',
          message: `实例 "${formData.name}" 已更新`
        })
        setEditingInstance(null)
        resetForm()
        fetchInstances()
      }
    } catch (error: any) {
      console.error('更新实例失败:', error)
      
      // 获取具体的错误消息
      let errorMessage = '无法更新实例'
      if (error.message) {
        errorMessage = error.message
      } else if (error.error) {
        errorMessage = error.error
      }
      
      addNotification({
        type: 'error',
        title: '更新失败',
        message: errorMessage
      })
    }
  }

  // 启动实例
  const handleStartInstance = async (instance: Instance) => {
    try {
      const response = await apiClient.startInstance(instance.id)
      if (response.success) {
        addNotification({
          type: 'success',
          title: '启动成功',
          message: `实例 "${instance.name}" 正在启动`
        })
        
        // 如果返回了终端会话ID，使用sessionId参数跳转到终端页面
        if (response.data?.terminalSessionId) {
          navigate(`/terminal?sessionId=${response.data.terminalSessionId}&instance=${instance.id}&cwd=${encodeURIComponent(instance.workingDirectory)}`)
        } else {
          // 兼容旧版本，使用instance参数
          navigate(`/terminal?instance=${instance.id}&cwd=${encodeURIComponent(instance.workingDirectory)}`)
        }
        
        fetchInstances()
      }
    } catch (error: any) {
      console.error('启动实例失败:', error)
      
      // 获取具体的错误消息
      let errorMessage = '无法启动实例'
      if (error.message) {
        errorMessage = error.message
      } else if (error.error) {
        errorMessage = error.error
      }
      
      addNotification({
        type: 'error',
        title: '启动失败',
        message: errorMessage
      })
    }
  }

  // 停止实例
  const handleStopInstance = async (instance: Instance) => {
    try {
      const response = await apiClient.stopInstance(instance.id)
      if (response.success) {
        addNotification({
          type: 'success',
          title: '停止成功',
          message: `实例 "${instance.name}" 正在停止`
        })
        fetchInstances()
      }
    } catch (error: any) {
      console.error('停止实例失败:', error)
      
      // 获取具体的错误消息
      let errorMessage = '无法停止实例'
      if (error.message) {
        errorMessage = error.message
      } else if (error.error) {
        errorMessage = error.error
      }
      
      addNotification({
        type: 'error',
        title: '停止失败',
        message: errorMessage
      })
    }
  }

  // 删除实例
  const handleDeleteInstance = (instance: Instance) => {
    setInstanceToDelete(instance)
    setShowDeleteDialog(true)
  }

  // 确认删除实例
  const handleConfirmDelete = async (deleteDirectory: boolean) => {
    if (!instanceToDelete) return
    
    setShowDeleteDialog(false)
    
    try {
      const response = await apiClient.deleteInstance(instanceToDelete.id)
      if (response.success) {
        // 如果用户选择删除目录，发送删除目录的请求
        if (deleteDirectory) {
          try {
            // 调用删除目录的API
            const deleteResponse = await fetch('/api/files/delete', {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                paths: [instanceToDelete.workingDirectory]
              })
            })
            
            if (!deleteResponse.ok) {
              const errorData = await deleteResponse.json()
              throw new Error(errorData.message || '删除目录失败')
            }
            
            addNotification({
              type: 'success',
              title: '删除成功',
              message: `实例 "${instanceToDelete.name}" 已删除，工作目录也已删除`
            })
          } catch (dirError: any) {
            addNotification({
              type: 'warning',
              title: '目录删除失败',
              message: `实例已删除，但无法删除工作目录: ${dirError.message || '未知错误'}`
            })
          }
        } else {
          addNotification({
            type: 'success',
            title: '删除成功',
            message: `实例 "${instanceToDelete.name}" 已删除`
          })
        }
        
        fetchInstances()
      }
    } catch (error: any) {
      console.error('删除实例失败:', error)
      
      // 获取具体的错误消息
      let errorMessage = '无法删除实例'
      if (error.message) {
        errorMessage = error.message
      } else if (error.error) {
        errorMessage = error.error
      }
      
      addNotification({
        type: 'error',
        title: '删除失败',
        message: errorMessage
      })
    } finally {
      setInstanceToDelete(null)
    }
  }

  // 取消删除
  const handleCancelDelete = () => {
    setShowDeleteDialog(false)
    setInstanceToDelete(null)
  }

  // 打开文件目录
  const handleOpenDirectory = (instance: Instance) => {
    navigate(`/files?path=${encodeURIComponent(instance.workingDirectory)}`)
    addNotification({
      type: 'success',
      title: '跳转成功',
      message: `已打开 "${instance.name}" 的工作目录`
    })
  }

  // 重置表单
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      workingDirectory: '',
      startCommand: '',
      autoStart: false,
      stopCommand: 'ctrl+c'
    })
  }

  // 编辑实例
  const handleEditInstance = (instance: Instance) => {
    setEditingInstance(instance)
    setFormData({
      name: instance.name,
      description: instance.description,
      workingDirectory: instance.workingDirectory,
      startCommand: instance.startCommand,
      autoStart: instance.autoStart,
      stopCommand: instance.stopCommand
    })
    setShowCreateModal(true)
  }

  // 获取状态图标
  const getStatusIcon = (status: Instance['status']) => {
    switch (status) {
      case 'running':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'stopped':
        return <Square className="w-5 h-5 text-gray-500" />
      case 'starting':
      case 'stopping':
        return <Loader className="w-5 h-5 text-blue-500 animate-spin" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      default:
        return <Square className="w-5 h-5 text-gray-500" />
    }
  }

  // 获取状态文本
  const getStatusText = (status: Instance['status']) => {
    switch (status) {
      case 'running': return '运行中'
      case 'stopped': return '已停止'
      case 'starting': return '启动中'
      case 'stopping': return '停止中'
      case 'error': return '错误'
      default: return '未知'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">加载中...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">实例管理</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            管理和监控您的应用实例
          </p>
        </div>
        <button
          onClick={() => {
            setEditingInstance(null)
            resetForm()
            setShowCreateModal(true)
          }}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>创建实例</span>
        </button>
      </div>

      {/* 实例列表 */}
      {instances.length === 0 ? (
        <div className="text-center py-12">
          <Server className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            暂无实例
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            创建您的第一个实例来开始管理应用
          </p>
          <button
            onClick={() => {
              setEditingInstance(null)
              resetForm()
              setShowCreateModal(true)
            }}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>创建实例</span>
          </button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {instances.map((instance) => (
            <div
              key={instance.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow"
            >
              {/* 实例头部 */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {instance.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                    {instance.description}
                  </p>
                </div>
                <div className="flex items-center space-x-1 ml-4">
                  {getStatusIcon(instance.status)}
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {getStatusText(instance.status)}
                  </span>
                </div>
              </div>

              {/* 实例信息 */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <FolderOpen className="w-4 h-4 mr-2" />
                  <span className="truncate">{instance.workingDirectory}</span>
                </div>
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <Terminal className="w-4 h-4 mr-2" />
                  <span className="truncate">{instance.startCommand}</span>
                </div>
                {instance.lastStarted && (
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <Clock className="w-4 h-4 mr-2" />
                    <span>最后启动: {new Date(instance.lastStarted).toLocaleString()}</span>
                  </div>
                )}
                {instance.pid && (
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <Activity className="w-4 h-4 mr-2" />
                    <span>PID: {instance.pid}</span>
                  </div>
                )}
              </div>

              {/* 操作按钮 */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2">
                  {instance.status === 'running' ? (
                    <button
                      onClick={() => handleStopInstance(instance)}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
                    >
                      <Square className="w-4 h-4" />
                      <span>停止</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStartInstance(instance)}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors"
                      disabled={instance.status === 'starting' || instance.status === 'stopping'}
                    >
                      <Play className="w-4 h-4" />
                      <span>启动</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleOpenDirectory(instance)}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                  >
                    <FolderOpen className="w-4 h-4" />
                    <span>文件</span>
                  </button>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleEditInstance(instance)}
                    disabled={instance.status === 'running'}
                    className={`p-1.5 rounded transition-colors ${
                      instance.status === 'running'
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                    }`}
                    title={instance.status === 'running' ? '实例运行时无法编辑' : '编辑实例'}
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteInstance(instance)}
                    disabled={instance.status === 'running'}
                    className={`p-1.5 rounded transition-colors ${
                      instance.status === 'running'
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-gray-600 hover:text-red-600 hover:bg-red-50'
                    }`}
                    title={instance.status === 'running' ? '实例运行时无法删除' : '删除实例'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 创建/编辑实例模态框 */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              {editingInstance ? '编辑实例' : '创建实例'}
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  实例名称 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="输入实例名称"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  实例描述
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="输入实例描述"
                  rows={3}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  工作目录 *
                </label>
                <input
                  type="text"
                  value={formData.workingDirectory}
                  onChange={(e) => setFormData({ ...formData, workingDirectory: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="输入工作目录路径"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  启动命令 *
                </label>
                <input
                  type="text"
                  value={formData.startCommand}
                  onChange={(e) => setFormData({ ...formData, startCommand: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="输入启动命令"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  停止命令
                </label>
                <select
                  value={formData.stopCommand}
                  onChange={(e) => setFormData({ ...formData, stopCommand: e.target.value as 'ctrl+c' | 'stop' | 'exit' })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="ctrl+c">Ctrl+C</option>
                  <option value="stop">stop</option>
                  <option value="exit">exit</option>
                </select>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="autoStart"
                  checked={formData.autoStart}
                  onChange={(e) => setFormData({ ...formData, autoStart: e.target.checked })}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <label htmlFor="autoStart" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  自动启动
                </label>
              </div>
            </div>
            
            <div className="flex items-center justify-end space-x-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setEditingInstance(null)
                  resetForm()
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                取消
              </button>
              <button
                onClick={editingInstance ? handleUpdateInstance : handleCreateInstance}
                disabled={!formData.name || !formData.workingDirectory || !formData.startCommand}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {editingInstance ? '更新' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认对话框 */}
      <ConfirmDeleteDialog
        isOpen={showDeleteDialog}
        instanceName={instanceToDelete?.name || ''}
        workingDirectory={instanceToDelete?.workingDirectory || ''}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  )
}

export default InstanceManagerPage