import React, { useState, useEffect } from 'react'
import { Tooltip, Button } from 'antd'
import { QuestionCircleOutlined } from '@ant-design/icons'
import { useTouchAdaptation } from '@/hooks/useTouchAdaptation'

export const TouchHelpTooltip: React.FC = () => {
  const touchAdaptation = useTouchAdaptation()
  const [showHelp, setShowHelp] = useState(false)

  // 只在触摸设备上显示
  if (!touchAdaptation.isTouchDevice) {
    return null
  }

  const helpContent = (
    <div className="max-w-xs">
      <div className="font-medium mb-2">触摸操作提示：</div>
      <ul className="text-sm space-y-1">
        <li>• 点击选择文件</li>
        <li>• 双击打开文件/文件夹</li>
        <li>• 长按显示右键菜单</li>
        <li>• 在小屏模式下自动使用列表视图</li>
      </ul>
    </div>
  )

  return (
    <Tooltip 
      title={helpContent} 
      placement="bottomRight"
      open={showHelp}
      onOpenChange={setShowHelp}
    >
      <Button 
        icon={<QuestionCircleOutlined />}
        size="small"
        type="text"
        onClick={() => setShowHelp(!showHelp)}
        className="opacity-60 hover:opacity-100"
      />
    </Tooltip>
  )
}
