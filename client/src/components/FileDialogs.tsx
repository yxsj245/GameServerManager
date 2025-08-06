import React, { useState, useEffect, useRef } from 'react'
import { Modal, Form, Input, Upload, message, Progress } from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import type { UploadProps, UploadFile } from 'antd'
import { FileUploadProgress } from '@/types/file'

const { Dragger } = Upload

interface CreateDialogProps {
  visible: boolean
  type: 'file' | 'folder'
  onConfirm: (name: string) => void
  onCancel: () => void
}

export const CreateDialog: React.FC<CreateDialogProps> = ({
  visible,
  type,
  onConfirm,
  onCancel
}) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<any>(null)

  useEffect(() => {
    if (visible) {
      form.resetFields()
      // 延迟聚焦，确保Modal完全打开后再聚焦
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          inputRef.current.select()
        }
      }, 100)
    }
  }, [visible, form])

  const handleOk = async () => {
    try {
      setLoading(true)
      const values = await form.validateFields()
      onConfirm(values.name)
      form.resetFields()
    } catch (error) {
      // 验证失败
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleOk()
    }
  }

  return (
    <Modal
      title={`创建${type === 'file' ? '文件' : '文件夹'}`}
      open={visible}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={loading}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        className="mt-4"
        onFinish={handleOk}
      >
        <Form.Item
          name="name"
          label={`${type === 'file' ? '文件' : '文件夹'}名称`}
          rules={[
            { required: true, message: '请输入名称' },
            { 
              pattern: /^[^<>:"/\\|?*]+$/, 
              message: '名称不能包含特殊字符' 
            }
          ]}
        >
          <Input 
            ref={inputRef}
            placeholder={`请输入${type === 'file' ? '文件' : '文件夹'}名称`}
            onKeyDown={handleKeyDown}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}

interface RenameDialogProps {
  visible: boolean
  currentName: string
  onConfirm: (newName: string) => void
  onCancel: () => void
}

export const RenameDialog: React.FC<RenameDialogProps> = ({
  visible,
  currentName,
  onConfirm,
  onCancel
}) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<any>(null)

  useEffect(() => {
    if (visible) {
      form.setFieldsValue({ name: currentName })
      // 延迟聚焦，确保Modal完全打开后再聚焦
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          // 选中文件名（不包括扩展名）
          const lastDotIndex = currentName.lastIndexOf('.')
          if (lastDotIndex > 0) {
            // 有扩展名，选中文件名部分
            inputRef.current.setSelectionRange(0, lastDotIndex)
          } else {
            // 没有扩展名或是隐藏文件，选中全部
            inputRef.current.select()
          }
        }
      }, 100)
    }
  }, [visible, currentName, form])

  const handleOk = async () => {
    try {
      setLoading(true)
      const values = await form.validateFields()
      onConfirm(values.name)
      form.resetFields()
    } catch (error) {
      // 验证失败
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleOk()
    }
  }

  return (
    <Modal
      title="重命名"
      open={visible}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={loading}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        className="mt-4"
        onFinish={handleOk}
      >
        <Form.Item
          name="name"
          label="新名称"
          rules={[
            { required: true, message: '请输入新名称' },
            { 
              pattern: /^[^<>:"/\\|?*]+$/, 
              message: '名称不能包含特殊字符' 
            }
          ]}
        >
          <Input 
            ref={inputRef}
            placeholder="请输入新名称"
            onKeyDown={handleKeyDown}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}

interface UploadDialogProps {
  visible: boolean
  onConfirm: (files: FileList, onProgress?: (progress: FileUploadProgress) => void) => void
  onCancel: () => void
}

export const UploadDialog: React.FC<UploadDialogProps> = ({
  visible,
  onConfirm,
  onCancel
}) => {
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [uploadProgress, setUploadProgress] = useState<FileUploadProgress | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [loading, setLoading] = useState(false)

  const uploadProps: UploadProps = {
    name: 'files',
    multiple: true,
    beforeUpload: (file) => {
      // 验证文件名是否包含中文字符
      const hasChineseChars = /[\u4e00-\u9fa5]/.test(file.name)
      
      // 检查文件名是否安全
      const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/
      if (dangerousChars.test(file.name)) {
        message.error(`文件名 "${file.name}" 包含不安全的字符，请重命名后再上传`)
        return Upload.LIST_IGNORE
      }
      
      // 检查文件名长度
      if (file.name.length > 255) {
        message.error(`文件名 "${file.name}" 过长，请使用较短的文件名`)
        return Upload.LIST_IGNORE
      }
      
      const uploadFile: UploadFile = {
        uid: file.name + file.size + Date.now(),
        name: file.name,
        status: 'done',
        originFileObj: file as any
      }
      
      setFileList(prev => [...prev, uploadFile])
      
      if (hasChineseChars) {
        console.log('Added Chinese filename to upload list:', file.name)
      }
      
      return false // 阻止自动上传
    },
    onRemove: (file) => {
      setFileList(prev => prev.filter(f => f.uid !== file.uid))
    },
    fileList: fileList,
    showUploadList: {
      showPreviewIcon: false,
      showRemoveIcon: true,
      showDownloadIcon: false
    }
  }

  const handleOk = async () => {
    if (fileList.length === 0) {
      message.warning('请选择要上传的文件')
      return
    }

    setLoading(true)
    setIsUploading(true)
    try {
      // 创建一个真正的FileList对象
      const dataTransfer = new DataTransfer()
      fileList.forEach(uploadFile => {
        if (uploadFile.originFileObj) {
          dataTransfer.items.add(uploadFile.originFileObj as File)
        }
      })
      const files = dataTransfer.files
      
      onConfirm(files, setUploadProgress)
      setFileList([])
    } finally {
      setLoading(false)
      setIsUploading(false)
      setUploadProgress(null)
    }
  }

  const handleCancel = () => {
    setFileList([])
    onCancel()
  }

  return (
    <Modal
      title="上传文件"
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={loading}
      destroyOnHidden
      width={600}
    >
      <div className="mt-4">
        <Dragger 
          {...uploadProps}
          disabled={isUploading}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined className="text-4xl text-blue-500" />
          </p>
          <p className="ant-upload-text text-lg font-medium">
            点击或拖拽文件到此区域上传
          </p>
          <p className="ant-upload-hint text-gray-500">
            支持单个或批量上传文件
          </p>
        </Dragger>
        
        {uploadProgress && (
          <div className="mt-4">
            <div className="mb-2 text-sm text-gray-600">
              正在上传: {uploadProgress.fileName}
            </div>
            <Progress 
              percent={uploadProgress.progress} 
              status={uploadProgress.progress === 100 ? 'success' : 'active'}
              showInfo
            />
          </div>
        )}
      </div>
    </Modal>
  )
}

interface DeleteConfirmDialogProps {
  visible: boolean
  fileNames: string[]
  onConfirm: () => void
  onCancel: () => void
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  visible,
  fileNames,
  onConfirm,
  onCancel
}) => {
  const [loading, setLoading] = useState(false)

  const handleOk = async () => {
    setLoading(true)
    try {
      onConfirm()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title="确认删除"
      open={visible}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={loading}
      okText="删除"
      cancelText="取消"
      okButtonProps={{ danger: true }}
    >
      <div className="mt-4">
        <p className="text-gray-700 dark:text-gray-300 mb-3">
          确定要删除以下{fileNames.length}个项目吗？此操作不可撤销。
        </p>
        <div className="max-h-40 overflow-y-auto bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          {fileNames.map((name, index) => (
            <div key={index} className="text-sm text-gray-600 dark:text-gray-400 py-1">
              {name}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}