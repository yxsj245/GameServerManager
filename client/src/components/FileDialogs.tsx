import React, { useState, useEffect } from 'react'
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

  useEffect(() => {
    if (visible) {
      form.resetFields()
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

  return (
    <Modal
      title={`创建${type === 'file' ? '文件' : '文件夹'}`}
      open={visible}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={loading}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        className="mt-4"
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
            placeholder={`请输入${type === 'file' ? '文件' : '文件夹'}名称`}
            autoFocus
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

  useEffect(() => {
    if (visible) {
      form.setFieldsValue({ name: currentName })
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

  return (
    <Modal
      title="重命名"
      open={visible}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={loading}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        className="mt-4"
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
            placeholder="请输入新名称"
            autoFocus
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
      const uploadFile: UploadFile = {
        uid: file.name + file.size + Date.now(),
        name: file.name,
        status: 'done',
        originFileObj: file as any
      }
      setFileList(prev => [...prev, uploadFile])
      return false // 阻止自动上传
    },
    onRemove: (file) => {
      setFileList(prev => prev.filter(f => f.uid !== file.uid))
    },
    fileList: fileList
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
      destroyOnClose
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