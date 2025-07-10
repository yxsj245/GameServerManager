import React from 'react'
import { Modal, Button } from 'antd'
import { Download, X, ZoomIn, ZoomOut, RotateCw } from 'lucide-react'
import { fileApiClient } from '@/utils/fileApi'

interface ImagePreviewProps {
  isOpen: boolean
  onClose: () => void
  imagePath: string
  fileName: string
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({
  isOpen,
  onClose,
  imagePath,
  fileName
}) => {
  const [zoom, setZoom] = React.useState(1)
  const [rotation, setRotation] = React.useState(0)
  const [imageLoaded, setImageLoaded] = React.useState(false)
  const [imageError, setImageError] = React.useState(false)
  const [imageUrl, setImageUrl] = React.useState('')
  const [position, setPosition] = React.useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = React.useState(false)
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 })
  const [lastPosition, setLastPosition] = React.useState({ x: 0, y: 0 })

  // 加载图片数据
  React.useEffect(() => {
    if (!imagePath || !isOpen) {
      setImageUrl('')
      return
    }

    const loadImage = async () => {
      try {
        const token = localStorage.getItem('gsm3_token')
        const url = fileApiClient.getImagePreviewUrl(imagePath)
        
        const response = await fetch(url, {
          headers: {
            'Authorization': token ? `Bearer ${token}` : ''
          }
        })
        
        if (!response.ok) {
          throw new Error(`Failed to load image: ${response.status} ${response.statusText}`)
        }
        
        const blob = await response.blob()
        
        if (blob.size === 0) {
          throw new Error('Empty response received')
        }
        
        const objectUrl = URL.createObjectURL(blob)
        setImageUrl(objectUrl)
        setImageError(false)
      } catch (error) {
        console.error('Error loading image:', error)
        setImageError(true)
      }
    }

    loadImage()
    
    // 清理函数
    return () => {
      if (imageUrl && imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imageUrl)
      }
    }
  }, [imagePath, isOpen])

  const handleDownload = () => {
    fileApiClient.downloadFile(imagePath)
  }

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 5))
  }

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.2, 0.1))
  }

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360)
  }

  const resetTransform = () => {
    setZoom(1)
    setRotation(0)
    setPosition({ x: 0, y: 0 })
  }

  // 鼠标按下开始拖拽
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
    setLastPosition(position)
  }

  // 鼠标移动拖拽
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    e.preventDefault()
    
    const deltaX = e.clientX - dragStart.x
    const deltaY = e.clientY - dragStart.y
    
    setPosition({
      x: lastPosition.x + deltaX,
      y: lastPosition.y + deltaY
    })
  }

  // 鼠标抬起结束拖拽
  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // 滚轮缩放
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom(prev => Math.min(Math.max(prev * delta, 0.1), 5))
  }

  // 全局鼠标事件监听
  React.useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      
      const deltaX = e.clientX - dragStart.x
      const deltaY = e.clientY - dragStart.y
      
      setPosition({
        x: lastPosition.x + deltaX,
        y: lastPosition.y + deltaY
      })
    }

    const handleGlobalMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove)
      document.addEventListener('mouseup', handleGlobalMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove)
      document.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [isDragging, dragStart, lastPosition])

  // 重置状态当对话框关闭时
  React.useEffect(() => {
    if (!isOpen) {
      setZoom(1)
      setRotation(0)
      setPosition({ x: 0, y: 0 })
      setIsDragging(false)
      setImageLoaded(false)
      setImageError(false)
      // 清理blob URL
      if (imageUrl && imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imageUrl)
      }
      setImageUrl('')
    }
  }, [isOpen, imageUrl])

  return (
    <Modal
      title={
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold truncate">{fileName}</span>
          <div className="flex items-center gap-2">
            <Button
              size="small"
              onClick={handleZoomOut}
              disabled={zoom <= 0.1}
              icon={<ZoomOut className="h-4 w-4" />}
            />
            <span className="text-sm text-gray-500 min-w-[60px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              size="small"
              onClick={handleZoomIn}
              disabled={zoom >= 5}
              icon={<ZoomIn className="h-4 w-4" />}
            />
            <Button
              size="small"
              onClick={handleRotate}
              icon={<RotateCw className="h-4 w-4" />}
            />
            <Button
              size="small"
              onClick={resetTransform}
            >
              重置
            </Button>
            <Button
              size="small"
              onClick={handleDownload}
              icon={<Download className="h-4 w-4" />}
            />
          </div>
        </div>
      }
      open={isOpen}
      onCancel={onClose}
      footer={null}
      width="90%"
      style={{ top: 20 }}
      styles={{ body: { height: '80vh', padding: 0, backgroundColor: '#f5f5f5' } }}
      closeIcon={<X className="h-4 w-4" />}
    >
      <div className="h-full flex items-center justify-center p-4">
        {imageError ? (
          <div className="text-center text-gray-500">
            <div className="text-lg mb-2">无法加载图片</div>
            <div className="text-sm">图片格式不支持或文件已损坏</div>
          </div>
        ) : (
          <div 
            className="relative overflow-hidden max-w-full max-h-full cursor-grab"
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            onWheel={handleWheel}
          >
            <img
              src={imageUrl}
              alt={fileName}
              className="max-w-none transition-transform duration-200 ease-in-out select-none"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                transformOrigin: 'center'
              }}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              draggable={false}
            />
            {!imageLoaded && !imageError && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                <div className="text-gray-500">加载中...</div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

export default ImagePreview