import React, { useRef, useEffect } from 'react'
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX,
  Music,
  Plus,
  X,
  List,
  Shuffle,
  Repeat
} from 'lucide-react'
import { Button, Slider, Modal, Empty, message } from 'antd'
import { useMusicStore } from '@/stores/musicStore'
import { useNavigate } from 'react-router-dom'

interface MusicPlayerProps {
  className?: string
}

const MusicPlayer: React.FC<MusicPlayerProps> = ({ className = '' }) => {
  const {
    playlist,
    currentTrack,
    currentIndex,
    isPlaying,
    volume,
    isMuted,
    currentTime,
    duration,
    isShuffled,
    repeatMode,
    setIsPlaying,
    setVolume,
    setIsMuted,
    setCurrentTime,
    setDuration,
    setIsShuffled,
    setRepeatMode,
    removeFromPlaylist,
    clearPlaylist,
    playTrack,
    nextTrack,
    previousTrack
  } = useMusicStore()
  
  const [showPlaylist, setShowPlaylist] = React.useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const navigate = useNavigate()
  
  // 支持的音频格式
  const supportedFormats = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac']
  
  // 检查是否为音频文件
  const isAudioFile = (fileName: string): boolean => {
    return supportedFormats.some(format => 
      fileName.toLowerCase().endsWith(format)
    )
  }
  
  // 格式化时间
  const formatTime = (time: number): string => {
    if (isNaN(time)) return '0:00'
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }
  
  // 音频事件处理
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
    }
    
    const handleDurationChange = () => {
      setDuration(audio.duration)
    }
    
    const handleEnded = () => {
      nextTrack()
    }
    
    const handleLoadedMetadata = () => {
      setDuration(audio.duration)
    }
    
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('durationchange', handleDurationChange)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('durationchange', handleDurationChange)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
    }
  }, [currentTrack])
  
  // 监听音量变化
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume
    }
  }, [volume, isMuted])
  
  // 监听当前曲目变化，自动加载新音频
  useEffect(() => {
    if (currentTrack && audioRef.current) {
      loadAudioFile(currentTrack)
    }
  }, [currentTrack])
  
  // 组件初始化时，如果有持久化的currentTrack，确保音频已加载
  useEffect(() => {
    if (currentTrack && audioRef.current && !audioRef.current.src) {
      loadAudioFile(currentTrack)
    }
  }, [])
  
  // 加载音频文件
  const loadAudioFile = async (track: any) => {
    if (!audioRef.current) return
    
    try {
      console.log('开始加载音频文件:', track.path)
      
      // 清理之前的blob URL
      if (audioRef.current.src && audioRef.current.src.startsWith('blob:')) {
        URL.revokeObjectURL(audioRef.current.src)
      }
      
      const token = localStorage.getItem('gsm3_token')
      const response = await fetch(`/api/files/read?path=${encodeURIComponent(track.path)}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : ''
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const blob = await response.blob()
      console.log('音频文件blob大小:', blob.size, '类型:', blob.type)
      
      if (blob.size === 0) {
        throw new Error('音频文件为空')
      }
      
      // 根据文件扩展名强制设置正确的MIME类型
      const extension = track.path.split('.').pop()?.toLowerCase()
      let mimeType = 'audio/mpeg' // 默认
      
      switch (extension) {
        case 'mp3':
          mimeType = 'audio/mpeg'
          break
        case 'wav':
          mimeType = 'audio/wav'
          break
        case 'ogg':
          mimeType = 'audio/ogg'
          break
        case 'm4a':
          mimeType = 'audio/mp4'
          break
        case 'aac':
          mimeType = 'audio/aac'
          break
        case 'wma':
          mimeType = 'audio/x-ms-wma'
          break
        case 'flac':
          mimeType = 'audio/flac'
          break
      }
      
      console.log('设置MIME类型:', mimeType)
      
      // 创建具有正确MIME类型的新blob
      const audioBlob = new Blob([blob], { type: mimeType })
      const blobUrl = URL.createObjectURL(audioBlob)

      if (audioRef.current) {
        audioRef.current.src = blobUrl
        audioRef.current.load() // 强制重新加载
        console.log('音频文件加载完成:', blobUrl)
      }
    } catch (error) {
      console.error('音频加载失败:', error)
      message.error(`音频加载失败: ${error instanceof Error ? error.message : '未知错误'}`)
      throw error
    }
  }
  
  // 播放/暂停
  const togglePlay = async () => {
    if (!currentTrack || !audioRef.current) return
    
    try {
      if (isPlaying) {
        audioRef.current.pause()
        setIsPlaying(false)
      } else {
        // 如果音频还没有加载，先加载
        if (!audioRef.current.src || audioRef.current.src === '') {
          await loadAudioFile(currentTrack)
        }
        
        // 直接尝试播放，让浏览器处理加载过程
        await audioRef.current.play()
        setIsPlaying(true)
        console.log('音频播放成功')
      }
    } catch (error) {
      console.error('播放失败:', error)
      setIsPlaying(false)
      // 如果播放失败，尝试重新加载音频文件
      if (error.name === 'NotSupportedError' || error.name === 'NotAllowedError') {
        try {
          console.log('尝试重新加载音频文件...')
          await loadAudioFile(currentTrack)
          await audioRef.current.play()
          setIsPlaying(true)
          console.log('重新加载后播放成功')
        } catch (retryError) {
          console.error('重新加载后仍然播放失败:', retryError)
          message.error('音频播放失败，请检查文件格式是否支持')
        }
      }
    }
  }
  
  // 上一首
  const handlePrevious = () => {
    previousTrack()
  }
  
  // 下一首
  const handleNext = () => {
    if (repeatMode === 'one') {
      // 单曲循环
      if (audioRef.current) {
        audioRef.current.currentTime = 0
        audioRef.current.play()
      }
      return
    }
    
    nextTrack()
  }
  
  // 进度条拖拽
  const handleSeek = (value: number) => {
    if (audioRef.current && duration) {
      const newTime = (value / 100) * duration
      audioRef.current.currentTime = newTime
      setCurrentTime(newTime)
    }
  }
  
  // 音量调节
  const handleVolumeChange = (value: number) => {
    setVolume(value / 100)
    setIsMuted(false)
  }
  
  // 静音切换
  const toggleMute = () => {
    setIsMuted(!isMuted)
  }
  
  // 从播放列表移除
  const handleRemoveFromPlaylist = (index: number) => {
    removeFromPlaylist(index)
  }
  
  // 播放指定曲目
  const handlePlayTrack = (index: number) => {
    playTrack(index)
  }
  
  // 清空播放列表
  const handleClearPlaylist = () => {
    clearPlaylist()
  }
  
  // 打开文件管理器选择音乐
  const openFileManager = () => {
    navigate('/files')
    message.info('请在文件管理器中选择音频文件，然后使用右键菜单添加到播放列表')
  }
  
  // 切换随机播放
  const toggleShuffle = () => {
    setIsShuffled(!isShuffled)
  }
  
  // 切换循环模式
  const toggleRepeat = () => {
    const modes: Array<'none' | 'one' | 'all'> = ['none', 'one', 'all']
    const currentModeIndex = modes.indexOf(repeatMode)
    const nextMode = modes[(currentModeIndex + 1) % modes.length]
    setRepeatMode(nextMode)
  }
  
  // 获取循环模式图标
  const getRepeatIcon = () => {
    switch (repeatMode) {
      case 'one':
        return <Repeat className="w-4 h-4" />
      case 'all':
        return <Repeat className="w-4 h-4" />
      default:
        return <Repeat className="w-4 h-4 opacity-50" />
    }
  }
  
  return (
    <div className={`card-game p-6 ${className}`}>
      {/* 音频元素 */}
      {currentTrack && (
        <audio
          ref={audioRef}
          onLoadStart={() => setIsPlaying(true)}
        />
      )}
      
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <Music className="w-6 h-6 text-purple-500" />
          <h3 className="text-lg font-semibold text-black dark:text-white">音乐播放器</h3>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            ({playlist.length} 首歌曲)
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            type="text"
            size="small"
            icon={<Plus className="w-4 h-4" />}
            onClick={openFileManager}
            className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
          >
            添加音乐
          </Button>
          
          <Button
            type="text"
            size="small"
            icon={<List className="w-4 h-4" />}
            onClick={() => setShowPlaylist(true)}
            className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
          >
            播放列表
          </Button>
        </div>
      </div>
      
      {/* 当前播放信息 */}
      {currentTrack ? (
        <div className="space-y-4">
          {/* 歌曲信息 */}
          <div className="text-center">
            <div className="text-lg font-medium text-black dark:text-white truncate">
              {currentTrack.name.replace(/\.[^/.]+$/, '')}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>
          
          {/* 进度条 */}
          <div className="px-2">
            <Slider
              value={duration ? (currentTime / duration) * 100 : 0}
              onChange={handleSeek}
              tooltip={{ formatter: null }}
              className="music-progress-slider"
            />
          </div>
          
          {/* 控制按钮 */}
          <div className="flex items-center justify-center space-x-4">
            {/* 随机播放 */}
            <Button
              type="text"
              size="small"
              icon={<Shuffle className={`w-4 h-4 ${isShuffled ? 'text-blue-500' : 'opacity-50'}`} />}
              onClick={toggleShuffle}
              className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
            />
            
            {/* 上一首 */}
            <Button
              type="text"
              size="large"
              icon={<SkipBack className="w-5 h-5" />}
              onClick={handlePrevious}
              disabled={playlist.length <= 1}
              className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
            />
            
            {/* 播放/暂停 */}
            <Button
              type="primary"
              size="large"
              shape="circle"
              icon={isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
              onClick={togglePlay}
              className="bg-blue-500 hover:bg-blue-600 border-blue-500 hover:border-blue-600"
            />
            
            {/* 下一首 */}
            <Button
              type="text"
              size="large"
              icon={<SkipForward className="w-5 h-5" />}
              onClick={handleNext}
              disabled={playlist.length <= 1}
              className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
            />
            
            {/* 循环模式 */}
            <Button
              type="text"
              size="small"
              icon={getRepeatIcon()}
              onClick={toggleRepeat}
              className={`text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 ${
                repeatMode !== 'none' ? 'text-blue-500' : ''
              }`}
            />
          </div>
          
          {/* 音量控制 */}
          <div className="flex items-center space-x-3">
            <Button
              type="text"
              size="small"
              icon={isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              onClick={toggleMute}
              className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
            />
            
            <div className="flex-1">
              <Slider
                value={isMuted ? 0 : volume * 100}
                onChange={handleVolumeChange}
                tooltip={{ formatter: (value) => `${value}%` }}
                className="music-volume-slider"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <Music className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            暂无播放内容
          </p>
          <Button
            type="primary"
            icon={<Plus className="w-4 h-4" />}
            onClick={openFileManager}
            className="bg-blue-500 hover:bg-blue-600 border-blue-500 hover:border-blue-600"
          >
            添加音乐文件
          </Button>
        </div>
      )}
      
      {/* 播放列表模态框 */}
      <Modal
        title="播放列表"
        open={showPlaylist}
        onCancel={() => setShowPlaylist(false)}
        footer={[
          <Button key="clear" danger onClick={handleClearPlaylist} disabled={playlist.length === 0}>
            清空列表
          </Button>,
          <Button key="close" onClick={() => setShowPlaylist(false)}>
            关闭
          </Button>
        ]}
        width={600}
      >
        {playlist.length > 0 ? (
          <div className="max-h-96 overflow-y-auto">
            {playlist.map((track, index) => (
              <div
                key={`${track.path}-${index}`}
                className={`flex items-center justify-between p-3 rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer ${
                  index === currentIndex ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500' : ''
                }`}
                onClick={() => handlePlayTrack(index)}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-black dark:text-white truncate">
                    {track.name.replace(/\.[^/.]+$/, '')}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {track.path}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 ml-4">
                  {index === currentIndex && isPlaying && (
                    <div className="text-blue-500">
                      <Play className="w-4 h-4" />
                    </div>
                  )}
                  
                  <Button
                    type="text"
                    size="small"
                    icon={<X className="w-4 h-4" />}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveFromPlaylist(index)
                    }}
                    className="text-gray-400 hover:text-red-500"
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            description="播放列表为空"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button
              type="primary"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setShowPlaylist(false)
                openFileManager()
              }}
            >
              添加音乐文件
            </Button>
          </Empty>
        )}
      </Modal>
    </div>
  )
}

export default MusicPlayer