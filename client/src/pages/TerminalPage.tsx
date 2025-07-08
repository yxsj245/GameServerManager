import React, { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import socketClient from '@/utils/socket'
import apiClient from '@/utils/api'
import { useNotificationStore } from '@/stores/notificationStore'
import {
  Plus,
  X,
  Maximize2,
  Minimize2,
  RotateCcw,
  Settings,
  Terminal as TerminalIcon,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Check,
  Folder
} from 'lucide-react'
import '@xterm/xterm/css/xterm.css'

interface TerminalSession {
  id: string
  name: string
  terminal: Terminal
  fitAddon: FitAddon
  active: boolean
}

const TerminalPage: React.FC = () => {
  const [sessions, setSessions] = useState<TerminalSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarHovered, setSidebarHovered] = useState(false)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  
  const terminalContainerRef = useRef<HTMLDivElement>(null)
  const isSessionsLoadedRef = useRef(false)
  const { addNotification } = useNotificationStore()
  
  // 创建新的终端会话
  const createTerminalSession = () => {
    const sessionId = `terminal-${Date.now()}`
    const sessionName = `终端 ${sessions.length + 1}`
    
    const terminal = new Terminal({
      theme: {
        background: '#1a1a1a',
        foreground: '#ffffff',
        cursor: '#ffffff',
        selectionBackground: '#ffffff30',
        black: '#000000',
        red: '#ff6b6b',
        green: '#51cf66',
        yellow: '#ffd43b',
        blue: '#74c0fc',
        magenta: '#f06292',
        cyan: '#4dd0e1',
        white: '#ffffff',
        brightBlack: '#666666',
        brightRed: '#ff8a80',
        brightGreen: '#69f0ae',
        brightYellow: '#ffff8d',
        brightBlue: '#82b1ff',
        brightMagenta: '#ff80ab',
        brightCyan: '#84ffff',
        brightWhite: '#ffffff'
      },
      fontFamily: 'JetBrains Mono, Fira Code, Consolas, Monaco, monospace',
      fontSize: 14,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 1000,
      tabStopWidth: 4,
      allowTransparency: true
    })
    
    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    
    terminal.loadAddon(fitAddon)
    terminal.loadAddon(webLinksAddon)
    
    // 监听终端输入
    terminal.onData((data) => {
      socketClient.sendTerminalInput(sessionId, data)
    })
    
    // 监听终端大小变化
    terminal.onResize(({ cols, rows }) => {
      if (socketClient.isConnected()) {
        socketClient.resizeTerminal(sessionId, cols, rows)
      }
    })
    
    const newSession: TerminalSession = {
      id: sessionId,
      name: sessionName,
      terminal,
      fitAddon,
      active: true
    }
    
    setSessions(prev => {
      const updated = prev.map(s => ({ ...s, active: false }))
      return [...updated, newSession]
    })
    
    setActiveSessionId(sessionId)
    
    // 请求创建PTY
    socketClient.createTerminal({
      sessionId: sessionId,
      name: sessionName,
      cols: 80,
      rows: 24
    })
    
    addNotification({
      type: 'success',
      title: '终端创建成功',
      message: `已创建新的终端会话: ${sessionName}`
    })
  }
  
  // 关闭终端会话
  const closeTerminalSession = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId)
    if (!session) return
    
    // 清理终端
    session.terminal.dispose()
    
    // 通知后端关闭PTY
    socketClient.closeTerminal(sessionId)
    
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== sessionId)
      
      // 如果关闭的是当前活动会话，切换到其他会话
      if (sessionId === activeSessionId) {
        if (filtered.length > 0) {
          const newActive = filtered[filtered.length - 1]
          newActive.active = true
          setActiveSessionId(newActive.id)
        } else {
          setActiveSessionId(null)
        }
      }
      
      return filtered
    })
    
    addNotification({
      type: 'info',
      title: '终端已关闭',
      message: `终端会话 ${session.name} 已关闭`
    })
  }
  
  // 切换终端会话
  const switchTerminalSession = (sessionId: string) => {
    setSessions(prev => prev.map(s => ({
      ...s,
      active: s.id === sessionId
    })))
    setActiveSessionId(sessionId)
  }
  
  // 重命名终端会话
  const startRenaming = (sessionId: string, currentName: string) => {
    setEditingSessionId(sessionId)
    setEditingName(currentName)
  }
  
  const finishRenaming = () => {
    if (editingSessionId && editingName.trim()) {
      setSessions(prev => prev.map(s => 
        s.id === editingSessionId 
          ? { ...s, name: editingName.trim() }
          : s
      ))
    }
    setEditingSessionId(null)
    setEditingName('')
  }
  
  const cancelRenaming = () => {
    setEditingSessionId(null)
    setEditingName('')
  }
  
  // 重置终端
  const resetTerminal = () => {
    const activeSession = sessions.find(s => s.id === activeSessionId)
    if (activeSession) {
      activeSession.terminal.reset()
      addNotification({
        type: 'info',
        title: '终端已重置',
        message: '终端内容已清空'
      })
    }
  }
  
  // 切换全屏模式
  const toggleFullscreen = async () => {
    try {
      if (!isFullscreen) {
        // 进入全屏模式
        await document.documentElement.requestFullscreen()
        setIsFullscreen(true)
        addNotification({
          type: 'info',
          title: '已进入全屏模式',
          message: '按 ESC 键或点击全屏按钮退出全屏'
        })
      } else {
        // 退出全屏模式
        await document.exitFullscreen()
        setIsFullscreen(false)
        addNotification({
          type: 'info',
          title: '已退出全屏模式',
          message: '全屏模式已关闭'
        })
      }
      
      // 延迟调整终端大小
      setTimeout(() => {
        const activeSession = sessions.find(s => s.id === activeSessionId)
        if (activeSession) {
          activeSession.fitAddon.fit()
        }
      }, 200)
    } catch (error) {
      console.error('全屏切换失败:', error)
      addNotification({
        type: 'error',
        title: '全屏切换失败',
        message: '浏览器不支持全屏模式或操作被阻止'
      })
    }
  }
  
  // 页面加载时获取现有终端会话
  useEffect(() => {
    const loadExistingSessions = async () => {
      if (isSessionsLoadedRef.current) return
      isSessionsLoadedRef.current = true
      
      try {
        const response = await apiClient.getTerminalSessions()
        if (response.success && response.data.sessions.length > 0) {
          const sessionData = response.data.sessions
          
          const newSessions: TerminalSession[] = sessionData.map((session: any, index: number) => {
            const terminal = new Terminal({
              theme: {
                background: '#1a1a1a',
                foreground: '#ffffff',
                cursor: '#ffffff',
                selectionBackground: '#ffffff30',
                black: '#000000',
                red: '#ff6b6b',
                green: '#51cf66',
                yellow: '#ffd43b',
                blue: '#74c0fc',
                magenta: '#f06292',
                cyan: '#4dd0e1',
                white: '#ffffff',
                brightBlack: '#666666',
                brightRed: '#ff8a80',
                brightGreen: '#69f0ae',
                brightYellow: '#ffff8d',
                brightBlue: '#82b1ff',
                brightMagenta: '#ff80ab',
                brightCyan: '#84ffff',
                brightWhite: '#ffffff'
              },
              fontFamily: 'JetBrains Mono, Fira Code, Consolas, Monaco, monospace',
              fontSize: 14,
              lineHeight: 1.2,
              cursorBlink: true,
              cursorStyle: 'block',
              scrollback: 1000,
              tabStopWidth: 4,
              allowTransparency: true
            })

            const fitAddon = new FitAddon()
            const webLinksAddon = new WebLinksAddon()
            terminal.loadAddon(fitAddon)
            terminal.loadAddon(webLinksAddon)

            terminal.onData((data) => {
              socketClient.sendTerminalInput(session.id, data)
            })

            terminal.onResize(({ cols, rows }) => {
              if (socketClient.isConnected()) {
                socketClient.resizeTerminal(session.id, cols, rows)
              }
            })

            return {
              id: session.id,
              name: session.name || `终端 ${index + 1}`,
              terminal,
              fitAddon,
              active: index === 0
            }
          })
          
          setSessions(newSessions)
          if (newSessions.length > 0) {
            setActiveSessionId(newSessions[0].id)
          }
          
          addNotification({
            type: 'info',
            title: '发现现有会话',
            message: `找到 ${sessionData.length} 个现有终端会话，正在恢复...`
          })
          
          // 延迟重连
          setTimeout(() => {
            const attemptReconnect = () => {
              if (socketClient.isConnected()) {
                newSessions.forEach(session => {
                  socketClient.emit('reconnect-session', { sessionId: session.id })
                })
              } else {
                const onConnect = () => {
                  newSessions.forEach(session => {
                    socketClient.emit('reconnect-session', { sessionId: session.id })
                  })
                  socketClient.off('connect', onConnect)
                }
                socketClient.on('connect', onConnect as () => void)
              }
            }
            
            attemptReconnect()
          }, 1000)
        }
      } catch (error) {
        console.error('获取现有终端会话失败:', error)
        addNotification({
          type: 'error',
          title: '加载会话失败',
          message: '无法从服务器获取现有的终端会话。'
        })
      }
    }
    
    loadExistingSessions()
  }, [])
  
  // 使用useRef来保存最新的sessions状态，避免重复注册事件监听器
  const sessionsRef = useRef<TerminalSession[]>([])
  
  useEffect(() => {
    sessionsRef.current = sessions
  }, [sessions])
  
  useEffect(() => {
    // 监听终端输出
    const handleTerminalOutput = ({ sessionId, data }: { sessionId: string; data: string }) => {
      const session = sessionsRef.current.find(s => s.id === sessionId)
      if (session) {
        session.terminal.write(data)
      }
    }
    
    // 监听终端创建成功
    const handleTerminalCreated = ({ sessionId, name }: { sessionId: string; name: string }) => {
      console.log(`终端创建成功: ${sessionId} - ${name}`)
    }
    
    // 监听终端关闭
    const handleTerminalClosed = ({ sessionId }: { sessionId: string }) => {
      console.log(`终端已关闭: ${sessionId}`)
    }
    
    // 监听会话重连成功
    const handleSessionReconnected = ({ sessionId }: { sessionId: string }) => {
      console.log(`会话重连成功: ${sessionId}`)
    }
    
    // 监听会话重连失败
    const handleSessionReconnectFailed = ({ sessionId }: { sessionId: string }) => {
      console.log(`会话重连失败: ${sessionId}`)
      addNotification({
        type: 'error',
        title: '会话重连失败',
        message: `终端会话 ${sessionId} 重连失败，可能已过期`
      })
    }
    
    socketClient.on('terminal-output', handleTerminalOutput)
    socketClient.on('terminal-created', handleTerminalCreated)
    socketClient.on('terminal-closed', handleTerminalClosed)
    socketClient.on('session-reconnected', handleSessionReconnected)
    socketClient.on('session-reconnect-failed', handleSessionReconnectFailed)
    
    return () => {
      socketClient.off('terminal-output', handleTerminalOutput)
      socketClient.off('terminal-created', handleTerminalCreated)
      socketClient.off('terminal-closed', handleTerminalClosed)
      socketClient.off('session-reconnected', handleSessionReconnected)
      socketClient.off('session-reconnect-failed', handleSessionReconnectFailed)
    }
  }, [addNotification]) // 只依赖addNotification，不依赖sessions
  
  useEffect(() => {
    // 当活动会话改变时，挂载终端到DOM
    const activeSession = sessions.find(s => s.id === activeSessionId)
    if (activeSession && terminalContainerRef.current) {
      const container = terminalContainerRef.current

      // 清空容器
      while (container.firstChild) {
        container.removeChild(container.firstChild)
      }

      try {
        if (!activeSession.terminal.element) {
          activeSession.terminal.open(container)
        } else {
          container.appendChild(activeSession.terminal.element)
        }

        activeSession.terminal.focus()

        // 延迟调整大小
        setTimeout(() => {
          activeSession.fitAddon.fit()
        }, 50)
      } catch (error) {
        console.error('挂载终端失败:', error)
      }
    }
  }, [activeSessionId, sessions])
  
  useEffect(() => {
    // 窗口大小变化时调整终端大小
    const handleResize = () => {
      const activeSession = sessions.find(s => s.id === activeSessionId)
      if (activeSession) {
        setTimeout(() => {
          activeSession.fitAddon.fit()
        }, 100)
      }
    }
    
    // 监听全屏状态变化
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement
      if (isCurrentlyFullscreen !== isFullscreen) {
        setIsFullscreen(isCurrentlyFullscreen)
        if (!isCurrentlyFullscreen) {
          addNotification({
            type: 'info',
            title: '已退出全屏模式',
            message: '全屏模式已关闭'
          })
        }
        // 调整终端大小
        setTimeout(() => {
          const activeSession = sessions.find(s => s.id === activeSessionId)
          if (activeSession) {
            activeSession.fitAddon.fit()
          }
        }, 200)
      }
    }
    
    window.addEventListener('resize', handleResize)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    
    return () => {
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [activeSessionId, sessions, isFullscreen, addNotification])
  
  // 判断侧边栏是否应该显示
  const shouldShowSidebar = !isFullscreen && (!sidebarCollapsed || sidebarHovered)
  
  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-gray-900' : 'h-screen'} flex`}>
      {/* 左侧终端标签页侧边栏 */}
      {!isFullscreen && (
        <div 
          className={`
            relative bg-gray-800/50 backdrop-blur-sm border-r border-gray-700/50 transition-all duration-300 ease-in-out
            ${shouldShowSidebar ? 'w-80' : 'w-12'}
            ${sidebarHovered ? 'shadow-xl' : ''}
          `}
          onMouseEnter={() => setSidebarHovered(true)}
          onMouseLeave={() => setSidebarHovered(false)}
        >
        {/* 侧边栏头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700/50">
          {shouldShowSidebar && (
            <>
              <div className="flex items-center space-x-2">
                <TerminalIcon className="w-5 h-5 text-blue-400" />
                <h2 className="text-lg font-semibold text-white font-display">
                  终端管理
                </h2>
              </div>
              
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="折叠侧边栏"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </>
          )}
          
          {!shouldShowSidebar && (
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors mx-auto"
              title="展开侧边栏"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
        
        {/* 新建终端按钮 */}
        {shouldShowSidebar && (
          <div className="p-4 border-b border-gray-700/50">
            <button
              onClick={createTerminalSession}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>新建终端</span>
            </button>
          </div>
        )}
        
        {/* 终端会话列表 */}
        <div className="flex-1 overflow-y-auto">
          {shouldShowSidebar ? (
            <div className="p-2 space-y-1">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`
                    group relative p-3 rounded-lg cursor-pointer transition-all
                    ${session.active
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                      : 'text-gray-300 hover:bg-white/5 hover:text-white'
                    }
                  `}
                  onClick={() => switchTerminalSession(session.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      <Folder className="w-4 h-4 flex-shrink-0" />
                      
                      {editingSessionId === session.id ? (
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onBlur={finishRenaming}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') finishRenaming()
                            if (e.key === 'Escape') cancelRenaming()
                          }}
                          className="bg-gray-700 text-white px-2 py-1 rounded text-sm flex-1 min-w-0"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="text-sm font-medium truncate flex-1">
                          {session.name}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {editingSessionId === session.id ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            finishRenaming()
                          }}
                          className="p-1 text-green-400 hover:text-green-300 transition-colors"
                          title="确认重命名"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            startRenaming(session.id, session.name)
                          }}
                          className="p-1 text-gray-400 hover:text-white transition-colors"
                          title="重命名"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      )}
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          closeTerminalSession(session.id)
                        }}
                        className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                        title="关闭终端"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-500 mt-1 truncate">
                    {session.id}
                  </div>
                </div>
              ))}
              
              {sessions.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <TerminalIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">暂无终端会话</p>
                </div>
              )}
            </div>
          ) : (
            // 折叠状态下的简化显示
            <div className="p-1 space-y-1">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`
                    w-10 h-10 rounded-lg cursor-pointer transition-all flex items-center justify-center
                    ${session.active
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }
                  `}
                  onClick={() => switchTerminalSession(session.id)}
                  title={session.name}
                >
                  <Folder className="w-4 h-4" />
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* 侧边栏底部工具栏 */}
        {shouldShowSidebar && activeSessionId && (
          <div className="p-4 border-t border-gray-700/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <button
                  onClick={resetTerminal}
                  className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  title="重置终端"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                
                <button
                  className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  title="终端设置"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
              
              <button
                onClick={toggleFullscreen}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title={isFullscreen ? '退出全屏' : '全屏模式'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
        </div>
      )}
      
      {/* 右侧终端显示区域 */}
      <div className="flex-1 flex flex-col min-w-0">
        {sessions.length === 0 ? (
          <div className="flex-1 flex items-center justify-center bg-gray-900">
            <div className="text-center">
              <TerminalIcon className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400 mb-4">暂无终端会话</p>
              <button
                onClick={createTerminalSession}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
              >
                创建第一个终端
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* 终端头部 */}
            <div className="flex-shrink-0 bg-gray-800/50 backdrop-blur-sm border-b border-gray-700/50 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                  <div className="text-sm font-medium text-white">
                    {sessions.find(s => s.active)?.name || '终端'}
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  {isFullscreen && (
                    <button
                      onClick={toggleFullscreen}
                      className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                      title="退出全屏"
                    >
                      <Minimize2 className="w-4 h-4" />
                    </button>
                  )}
                  <div className="text-xs text-gray-400 font-mono">
                    {activeSessionId}
                  </div>
                </div>
              </div>
            </div>
            
            {/* 终端内容 */}
            <div
              ref={terminalContainerRef}
              className="flex-1 bg-gray-900 min-h-0"
            />
          </>
        )}
      </div>
    </div>
  )
}

export default TerminalPage