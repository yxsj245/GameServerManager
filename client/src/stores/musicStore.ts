import { create } from 'zustand'
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
  playTrack: (index: number) => void
  nextTrack: () => void
  previousTrack: () => void
}

export const useMusicStore = create<MusicState>((set, get) => ({
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
  
  playTrack: (index: number) => {
    const { playlist } = get()
    if (index >= 0 && index < playlist.length) {
      set({ 
        currentIndex: index, 
        currentTrack: playlist[index],
        isPlaying: false // 让组件重新开始播放
      })
    }
  },
  
  nextTrack: () => {
    const { playlist, currentIndex, isShuffled, repeatMode } = get()
    
    if (playlist.length === 0) return
    
    if (repeatMode === 'one') {
      // 单曲循环，重新播放当前歌曲
      return
    }
    
    let newIndex
    if (isShuffled) {
      newIndex = Math.floor(Math.random() * playlist.length)
    } else {
      newIndex = currentIndex < playlist.length - 1 ? currentIndex + 1 : 0
    }
    
    // 如果是列表循环模式且到了最后一首
    if (repeatMode === 'none' && currentIndex === playlist.length - 1 && !isShuffled) {
      set({ isPlaying: false })
      return
    }
    
    set({ 
      currentIndex: newIndex, 
      currentTrack: playlist[newIndex],
      isPlaying: false // 让组件重新开始播放
    })
  },
  
  previousTrack: () => {
    const { playlist, currentIndex, isShuffled } = get()
    
    if (playlist.length === 0) return
    
    let newIndex
    if (isShuffled) {
      newIndex = Math.floor(Math.random() * playlist.length)
    } else {
      newIndex = currentIndex > 0 ? currentIndex - 1 : playlist.length - 1
    }
    
    set({ 
      currentIndex: newIndex, 
      currentTrack: playlist[newIndex],
      isPlaying: false // 让组件重新开始播放
    })
  }
}))