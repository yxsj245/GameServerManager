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
  Terminal as TerminalIcon
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

  const [isFullscreen, setIsFullscreen] = useState(false)
  const terminalContainerRef = useRef<HTMLDivElement>(null)
  const isSessionsLoadedRef = useRef(false) // 防止重复加载现有会话
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
    
    // 监听终端大小变化（只在Socket连接时才发送）
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
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
    
    // 延迟调整终端大小
    setTimeout(() => {
      const activeSession = sessions.find(s => s.id === activeSessionId)
      if (activeSession) {
        activeSession.fitAddon.fit()
      }
    }, 100)
  }
  
  // 页面加载时获取现有终端会话
  useEffect(() => {
    const loadExistingSessions = async () => {
      if (isSessionsLoadedRef.current) return // 如果已经加载过，直接返回
      isSessionsLoadedRef.current = true
      
      try {
        const response = await apiClient.getTerminalSessions()
        if (response.success && response.data.sessions.length > 0) {
          const sessionData = response.data.sessions
          
          // 直接创建会话实例并恢复连接
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
          
          // 延迟重连，确保Socket连接稳定
          setTimeout(() => {
            const attemptReconnect = () => {
              if (socketClient.isConnected()) {
                newSessions.forEach(session => {
                  console.log('发送重连请求:', session.id)
                  socketClient.emit('reconnect-session', { sessionId: session.id })
                })
              } else {
                const onConnect = () => {
                  newSessions.forEach(session => {
                    console.log('Socket连接后发送重连请求:', session.id)
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
  

  
  useEffect(() => {
    // 监听终端输出
    socketClient.on('terminal-output', ({ sessionId, data }) => {
      const session = sessions.find(s => s.id === sessionId)
      if (session) {
        session.terminal.write(data)
      }
    })
    
    // 监听终端创建成功
    socketClient.on('terminal-created', ({ sessionId, name }) => {
      console.log(`终端创建成功: ${sessionId} - ${name}`)
    })
    
    // 监听终端关闭
    socketClient.on('terminal-closed', ({ sessionId }) => {
      console.log(`终端已关闭: ${sessionId}`)
    })
    
    // 监听会话重连成功
    socketClient.on('session-reconnected', ({ sessionId }: { sessionId: string }) => {
      console.log(`会话重连成功: ${sessionId}`)
      // 不显示重连成功通知，避免过多提示
    })
    
    // 监听会话重连失败
    socketClient.on('session-reconnect-failed', ({ sessionId }: { sessionId: string }) => {
      console.log(`会话重连失败: ${sessionId}`)
      addNotification({
        type: 'error',
        title: '会话重连失败',
        message: `终端会话 ${sessionId} 重连失败，可能已过期`
      })
    })
    
    return () => {
      socketClient.off('terminal-output')
      socketClient.off('terminal-created')
      socketClient.off('terminal-closed')
      socketClient.off('session-reconnected')
      socketClient.off('session-reconnect-failed')
    }
  }, [sessions])
  
  useEffect(() => {
    // 当活动会话改变时，挂载终端到DOM
    const activeSession = sessions.find(s => s.id === activeSessionId)
    if (activeSession && terminalContainerRef.current) {
      const container = terminalContainerRef.current

      // 清空容器，这会从 DOM 中移除之前可能存在的终端
      while (container.firstChild) {
        container.removeChild(container.firstChild)
      }

      try {
        if (!activeSession.terminal.element) {
          // 如果终端尚未初始化，则打开它
          activeSession.terminal.open(container)
        } else {
          // 如果已经初始化，则将其DOM元素重新附加
          container.appendChild(activeSession.terminal.element)
        }

        // 终端获得焦点
        activeSession.terminal.focus()

        // 延迟调整大小以确保正确渲染
        setTimeout(() => {
          activeSession.fitAddon.fit()
        }, 50)
      } catch (error) {
        console.error('挂载或重新创建终端失败:', error)
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
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [activeSessionId, sessions])
  
  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-gray-900 flex flex-col' : ''}`}>
      <div className={`${isFullscreen ? 'flex flex-col h-full' : 'space-y-4'}`}>
        {/* 终端标签栏 */}
        <div className={`card-game p-4 ${isFullscreen ? 'flex-shrink-0' : ''}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <TerminalIcon className="w-5 h-5 text-blue-500" />
              <h2 className="text-lg font-semibold text-white font-display">
                终端管理
              </h2>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={createTerminalSession}
                className="btn-game px-4 py-2 text-sm flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>新建终端</span>
              </button>
              
              {activeSessionId && (
                <>
                  <button
                    onClick={resetTerminal}
                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="重置终端"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  
                  <button
                    onClick={toggleFullscreen}
                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title={isFullscreen ? '退出全屏' : '全屏模式'}
                  >
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                  
                  <button
                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="终端设置"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
          
          {/* 终端标签 */}
          {sessions.length > 0 && (
            <div className="flex space-x-2 overflow-x-auto">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`
                    flex items-center space-x-2 px-3 py-2 rounded-lg cursor-pointer transition-all
                    ${session.active
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                    }
                  `}
                  onClick={() => switchTerminalSession(session.id)}
                >
                  <span className="text-sm font-medium whitespace-nowrap">
                    {session.name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      closeTerminalSession(session.id)
                    }}
                    className="text-gray-500 hover:text-red-400 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* 终端容器 */}
        <div className={`terminal-container ${isFullscreen ? 'flex-1 min-h-0 flex flex-col' : 'h-96'}`}>
          {sessions.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <TerminalIcon className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400 mb-4">暂无终端会话</p>
                <button
                  onClick={createTerminalSession}
                  className="btn-game px-6 py-3"
                >
                  创建第一个终端
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* 终端头部 */}
              <div className={`terminal-header ${isFullscreen ? 'flex-shrink-0' : ''}`}>
                <div className="terminal-dots">
                  <div className="terminal-dot red"></div>
                  <div className="terminal-dot yellow"></div>
                  <div className="terminal-dot green"></div>
                </div>
                <div className="text-sm text-gray-400">
                  {sessions.find(s => s.active)?.name || '终端'}
                </div>
                <div className="text-xs text-gray-500">
                  {activeSessionId}
                </div>
              </div>
              
              {/* 终端内容 */}
              <div
                ref={terminalContainerRef}
                className={`${isFullscreen ? 'flex-1 min-h-0' : 'h-80'} bg-gray-900`}
              />
            </>
          )}
        </div>
        
        {/* 终端使用说明 */}
        {!isFullscreen && (
          <div className="card-game p-4">
            <h3 className="text-sm font-semibold text-white mb-2">使用说明</h3>
            <div className="text-xs text-gray-400 space-y-1">
              <p>• 支持多终端会话，可以同时运行多个终端</p>
              <p>• 终端会话在页面刷新后会自动恢复</p>
              <p>• 支持全屏模式，提供更好的操作体验</p>
              <p>• 支持所有标准终端操作和快捷键</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TerminalPage