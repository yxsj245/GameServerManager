import React, { useState, useEffect } from 'react'
import { X, AlertTriangle, Folder, Trash2 } from 'lucide-react'

interface ConfirmDeleteDialogProps {
  isOpen: boolean
  instanceName: string
  workingDirectory: string
  onConfirm: (deleteDirectory: boolean) => void
  onCancel: () => void
}

export const ConfirmDeleteDialog: React.FC<ConfirmDeleteDialogProps> = ({
  isOpen,
  instanceName,
  workingDirectory,
  onConfirm,
  onCancel
}) => {
  const [deleteDirectory, setDeleteDirectory] = React.useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
      setTimeout(() => setIsAnimating(true), 10)
    } else {
      setIsAnimating(false)
      setTimeout(() => setIsVisible(false), 200)
    }
  }, [isOpen])

  const handleCancel = () => {
    setIsAnimating(false)
    setTimeout(() => {
      onCancel()
    }, 200)
  }

  const handleConfirm = () => {
    setIsAnimating(false)
    setTimeout(() => {
      onConfirm(deleteDirectory)
    }, 200)
  }

  if (!isVisible) return null



  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div 
        className={`absolute inset-0 bg-black transition-opacity duration-200 ${
          isAnimating ? 'bg-opacity-50' : 'bg-opacity-0'
        }`}
        onClick={handleCancel}
      />
      
      {/* 对话框内容 */}
      <div className={`relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6 transform transition-all duration-200 ${
        isAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
      }`}>
        {/* 关闭按钮 */}
        <button
          onClick={handleCancel}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 标题和图标 */}
        <div className="flex items-center space-x-3 mb-4">
          <div className="flex-shrink-0">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              确认删除实例
            </h3>
          </div>
        </div>

        {/* 实例信息 */}
        <div className="mb-6">
          <p className="text-gray-600 dark:text-gray-300 mb-3">
            确定要删除实例 <span className="font-semibold text-gray-900 dark:text-white">"{instanceName}"</span> 吗？
          </p>
          
          {/* 工作目录信息 */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mb-4">
            <div className="flex items-center space-x-2 mb-2">
              <Folder className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">工作目录：</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 font-mono break-all">
              {workingDirectory}
            </p>
          </div>

          {/* 删除目录选项 */}
          <div className="border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={deleteDirectory}
                onChange={(e) => setDeleteDirectory(e.target.checked)}
                className="mt-1 w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500 dark:focus:ring-red-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <Trash2 className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    同时删除工作目录
                  </span>
                </div>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  ⚠️ 警告：此操作将永久删除该目录及其所有内容，无法恢复！
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
          >
            确认删除
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDeleteDialog