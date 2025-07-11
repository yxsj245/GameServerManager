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
  Shuffle
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
    setIsPlaying,
    setVolume,
    setIsMuted,
    setCurrentTime,
    setDuration,
    setIsShuffled,
    removeFromPlaylist,
    clearPlaylist,
    playTrack,
    nextTrack,
    previousTrack,
    seekTo
  } = useMusicStore()
  
  const [showPlaylist, setShowPlaylist] = React.useState(false)
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
  
  // 注意：音频播放逻辑现在由全局播放器(GlobalMusicPlayer)处理
  // 这个组件只负责显示完整的播放器界面
  
  // 播放/暂停 - 直接切换状态，实际播放由全局播放器处理
  const togglePlay = () => {
    setIsPlaying(!isPlaying)
  }
  
  // 上一首
  const handlePrevious = () => {
    previousTrack()
  }
  
  // 下一首
  const handleNext = () => {
    nextTrack()
  }
  
  // 进度条拖拽 - 通过store通知全局播放器进行seek操作
  const handleSeek = (value: number) => {
    if (duration) {
      const newTime = (value / 100) * duration
      seekTo(newTime)
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
  

  
  return (
    <div className={`card-game p-6 ${className}`}>
      
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