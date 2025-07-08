import React, { useState } from 'react'
import { Modal, Input, Select, Form, InputNumber } from 'antd'

interface CompressDialogProps {
  visible: boolean
  fileCount: number
  onConfirm: (archiveName: string, format: string, compressionLevel: number) => void
  onCancel: () => void
}

export const CompressDialog: React.FC<CompressDialogProps> = ({
  visible,
  fileCount,
  onConfirm,
  onCancel
}) => {
  const [form] = Form.useForm()
  const [archiveName, setArchiveName] = useState('archive')
  const [format, setFormat] = useState('zip')
  const [compressionLevel, setCompressionLevel] = useState(6)

  const handleOk = () => {
    const finalArchiveName = archiveName.endsWith(`.${format}`) 
      ? archiveName 
      : `${archiveName}.${format}`
    onConfirm(finalArchiveName, format, compressionLevel)
    form.resetFields()
    setArchiveName('archive')
    setFormat('zip')
    setCompressionLevel(6)
  }

  const handleCancel = () => {
    onCancel()
    form.resetFields()
    setArchiveName('archive')
    setFormat('zip')
    setCompressionLevel(6)
  }

  return (
    <Modal
      title="压缩文件"
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      okText="压缩"
      cancelText="取消"
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          archiveName: 'archive',
          format: 'zip',
          compressionLevel: 6
        }}
      >
        <p className="mb-4 text-gray-600 dark:text-gray-400">
          将要压缩 {fileCount} 个项目
        </p>
        
        <Form.Item
          label="压缩文件名"
          name="archiveName"
          rules={[{ required: true, message: '请输入压缩文件名' }]}
        >
          <Input
            value={archiveName}
            onChange={(e) => setArchiveName(e.target.value)}
            placeholder="请输入压缩文件名"
            suffix={`.${format}`}
          />
        </Form.Item>
        
        <Form.Item
          label="压缩格式"
          name="format"
        >
          <Select
            value={format}
            onChange={setFormat}
            options={[
              { label: 'ZIP', value: 'zip' }
            ]}
          />
        </Form.Item>
        
        <Form.Item
          label="压缩级别"
          name="compressionLevel"
          help="1-9，数字越大压缩率越高但速度越慢"
        >
          <InputNumber
            min={1}
            max={9}
            value={compressionLevel}
            onChange={(value) => setCompressionLevel(value || 6)}
            className="w-full"
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}