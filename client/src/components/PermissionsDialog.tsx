import React, { useState, useEffect } from 'react'
import { Modal, Form, Input, Checkbox, Switch, Divider, Space, Button, Spin } from 'antd'
import { UserOutlined, TeamOutlined, GlobalOutlined } from '@ant-design/icons'
import { FileItem } from '@/types/file'
import { fileApiClient } from '@/utils/fileApi'
import { useNotificationStore } from '@/stores/notificationStore'

interface PermissionsDialogProps {
  visible: boolean
  file: FileItem | null
  onClose: () => void
  onSuccess?: () => void
}

interface FilePermissions {
  owner: string
  group: string
  permissions: {
    owner: { read: boolean; write: boolean; execute: boolean }
    group: { read: boolean; write: boolean; execute: boolean }
    others: { read: boolean; write: boolean; execute: boolean }
  }
  octal: string
}

export const PermissionsDialog: React.FC<PermissionsDialogProps> = ({
  visible,
  file,
  onClose,
  onSuccess
}) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [permissions, setPermissions] = useState<FilePermissions | null>(null)
  const [recursive, setRecursive] = useState(false)
  const { addNotification } = useNotificationStore()

  // 加载权限信息
  const loadPermissions = async () => {
    if (!file) return

    setLoading(true)
    try {
      const perms = await fileApiClient.getFilePermissions(file.path)
      setPermissions(perms)
      
      // 检查权限数据结构是否完整
      if (!perms || !perms.permissions) {
        throw new Error('权限数据格式不正确')
      }

      const { owner, group, others } = perms.permissions
      
      // 设置表单值，使用默认值防止undefined
      form.setFieldsValue({
        owner: perms.owner || '',
        group: perms.group || '',
        ownerRead: owner?.read || false,
        ownerWrite: owner?.write || false,
        ownerExecute: owner?.execute || false,
        groupRead: group?.read || false,
        groupWrite: group?.write || false,
        groupExecute: group?.execute || false,
        othersRead: others?.read || false,
        othersWrite: others?.write || false,
        othersExecute: others?.execute || false,
      })
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: '获取权限失败',
        message: error.message || '未知错误'
      })
      console.error('获取权限信息失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 计算八进制权限值
  const calculateOctal = (values: any) => {
    const ownerValue = 
      (values.ownerRead ? 4 : 0) + 
      (values.ownerWrite ? 2 : 0) + 
      (values.ownerExecute ? 1 : 0)
    
    const groupValue = 
      (values.groupRead ? 4 : 0) + 
      (values.groupWrite ? 2 : 0) + 
      (values.groupExecute ? 1 : 0)
    
    const othersValue = 
      (values.othersRead ? 4 : 0) + 
      (values.othersWrite ? 2 : 0) + 
      (values.othersExecute ? 1 : 0)
    
    return `${ownerValue}${groupValue}${othersValue}`
  }

  // 保存权限
  const handleSave = async () => {
    if (!file) return

    try {
      const values = await form.validateFields()
      setSaving(true)

      // 构建权限对象
      const newPermissions = {
        owner: {
          read: values.ownerRead,
          write: values.ownerWrite,
          execute: values.ownerExecute
        },
        group: {
          read: values.groupRead,
          write: values.groupWrite,
          execute: values.groupExecute
        },
        others: {
          read: values.othersRead,
          write: values.othersWrite,
          execute: values.othersExecute
        }
      }

      // 修改权限
      await fileApiClient.setFilePermissions(file.path, newPermissions, recursive)

      // 如果所有者或组发生变化，也要修改所有权
      if (values.owner !== permissions?.owner || values.group !== permissions?.group) {
        await fileApiClient.setFileOwnership(
          file.path,
          values.owner !== permissions?.owner ? values.owner : undefined,
          values.group !== permissions?.group ? values.group : undefined,
          recursive
        )
      }

      addNotification({
        type: 'success',
        title: '权限修改成功',
        message: `已成功修改 ${file.name} 的权限设置`
      })
      onSuccess?.()
      onClose()
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: '权限修改失败',
        message: error.message || '未知错误'
      })
      console.error('权限修改失败:', error)
    } finally {
      setSaving(false)
    }
  }

  // 监听表单值变化以实时计算八进制值
  const [currentOctal, setCurrentOctal] = useState('000')

  const handleFormChange = () => {
    const values = form.getFieldsValue()
    const octal = calculateOctal(values)
    setCurrentOctal(octal)
  }

  useEffect(() => {
    if (visible && file) {
      loadPermissions()
      setRecursive(false)
    }
  }, [visible, file])

  useEffect(() => {
    if (permissions) {
      const octal = calculateOctal(form.getFieldsValue())
      setCurrentOctal(octal)
    }
  }, [permissions])

  return (
    <Modal
      title={`权限管理 - ${file?.name || ''}`}
      open={visible}
      onCancel={onClose}
      width={600}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button 
          key="save" 
          type="primary" 
          loading={saving}
          onClick={handleSave}
        >
          保存
        </Button>
      ]}
      className="permissions-dialog"
    >
      <Spin spinning={loading}>
        {permissions && (
          <Form
            form={form}
            layout="vertical"
            onValuesChange={handleFormChange}
          >
            {/* 所有者和组信息 */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                所有权信息
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <Form.Item
                  label="所有者"
                  name="owner"
                  rules={[{ required: true, message: '请输入所有者' }]}
                >
                  <Input prefix={<UserOutlined />} placeholder="用户名" />
                </Form.Item>
                <Form.Item
                  label="组"
                  name="group"
                  rules={[{ required: true, message: '请输入组名' }]}
                >
                  <Input prefix={<TeamOutlined />} placeholder="组名" />
                </Form.Item>
              </div>
            </div>

            <Divider />

            {/* 权限设置 */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  权限设置
                </h4>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  八进制: <span className="font-mono font-bold">{currentOctal}</span>
                </div>
              </div>

              {/* 权限表格 */}
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                <div className="bg-gray-50 dark:bg-gray-700 px-4 py-2 grid grid-cols-4 gap-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <div></div>
                  <div className="text-center">读取</div>
                  <div className="text-center">写入</div>
                  <div className="text-center">执行</div>
                </div>

                {/* 所有者权限 */}
                <div className="px-4 py-3 grid grid-cols-4 gap-4 items-center border-b border-gray-200 dark:border-gray-600">
                  <div className="flex items-center">
                    <UserOutlined className="mr-2 text-blue-500" />
                    <span className="text-sm">所有者</span>
                  </div>
                  <div className="text-center">
                    <Form.Item name="ownerRead" valuePropName="checked" className="mb-0">
                      <Checkbox />
                    </Form.Item>
                  </div>
                  <div className="text-center">
                    <Form.Item name="ownerWrite" valuePropName="checked" className="mb-0">
                      <Checkbox />
                    </Form.Item>
                  </div>
                  <div className="text-center">
                    <Form.Item name="ownerExecute" valuePropName="checked" className="mb-0">
                      <Checkbox />
                    </Form.Item>
                  </div>
                </div>

                {/* 组权限 */}
                <div className="px-4 py-3 grid grid-cols-4 gap-4 items-center border-b border-gray-200 dark:border-gray-600">
                  <div className="flex items-center">
                    <TeamOutlined className="mr-2 text-green-500" />
                    <span className="text-sm">组</span>
                  </div>
                  <div className="text-center">
                    <Form.Item name="groupRead" valuePropName="checked" className="mb-0">
                      <Checkbox />
                    </Form.Item>
                  </div>
                  <div className="text-center">
                    <Form.Item name="groupWrite" valuePropName="checked" className="mb-0">
                      <Checkbox />
                    </Form.Item>
                  </div>
                  <div className="text-center">
                    <Form.Item name="groupExecute" valuePropName="checked" className="mb-0">
                      <Checkbox />
                    </Form.Item>
                  </div>
                </div>

                {/* 其他用户权限 */}
                <div className="px-4 py-3 grid grid-cols-4 gap-4 items-center">
                  <div className="flex items-center">
                    <GlobalOutlined className="mr-2 text-orange-500" />
                    <span className="text-sm">其他用户</span>
                  </div>
                  <div className="text-center">
                    <Form.Item name="othersRead" valuePropName="checked" className="mb-0">
                      <Checkbox />
                    </Form.Item>
                  </div>
                  <div className="text-center">
                    <Form.Item name="othersWrite" valuePropName="checked" className="mb-0">
                      <Checkbox />
                    </Form.Item>
                  </div>
                  <div className="text-center">
                    <Form.Item name="othersExecute" valuePropName="checked" className="mb-0">
                      <Checkbox />
                    </Form.Item>
                  </div>
                </div>
              </div>
            </div>

            {/* 递归选项（仅目录） */}
            {file?.type === 'directory' && (
              <div className="mt-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      递归应用
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      将权限设置应用到所有子文件和子目录
                    </div>
                  </div>
                  <Switch
                    checked={recursive}
                    onChange={setRecursive}
                  />
                </div>
              </div>
            )}
          </Form>
        )}
      </Spin>

      <style>{`
        .permissions-dialog .ant-modal-body {
          padding: 24px;
        }
        
        .permissions-dialog .ant-form-item {
          margin-bottom: 16px;
        }
        
        .permissions-dialog .ant-checkbox-wrapper {
          margin: 0;
        }
      `}</style>
    </Modal>
  )
}