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
  Server,
  ShoppingCart,
  Download
} from 'lucide-react'
import { Instance, CreateInstanceRequest } from '@/types'
import { useNotificationStore } from '@/stores/notificationStore'
import apiClient from '@/utils/api'
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog'

// 获取嵌套对象值的工具函数
const getNestedValue = (obj: any, path: string): any => {
  if (!obj || !path) return undefined

  // 1. 尝试将路径作为单个键直接访问，处理 'server.properties' 这样的顶级键
  if (Object.prototype.hasOwnProperty.call(obj, path)) {
    return obj[path]
  }

  // 2. 如果直接访问不到，假定路径是 'section.field' 格式
  const lastDotIndex = path.lastIndexOf('.')
  if (lastDotIndex === -1) {
    // 如果没有点，并且在第1步中也找不到，说明这个键不存在
    return undefined
  }

  const sectionKey = path.substring(0, lastDotIndex)
  const fieldKey = path.substring(lastDotIndex + 1)

  // 3. 检查节是否存在，并且是一个对象
  if (Object.prototype.hasOwnProperty.call(obj, sectionKey) && obj[sectionKey] && typeof obj[sectionKey] === 'object') {
    return obj[sectionKey][fieldKey]
  }

  return undefined
}

// 实例市场相关类型
interface MarketInstance {
  name: string
  command: string
  stopcommand: string
}

interface MarketResponse {
  instances: MarketInstance[]
}

interface InstallInstanceRequest {
  name: string
  command: string
  stopCommand: string
  workingDirectory: string
}

const InstanceManagerPage: React.FC = () => {
  const navigate = useNavigate()
  const { addNotification } = useNotificationStore()
  const [activeTab, setActiveTab] = useState<'instances' | 'market' | 'gameConfig'>('instances')
  const [instances, setInstances] = useState<Instance[]>([])
  const [marketInstances, setMarketInstances] = useState<MarketInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [marketLoading, setMarketLoading] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createModalAnimating, setCreateModalAnimating] = useState(false)
  const [showInstallModal, setShowInstallModal] = useState(false)
  const [installModalAnimating, setInstallModalAnimating] = useState(false)
  const [selectedMarketInstance, setSelectedMarketInstance] = useState<MarketInstance | null>(null)
  const [editingInstance, setEditingInstance] = useState<Instance | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [instanceToDelete, setInstanceToDelete] = useState<Instance | null>(null)
  const [installFormData, setInstallFormData] = useState({ workingDirectory: '' })
  const [formData, setFormData] = useState<CreateInstanceRequest>({
    name: '',
    description: '',
    workingDirectory: '',
    startCommand: '',
    autoStart: false,
    stopCommand: 'ctrl+c'
  })

  // 游戏配置相关状态
  const [availableConfigs, setAvailableConfigs] = useState<any[]>([])
  const [selectedInstance, setSelectedInstance] = useState<string>('')
  const [selectedConfigId, setSelectedConfigId] = useState<string>('')
  const [configSchema, setConfigSchema] = useState<any>(null)
  const [configData, setConfigData] = useState<any>({})
  const [isConfigLoading, setIsConfigLoading] = useState(false)
  const [isSavingConfig, setIsSavingConfig] = useState(false)
  
  // Python环境检测状态
  const [pythonStatus, setPythonStatus] = useState<{
    available: boolean
    version?: string
    error?: string
    checking: boolean
  }>({ available: false, checking: true })

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

  // 获取可用配置列表
  const fetchAvailableConfigs = async () => {
    try {
      const response = await apiClient.getAvailableConfigs()
      setAvailableConfigs(response.data)
    } catch (error) {
      console.error('获取配置列表失败:', error)
    }
  }

  // 检测Python环境
  const checkPythonEnvironment = async () => {
    try {
      setPythonStatus(prev => ({ ...prev, checking: true }))
      const response = await apiClient.checkPythonEnvironment()
      
      if (response.success) {
        setPythonStatus({
          available: response.data.available,
          version: response.data.version,
          error: response.data.error,
          checking: false
        })
        
        if (!response.data.available) {
          addNotification({
            type: 'warning',
            title: 'Python环境检测',
            message: `当前系统中未检测到Python环境，游戏配置功能将无法使用`
          })
        }
      } else {
        setPythonStatus({
          available: false,
          error: response.error || '检测失败',
          checking: false
        })
      }
    } catch (error) {
      console.error('Python环境检测失败:', error)
      setPythonStatus({
        available: false,
        error: '检测异常',
        checking: false
      })
      addNotification({
        type: 'error',
        title: 'Python环境检测失败',
        message: '无法检测Python环境状态'
      })
    }
  }

  // 获取配置模板
  const fetchConfigSchema = async (configId: string) => {
    try {
      setIsConfigLoading(true)
      const response = await apiClient.getConfigSchema(configId)
      setConfigSchema(response.data)
      return response.data // 返回获取到的配置模式数据
    } catch (error) {
      console.error('获取配置模板失败:', error)
      addNotification({
        type: 'error',
        title: '获取失败',
        message: '获取配置模板失败'
      })
      return null
    } finally {
      setIsConfigLoading(false)
    }
  }

  // 读取游戏配置
  const loadGameConfig = async (instanceId: string, configId: string, schema?: any) => {
    try {
      setIsConfigLoading(true)
      const response = await apiClient.readGameConfig(instanceId, configId)
      console.log('从服务器读取的配置数据:', response.data)
      // 使用传入的配置模式或当前的配置模式填充默认值
      const currentSchema = schema || configSchema
      const filledData = fillDefaultValues(currentSchema, response.data)
      console.log('填充默认值后的配置数据:', filledData)
      setConfigData(filledData)
    } catch (error) {
      console.error('读取配置失败:', error)
      addNotification({
        type: 'error',
        title: '读取失败',
        message: '读取配置失败'
      })
      // 即使读取失败，也尝试使用默认值创建配置
      const currentSchema = schema || configSchema
      const defaultData = fillDefaultValues(currentSchema, {})
      console.log('使用默认值的配置数据:', defaultData)
      setConfigData(defaultData)
    } finally {
      setIsConfigLoading(false)
    }
  }

  // 保存游戏配置
  const saveGameConfig = async () => {
    if (!selectedInstance || !selectedConfigId) {
      addNotification({
        type: 'warning',
        title: '提示',
        message: '请选择实例和配置文件'
      })
      return
    }

    console.log('准备保存配置:', {
      selectedInstance,
      selectedConfigId,
      configData: JSON.stringify(configData, null, 2)
    })

    try {
      setIsSavingConfig(true)
      await apiClient.saveGameConfig(selectedInstance, selectedConfigId, configData)
      addNotification({
        type: 'success',
        title: '保存成功',
        message: '配置保存成功'
      })
    } catch (error) {
      console.error('保存配置失败:', error)
      addNotification({
        type: 'error',
        title: '保存失败',
        message: '保存配置失败'
      })
    } finally {
      setIsSavingConfig(false)
    }
  }

  // 处理配置选择变化
  const handleConfigSelection = async (instanceId: string, configId: string) => {
    setSelectedInstance(instanceId)
    setSelectedConfigId(configId)
    
    if (instanceId && configId) {
      // 先获取配置模式
      const schemaResponse = await fetchConfigSchema(configId)
      // 直接传递获取到的配置模式给loadGameConfig
      if (schemaResponse) {
        await loadGameConfig(instanceId, configId, schemaResponse)
      } else {
        await loadGameConfig(instanceId, configId)
      }
    } else {
      setConfigSchema(null)
      setConfigData({})
    }
  }

  // 填充默认值到配置数据
  const fillDefaultValues = (schema: any, currentData: any = {}) => {
    if (!schema || !schema.sections) return currentData
    
    const filledData = { ...currentData }
    
    // 处理sections数组
    if (Array.isArray(schema.sections)) {
      schema.sections.forEach((section: any) => {
        const sectionKey = section.key || 'default'
        if (!filledData[sectionKey]) {
          filledData[sectionKey] = {}
        }
        
        if (section.fields && Array.isArray(section.fields)) {
          section.fields.forEach((field: any) => {
            if (filledData[sectionKey][field.name] === undefined && field.default !== undefined) {
              filledData[sectionKey][field.name] = field.default
            }
          })
        }
      })
    } else {
      // 兼容旧格式：sections是对象
      Object.entries(schema.sections).forEach(([sectionKey, section]: [string, any]) => {
        if (!filledData[sectionKey]) {
          filledData[sectionKey] = {}
        }
        
        if (section.fields && Array.isArray(section.fields)) {
          section.fields.forEach((field: any) => {
            if (filledData[sectionKey][field.name] === undefined && field.default !== undefined) {
              filledData[sectionKey][field.name] = field.default
            }
          })
        }
      })
    }
    
    return filledData
  }

  // 处理配置数据变化
  const handleConfigDataChange = (path: string, value: any) => {
    console.log('配置数据变化:', { path, value, currentConfigData: configData })
    setConfigData((prev) => {
      const newData = { ...prev }
      const lastDotIndex = path.lastIndexOf('.')

      if (lastDotIndex === -1) {
        // 如果没有点，直接更新顶级属性
        newData[path] = value
        console.log('更新后的配置数据:', newData)
        return newData
      }

      const sectionKey = path.substring(0, lastDotIndex)
      const fieldKey = path.substring(lastDotIndex + 1)

      const oldSection = prev[sectionKey]
      // 确保我们总是基于一个对象进行扩展，如果原始节不是对象，则创建一个新对象
      const newSection = oldSection && typeof oldSection === 'object' ? { ...oldSection } : {}

      newSection[fieldKey] = value
      newData[sectionKey] = newSection

      console.log('更新后的配置数据:', newData)
      return newData
    })
  }

  // 获取实例市场列表
  const fetchMarketInstances = async () => {
    try {
      setMarketLoading(true)
      const response = await apiClient.getMarketInstances()
      if (response.success) {
        setMarketInstances(response.data?.instances || [])
      }
    } catch (error) {
      console.error('获取实例市场列表失败:', error)
      addNotification({
        type: 'error',
        title: '获取失败',
        message: '无法获取实例市场列表'
      })
    } finally {
      setMarketLoading(false)
    }
  }

  useEffect(() => {
    fetchInstances()
    fetchAvailableConfigs()
  }, [])

  useEffect(() => {
    if (activeTab === 'market' && marketInstances.length === 0) {
      fetchMarketInstances()
    }
    // 当切换到游戏配置标签时检测Python环境
    if (activeTab === 'gameConfig') {
      checkPythonEnvironment()
    }
  }, [activeTab])

  // 监听configData变化
  useEffect(() => {
    console.log('configData状态已更新:', configData)
  }, [configData])

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
        handleCloseCreateModal()
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
        handleCloseCreateModal()
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

  // 安装市场实例
  const handleInstallMarketInstance = async () => {
    if (!selectedMarketInstance || !installFormData.workingDirectory) return
    
    try {
      // 转换停止命令格式
      let stopCommand: 'ctrl+c' | 'stop' | 'exit' = 'ctrl+c'
      if (selectedMarketInstance.stopcommand === '^C') {
        stopCommand = 'ctrl+c'
      } else if (selectedMarketInstance.stopcommand === 'stop') {
        stopCommand = 'stop'
      } else if (selectedMarketInstance.stopcommand === 'exit') {
        stopCommand = 'exit'
      }
      
      const installData: CreateInstanceRequest = {
        name: selectedMarketInstance.name,
        description: `从实例市场安装的 ${selectedMarketInstance.name}`,
        workingDirectory: installFormData.workingDirectory,
        startCommand: selectedMarketInstance.command,
        autoStart: false,
        stopCommand
      }
      
      const response = await apiClient.createInstance(installData)
      if (response.success) {
        addNotification({
          type: 'success',
          title: '安装成功',
          message: `实例 "${selectedMarketInstance.name}" 已安装`
        })
        handleCloseInstallModal()
        fetchInstances()
        setActiveTab('instances')
      }
    } catch (error: any) {
      console.error('安装实例失败:', error)
      
      let errorMessage = '无法安装实例'
      if (error.message) {
        errorMessage = error.message
      } else if (error.error) {
        errorMessage = error.error
      }
      
      addNotification({
        type: 'error',
        title: '安装失败',
        message: errorMessage
      })
    }
  }

  // 打开安装模态框
  const handleOpenInstallModal = (marketInstance: MarketInstance) => {
    setSelectedMarketInstance(marketInstance)
    setShowInstallModal(true)
    setTimeout(() => setInstallModalAnimating(true), 10)
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
            // 调用删除目录的API，使用ApiClient确保包含认证token
            const token = localStorage.getItem('gsm3_token')
            const deleteResponse = await fetch('/api/files/delete', {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
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

  // 关闭创建/编辑模态框
  const handleCloseCreateModal = () => {
    setCreateModalAnimating(false)
    setTimeout(() => {
      setShowCreateModal(false)
      setEditingInstance(null)
      resetForm()
    }, 300)
  }

  // 关闭安装模态框
  const handleCloseInstallModal = () => {
    setInstallModalAnimating(false)
    setTimeout(() => {
      setShowInstallModal(false)
      setSelectedMarketInstance(null)
      setInstallFormData({ workingDirectory: '' })
    }, 300)
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
    setTimeout(() => setCreateModalAnimating(true), 10)
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
        {activeTab === 'instances' && (
          <button
            onClick={() => {
              setEditingInstance(null)
              resetForm()
              setShowCreateModal(true)
              setTimeout(() => setCreateModalAnimating(true), 10)
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>创建实例</span>
          </button>
        )}
      </div>

      {/* 标签页导航 */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('instances')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'instances'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Server className="w-4 h-4" />
              <span>我的实例</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('market')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'market'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <ShoppingCart className="w-4 h-4" />
              <span>实例市场</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('gameConfig')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'gameConfig'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Settings className="w-4 h-4" />
              <span>游戏配置文件</span>
            </div>
          </button>
        </nav>
      </div>

      {/* 标签页内容 */}
      {activeTab === 'instances' ? (
        /* 我的实例列表 */
        instances.length === 0 ? (
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
                setTimeout(() => setCreateModalAnimating(true), 10)
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
        )
      ) : activeTab === 'market' ? (
        /* 实例市场 */
        <div className="space-y-6">
          {marketLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader className="w-8 h-8 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-600 dark:text-gray-400">加载实例市场...</span>
            </div>
          ) : marketInstances.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                暂无可用实例
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                实例市场暂时没有可用的实例模板
              </p>
              <button
                onClick={fetchMarketInstances}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <span>刷新</span>
              </button>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {marketInstances.map((marketInstance, index) => (
                <div
                  key={index}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow"
                >
                  {/* 实例头部 */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                        {marketInstance.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        来自实例市场的预配置实例
                      </p>
                    </div>
                    <div className="flex items-center space-x-1 ml-4">
                      <ShoppingCart className="w-5 h-5 text-blue-500" />
                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        可安装
                      </span>
                    </div>
                  </div>

                  {/* 实例信息 */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <Terminal className="w-4 h-4 mr-2" />
                      <span className="truncate">启动命令: {marketInstance.command}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <Square className="w-4 h-4 mr-2" />
                      <span className="truncate">停止命令: {marketInstance.stopcommand}</span>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => handleOpenInstallModal(marketInstance)}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      <span>安装</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* 游戏配置文件 */
        <div className="relative space-y-6">
          {/* Python环境检测覆盖层 */}
          {pythonStatus.checking && (
            <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
              <div className="text-center">
                <Loader className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
                <p className="text-gray-600 dark:text-gray-400">正在检测Python环境...</p>
              </div>
            </div>
          )}
          
          {!pythonStatus.checking && !pythonStatus.available && (
            <div className="absolute inset-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
              <div className="text-center max-w-md mx-auto p-6">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Python环境未检测到
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  当前系统中未检测到Python环境，游戏配置功能需要Python支持才能正常使用。
                </p>
                {pythonStatus.error && (
                  <p className="text-sm text-red-600 dark:text-red-400 mb-4">
                    错误信息: {pythonStatus.error}
                  </p>
                )}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => window.open('https://www.python.org/downloads/', '_blank')}
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    <span>前往下载Python</span>
                  </button>
                  <button
                    onClick={checkPythonEnvironment}
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>重新检测</span>
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* 原有内容，当Python不可用时会被覆盖层遮挡 */}
          <div className={`${!pythonStatus.available && !pythonStatus.checking ? 'pointer-events-none opacity-50' : ''}`}>
          {/* 选择区域 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              选择实例和配置文件
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 选择实例 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  选择实例
                </label>
                <select
                  value={selectedInstance}
                  onChange={(e) => handleConfigSelection(e.target.value, selectedConfigId)}
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
              
              {/* 选择配置文件 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  选择配置文件
                </label>
                <select
                  value={selectedConfigId}
                  onChange={(e) => handleConfigSelection(selectedInstance, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={!selectedInstance}
                >
                  <option value="">请选择配置文件</option>
                  {availableConfigs.map((config) => (
                    <option key={config.id} value={config.id}>
                      {config.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          
          {/* 配置编辑区域 */}
          {selectedInstance && selectedConfigId && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  配置编辑
                </h3>
                <button
                  onClick={saveGameConfig}
                  disabled={isSavingConfig || isConfigLoading}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSavingConfig ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <Settings className="w-4 h-4" />
                  )}
                  <span>{isSavingConfig ? '保存中...' : '保存配置'}</span>
                </button>
              </div>
              
              {isConfigLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader className="w-8 h-8 animate-spin text-blue-500" />
                  <span className="ml-2 text-gray-600 dark:text-gray-400">加载配置中...</span>
                </div>
              ) : configSchema ? (
                <div className="space-y-6" key={`config-form-${selectedInstance}-${selectedConfigId}`}>
                  {/* 动态渲染配置表单 - 按sections分组 */}
                  {(Array.isArray(configSchema.sections) ? configSchema.sections : Object.entries(configSchema.sections || {})).map((sectionData: any, sectionIndex: number) => {
                    // 处理数组格式和对象格式的sections
                    const section = Array.isArray(configSchema.sections) ? sectionData : sectionData[1]
                    const sectionKey = Array.isArray(configSchema.sections) ? (section.key || 'default') : sectionData[0]
                    
                    return (
                    <div key={sectionKey || sectionIndex} className="space-y-4">
                      {/* Section标题 */}
                      {sectionKey && (
                        <div className="border-b border-gray-200 dark:border-gray-700 pb-2">
                          <h4 className="text-md font-medium text-gray-900 dark:text-white">
                            {section.display_name || sectionKey}
                          </h4>
                          {section.description && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              {section.description}
                            </p>
                          )}
                        </div>
                      )}
                      
                      {/* Section字段 */}
                      <div className="space-y-4 pl-4">
                        {section.fields?.map((field: any, fieldIndex: number) => {
                          const fieldPath = sectionKey ? `${sectionKey}.${field.name}` : field.name
                          const fieldValue = getNestedValue(configData, fieldPath)
                          
                          return (
                            <div key={field.name || fieldIndex} className="space-y-2">
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                {field.display || field.name}
                                {field.required && <span className="text-red-500 ml-1">*</span>}
                              </label>
                              
                              {field.description && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {field.description}
                                </p>
                              )}
                              
                              {field.type === 'string' && (
                                <input
                                  type="text"
                                  value={fieldValue !== undefined && fieldValue !== null ? fieldValue : (field.default || '')}
                                  onChange={(e) => handleConfigDataChange(fieldPath, e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  placeholder="请输入值"
                                />
                              )}
                              
                              {(field.type === 'integer' || field.type === 'number') && (
                                <input
                                  type="number"
                                  value={fieldValue !== undefined && fieldValue !== null ? fieldValue.toString() : (field.default !== undefined ? field.default.toString() : '')}
                                  onChange={(e) => {
                                    const value = e.target.value
                                    if (value === '') {
                                      handleConfigDataChange(fieldPath, field.default !== undefined ? field.default : (field.type === 'integer' ? 0 : 0.0))
                                    } else {
                                      const numValue = field.type === 'integer' ? parseInt(value) : parseFloat(value)
                                      handleConfigDataChange(fieldPath, isNaN(numValue) ? (field.default !== undefined ? field.default : (field.type === 'integer' ? 0 : 0.0)) : numValue)
                                    }
                                  }}
                                  step={field.type === 'integer' ? '1' : 'any'}
                                  min={field.min}
                                  max={field.max}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  placeholder="请输入数值"
                                />
                              )}
                              
                              {field.type === 'boolean' && (
                                <div className="flex items-center space-x-3">
                                  <label className="flex items-center cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={fieldValue !== undefined ? Boolean(fieldValue) : Boolean(field.default)}
                                      onChange={(e) => {
                                        handleConfigDataChange(fieldPath, e.target.checked)
                                      }}
                                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                                    />
                                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                                      {fieldValue !== undefined ? Boolean(fieldValue) : Boolean(field.default) ? '启用' : '禁用'}
                                    </span>
                                  </label>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    当前值: {fieldValue !== undefined ? (Boolean(fieldValue) ? 'true' : 'false') : (Boolean(field.default) ? 'true' : 'false')}
                                  </span>
                                </div>
                              )}
                              
                              {(field.type === 'enum' || field.type === 'select') && (
                                <select
                                  value={fieldValue !== undefined && fieldValue !== null ? fieldValue : (field.default || '')}
                                  onChange={(e) => handleConfigDataChange(fieldPath, e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                  <option value="">请选择</option>
                                  {field.options?.map((option: any) => {
                                    // 支持两种格式：字符串数组和对象数组
                                    if (typeof option === 'string') {
                                      return (
                                        <option key={option} value={option}>
                                          {option}
                                        </option>
                                      )
                                    } else if (option && typeof option === 'object' && option.value) {
                                      return (
                                        <option key={option.value} value={option.value}>
                                          {option.label || option.value}
                                        </option>
                                      )
                                    }
                                    return null
                                  })}
                                </select>
                              )}
                              
                              {(field.type === 'float' || field.type === 'double') && (
                                <input
                                  type="number"
                                  value={fieldValue !== undefined && fieldValue !== null ? fieldValue.toString() : (field.default !== undefined ? field.default.toString() : '')}
                                  onChange={(e) => {
                                    const value = e.target.value
                                    if (value === '') {
                                      handleConfigDataChange(fieldPath, field.default !== undefined ? field.default : 0.0)
                                    } else {
                                      const numValue = parseFloat(value)
                                      handleConfigDataChange(fieldPath, isNaN(numValue) ? (field.default !== undefined ? field.default : 0.0) : numValue)
                                    }
                                  }}
                                  step="any"
                                  min={field.min}
                                  max={field.max}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  placeholder="请输入小数值"
                                />
                              )}
                              
                              {/* 默认处理未知类型为文本输入 */}
                               {!['string', 'integer', 'number', 'boolean', 'enum', 'select', 'float', 'double'].includes(field.type) && (
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    value={fieldValue !== undefined && fieldValue !== null ? fieldValue.toString() : (field.default !== undefined ? field.default.toString() : '')}
                                    onChange={(e) => handleConfigDataChange(fieldPath, e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="请输入值"
                                  />
                                  <p className="text-xs text-yellow-600 dark:text-yellow-400">
                                    未知类型 '{field.type}' - 作为文本处理
                                  </p>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    请选择实例和配置文件开始编辑
                  </p>
                </div>
              )}
            </div>
          )}
          
          {/* 空状态 */}
          {(!selectedInstance || !selectedConfigId) && (
            <div className="text-center py-12">
              <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                游戏配置文件管理
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                选择实例和配置文件来开始可视化编辑游戏配置
              </p>
            </div>
          )}
          </div>
        </div>
      )}

      {/* 创建/编辑实例模态框 */}
      {showCreateModal && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 transition-opacity duration-300 ${
          createModalAnimating ? 'opacity-100' : 'opacity-0'
        }`}>
          <div className={`bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto transform transition-all duration-300 ${
            createModalAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          }`}>
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
                onClick={handleCloseCreateModal}
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

      {/* 安装实例模态框 */}
      {showInstallModal && selectedMarketInstance && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 transition-opacity duration-300 ${
          installModalAnimating ? 'opacity-100' : 'opacity-0'
        }`}>
          <div className={`bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 transform transition-all duration-300 ${
            installModalAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          }`}>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              安装实例: {selectedMarketInstance.name}
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  实例名称
                </label>
                <input
                  type="text"
                  value={selectedMarketInstance.name}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  启动命令
                </label>
                <input
                  type="text"
                  value={selectedMarketInstance.command}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  停止命令
                </label>
                <input
                  type="text"
                  value={selectedMarketInstance.stopcommand}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  运行目录 *
                </label>
                <input
                  type="text"
                  value={installFormData.workingDirectory}
                  onChange={(e) => setInstallFormData({ workingDirectory: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="请输入实例的运行目录路径"
                />
              </div>
            </div>
            
            <div className="flex items-center justify-end space-x-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleCloseInstallModal}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleInstallMarketInstance}
                disabled={!installFormData.workingDirectory}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                安装
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