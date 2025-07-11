import React, { useRef, useEffect, useState } from 'react'
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Music, X, Maximize2 } from 'lucide-react'
import { Button, Slider, message } from 'antd'
import { useMusicStore } from '@/stores/musicStore'
import { useNavigate } from 'react-router-dom'

const GlobalMusicPlayer: React.FC = () => {
  const {
    playlist,
    currentTrack,
    isPlaying,
    volume,
    isMuted,
    currentTime,
    duration,
    setIsPlaying,
    setVolume,
    setIsMuted,
    setCurrentTime,
    setDuration,
    nextTrack,
    previousTrack,
    seekTime,
    clearSeek
  } = useMusicStore()
  
  const [isMinimized, setIsMinimized] = useState(false)
  const [showVolumeSlider, setShowVolumeSlider] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const navigate = useNavigate()
  
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
  
  // 监听播放状态变化，同步音频播放/暂停
  useEffect(() => {
    if (!audioRef.current || !currentTrack) return
    
    const audio = audioRef.current
    
    if (isPlaying && audio.paused) {
      // 需要播放但音频处于暂停状态
      if (!audio.src || audio.src === '') {
        // 如果没有音频源，先加载
        loadAudioFile(currentTrack).then(() => {
          if (audioRef.current && isPlaying) {
            audioRef.current.play().catch(error => {
              console.error('全局播放器自动播放失败:', error)
              setIsPlaying(false)
            })
          }
        })
      } else {
        // 有音频源，直接播放
        audio.play().catch(error => {
          console.error('全局播放器自动播放失败:', error)
          setIsPlaying(false)
        })
      }
    } else if (!isPlaying && !audio.paused) {
      // 需要暂停但音频正在播放
      audio.pause()
    }
  }, [isPlaying, currentTrack])
   
   // 监听seek操作
   useEffect(() => {
     if (seekTime !== null && audioRef.current && duration) {
       audioRef.current.currentTime = seekTime
       setCurrentTime(seekTime)
       clearSeek()
     }
   }, [seekTime, duration])
   
   // 加载音频文件
  const loadAudioFile = async (track: any) => {
    if (!audioRef.current) return
    
    try {
      console.log('全局播放器加载音频文件:', track.path)
      
      // 清理之前的blob URL
      if (audioRef.current.src && audioRef.current.src.startsWith('blob:')) {
        URL.revokeObjectURL(audioRef.current.src)
      }
      
      const token = localStorage.getItem('gsm3_token')
      const response = await fetch(`/api/files/read?path=${encodeURIComponent(track.path)}`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const blob = await response.blob()
      console.log('全局播放器音频文件blob大小:', blob.size, '类型:', blob.type)
      
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
      
      console.log('全局播放器设置MIME类型:', mimeType)
      
      // 创建具有正确MIME类型的新blob
      const audioBlob = new Blob([blob], { type: mimeType })
      const blobUrl = URL.createObjectURL(audioBlob)

      if (audioRef.current) {
        audioRef.current.src = blobUrl
        audioRef.current.load() // 强制重新加载
        console.log('全局播放器音频文件加载完成:', blobUrl)
        
        // 如果当前状态是播放状态，等待音频加载完成后自动播放
        if (isPlaying) {
          const handleCanPlay = () => {
            if (audioRef.current && isPlaying) {
              audioRef.current.play().catch(error => {
                console.error('全局播放器自动播放失败:', error)
                setIsPlaying(false)
              })
            }
            audioRef.current?.removeEventListener('canplay', handleCanPlay)
          }
          audioRef.current.addEventListener('canplay', handleCanPlay)
        }
      }
    } catch (error) {
      console.error('全局播放器音频加载失败:', error)
      message.error(`音频加载失败: ${error instanceof Error ? error.message : '未知错误'}`)
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
        console.log('全局播放器音频播放成功')
      }
    } catch (error) {
      console.error('全局播放器播放失败:', error)
      setIsPlaying(false)
      // 如果播放失败，尝试重新加载音频文件
      if (error.name === 'NotSupportedError' || error.name === 'NotAllowedError') {
        try {
          console.log('全局播放器尝试重新加载音频文件...')
          await loadAudioFile(currentTrack)
          await audioRef.current.play()
          setIsPlaying(true)
          console.log('全局播放器重新加载后播放成功')
        } catch (retryError) {
          console.error('全局播放器重新加载后仍然播放失败:', retryError)
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
    nextTrack()
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
  
  // 打开完整播放器
  const openFullPlayer = () => {
    navigate('/')
  }
  
  // 进度条拖拽
  const handleSeek = (value: number) => {
    if (audioRef.current && duration) {
      const newTime = (value / 100) * duration
      audioRef.current.currentTime = newTime
      setCurrentTime(newTime)
    }
  }
  
  return (
    <>
      {/* 音频元素 */}
      <audio ref={audioRef} />
      
      {/* 全局迷你播放器 - 只有当有播放列表和当前曲目时才显示 */}
      {currentTrack && playlist.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50">
        <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 transition-all duration-300 ${
          isMinimized ? 'w-16 h-16' : 'w-80 h-auto'
        }`}>
          {isMinimized ? (
            // 最小化状态
            <div className="w-full h-full flex items-center justify-center">
              <Button
                type="text"
                icon={<Music className="w-5 h-5" />}
                onClick={() => setIsMinimized(false)}
                className="w-full h-full rounded-lg"
              />
            </div>
          ) : (
            // 展开状态
            <div className="p-4">
              {/* 标题栏 */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Music className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">正在播放</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Button
                    type="text"
                    size="small"
                    icon={<Maximize2 className="w-3 h-3" />}
                    onClick={openFullPlayer}
                    className="text-gray-500 hover:text-gray-700"
                  />
                  <Button
                    type="text"
                    size="small"
                    icon={<X className="w-3 h-3" />}
                    onClick={() => setIsMinimized(true)}
                    className="text-gray-500 hover:text-gray-700"
                  />
                </div>
              </div>
              
              {/* 歌曲信息 */}
              <div className="mb-3">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {currentTrack.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
              </div>
              
              {/* 进度条 */}
              <div className="mb-3">
                <Slider
                  value={duration ? (currentTime / duration) * 100 : 0}
                  onChange={handleSeek}
                  tooltip={{ formatter: null }}
                  className="mb-0"
                />
              </div>
              
              {/* 控制按钮 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Button
                    type="text"
                    size="small"
                    icon={<SkipBack className="w-4 h-4" />}
                    onClick={handlePrevious}
                    disabled={playlist.length <= 1}
                  />
                  <Button
                    type="primary"
                    size="small"
                    icon={isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    onClick={togglePlay}
                  />
                  <Button
                    type="text"
                    size="small"
                    icon={<SkipForward className="w-4 h-4" />}
                    onClick={handleNext}
                    disabled={playlist.length <= 1}
                  />
                </div>
                
                {/* 音量控制 */}
                <div className="flex items-center space-x-2 relative">
                  <Button
                    type="text"
                    size="small"
                    icon={isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    onClick={toggleMute}
                    onMouseEnter={() => setShowVolumeSlider(true)}
                    onMouseLeave={() => setShowVolumeSlider(false)}
                  />
                  {showVolumeSlider && (
                    <div 
                      className="absolute bottom-full right-0 mb-2 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700"
                      onMouseEnter={() => setShowVolumeSlider(true)}
                      onMouseLeave={() => setShowVolumeSlider(false)}
                    >
                      <div className="w-20">
                        <Slider
                          vertical
                          value={isMuted ? 0 : volume * 100}
                          onChange={handleVolumeChange}
                          tooltip={{ formatter: (value) => `${value}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        </div>
      )}
    </>
  )
}

export default GlobalMusicPlayer