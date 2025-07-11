import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { FileItem } from '@/types/file'

interface MusicFile extends FileItem {
  duration?: number
  currentTime?: number
}

interface MusicState {
  playlist: MusicFile[]
  currentTrack: MusicFile | null
  currentIndex: number
  isPlaying: boolean
  volume: number
  isMuted: boolean
  currentTime: number
  duration: number
  isShuffled: boolean
  repeatMode: 'none' | 'one' | 'all'
  seekTime: number | null // 用于通知GlobalMusicPlayer进行seek操作
  
  // Actions
  addToPlaylist: (files: MusicFile[]) => void
  removeFromPlaylist: (index: number) => void
  clearPlaylist: () => void
  setCurrentTrack: (track: MusicFile | null) => void
  setCurrentIndex: (index: number) => void
  setIsPlaying: (playing: boolean) => void
  setVolume: (volume: number) => void
  setIsMuted: (muted: boolean) => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  setIsShuffled: (shuffled: boolean) => void
  setRepeatMode: (mode: 'none' | 'one' | 'all') => void
  seekTo: (time: number) => void
  clearSeek: () => void
  playTrack: (index: number) => void
  nextTrack: () => void
  previousTrack: () => void
}

export const useMusicStore = create<MusicState>()(persist((set, get) => ({
  playlist: [],
  currentTrack: null,
  currentIndex: 0,
  isPlaying: false,
  volume: 0.7,
  isMuted: false,
  currentTime: 0,
  duration: 0,
  isShuffled: false,
  repeatMode: 'none',
  seekTime: null,
  
  addToPlaylist: (files: MusicFile[]) => {
    const { playlist } = get()
    const supportedFormats = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac']
    
    const audioFiles = files.filter(file => 
      file.type === 'file' && 
      supportedFormats.some(format => file.name.toLowerCase().endsWith(format))
    )
    
    if (audioFiles.length === 0) return
    
    const newPlaylist = [...playlist]
    audioFiles.forEach(file => {
      if (!newPlaylist.find(item => item.path === file.path)) {
        newPlaylist.push(file)
      }
    })
    
    set({ playlist: newPlaylist })
  },
  
  removeFromPlaylist: (index: number) => {
    const { playlist, currentIndex, currentTrack } = get()
    const newPlaylist = playlist.filter((_, i) => i !== index)
    
    let newCurrentIndex = currentIndex
    let newCurrentTrack = currentTrack
    
    if (index === currentIndex) {
      if (newPlaylist.length > 0) {
        newCurrentIndex = Math.min(currentIndex, newPlaylist.length - 1)
        newCurrentTrack = newPlaylist[newCurrentIndex]
      } else {
        newCurrentTrack = null
        newCurrentIndex = 0
      }
    } else if (index < currentIndex) {
      newCurrentIndex = currentIndex - 1
    }
    
    set({ 
      playlist: newPlaylist, 
      currentIndex: newCurrentIndex, 
      currentTrack: newCurrentTrack,
      isPlaying: newPlaylist.length === 0 ? false : get().isPlaying
    })
  },
  
  clearPlaylist: () => {
    set({ 
      playlist: [], 
      currentTrack: null, 
      currentIndex: 0, 
      isPlaying: false 
    })
  },
  
  setCurrentTrack: (track: MusicFile | null) => {
    set({ currentTrack: track })
  },
  
  setCurrentIndex: (index: number) => {
    set({ currentIndex: index })
  },
  
  setIsPlaying: (playing: boolean) => {
    set({ isPlaying: playing })
  },
  
  setVolume: (volume: number) => {
    set({ volume })
  },
  
  setIsMuted: (muted: boolean) => {
    set({ isMuted: muted })
  },
  
  setCurrentTime: (time: number) => {
    set({ currentTime: time })
  },
  
  setDuration: (duration: number) => {
    set({ duration })
  },
  
  setIsShuffled: (shuffled: boolean) => {
    set({ isShuffled: shuffled })
  },
  
  setRepeatMode: (mode: 'none' | 'one' | 'all') => {
    set({ repeatMode: mode })
  },
  
  seekTo: (time: number) => {
    set({ seekTime: time, currentTime: time })
  },
  
  clearSeek: () => {
    set({ seekTime: null })
  },
  
  playTrack: (index: number) => {
    const { playlist, isPlaying } = get()
    if (index >= 0 && index < playlist.length) {
      set({ 
        currentIndex: index, 
        currentTrack: playlist[index],
        isPlaying: true // 切换歌曲后自动播放
      })
    }
  },
  
  nextTrack: () => {
    const { playlist, currentIndex, isShuffled, repeatMode } = get()
    
    if (playlist.length === 0) return
    
    let newIndex
    if (isShuffled) {
      // 随机播放：确保不会选择当前正在播放的歌曲（除非只有一首歌）
      if (playlist.length === 1) {
        newIndex = 0
      } else {
        do {
          newIndex = Math.floor(Math.random() * playlist.length)
        } while (newIndex === currentIndex)
      }
    } else {
      newIndex = currentIndex < playlist.length - 1 ? currentIndex + 1 : 0
    }
    
    // 如果是无循环模式且到了最后一首
    if (repeatMode === 'none' && currentIndex === playlist.length - 1 && !isShuffled) {
      set({ isPlaying: false })
      return
    }
    
    set({ 
      currentIndex: newIndex, 
      currentTrack: playlist[newIndex],
      isPlaying: true // 切换歌曲后自动播放
    })
  },
  
  previousTrack: () => {
    const { playlist, currentIndex, isShuffled } = get()
    
    if (playlist.length === 0) return
    
    let newIndex
    if (isShuffled) {
      // 随机播放：确保不会选择当前正在播放的歌曲（除非只有一首歌）
      if (playlist.length === 1) {
        newIndex = 0
      } else {
        do {
          newIndex = Math.floor(Math.random() * playlist.length)
        } while (newIndex === currentIndex)
      }
    } else {
      newIndex = currentIndex > 0 ? currentIndex - 1 : playlist.length - 1
    }
    
    set({ 
      currentIndex: newIndex, 
      currentTrack: playlist[newIndex],
      isPlaying: true // 切换歌曲后自动播放
    })
  }
}), {
  name: 'gsm3-music-store',
  storage: createJSONStorage(() => localStorage),
  partialize: (state) => ({
    playlist: state.playlist,
    currentTrack: state.currentTrack,
    currentIndex: state.currentIndex,
    volume: state.volume,
    isMuted: state.isMuted,
    isShuffled: state.isShuffled,
    repeatMode: state.repeatMode,
    // 不持久化播放状态和时间相关的数据
    // isPlaying: false,
    // currentTime: 0,
    // duration: 0,
  })
}))