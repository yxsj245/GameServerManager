import React, { useState, useEffect } from 'react'
import { Gamepad2, LogOut } from 'lucide-react'

interface LogoutTransitionProps {
  isVisible: boolean
  onComplete: () => void
}

const LogoutTransition: React.FC<LogoutTransitionProps> = ({ isVisible, onComplete }) => {
  const [stage, setStage] = useState<'hidden' | 'entering' | 'visible' | 'exiting'>('hidden')

  useEffect(() => {
    if (isVisible) {
      setStage('entering')
      const timer1 = setTimeout(() => {
        setStage('visible')
      }, 100)
      
      const timer2 = setTimeout(() => {
        setStage('exiting')
      }, 1500)
      
      const timer3 = setTimeout(() => {
        setStage('hidden')
        onComplete()
      }, 2000)
      
      return () => {
        clearTimeout(timer1)
        clearTimeout(timer2)
        clearTimeout(timer3)
      }
    }
  }, [isVisible, onComplete])

  if (stage === 'hidden') {
    return null
  }

  return (
    <div className={`
      fixed inset-0 z-50 flex items-center justify-center
      bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900
      transition-all duration-500
      ${stage === 'entering' ? 'opacity-0 scale-95' : ''}
      ${stage === 'visible' ? 'opacity-100 scale-100' : ''}
      ${stage === 'exiting' ? 'opacity-0 scale-105' : ''}
    `}>
      {/* 背景动画 */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-purple-900/20 to-slate-900/20 animate-background-shift" />
      
      {/* 主要内容 */}
      <div className={`
        relative z-10 text-center transition-all duration-700
        ${stage === 'entering' ? 'opacity-0 translate-y-10 scale-90' : ''}
        ${stage === 'visible' ? 'opacity-100 translate-y-0 scale-100' : ''}
        ${stage === 'exiting' ? 'opacity-0 translate-y-[-10px] scale-110' : ''}
      `}>
        {/* Logo */}
        <div className={`
          flex justify-center mb-6
          ${stage === 'visible' ? 'animate-logo-float' : ''}
        `}>
          <div className="p-6 glass rounded-full">
            <Gamepad2 className="w-16 h-16 text-blue-400" />
          </div>
        </div>
        
        {/* 登出图标 */}
        <div className={`
          flex justify-center mb-4
          ${stage === 'visible' ? 'animate-bounce-in animate-delay-300' : ''}
        `}>
          <div className="p-4 bg-red-500/20 rounded-full border border-red-500/30">
            <LogOut className="w-8 h-8 text-red-400" />
          </div>
        </div>
        
        {/* 文字 */}
        <div className={`
          transition-all duration-500
          ${stage === 'visible' ? 'animate-form-field-slide-in animate-delay-400' : ''}
        `}>
          <h2 className="text-2xl font-bold text-white mb-2">
            正在登出...
          </h2>
          <p className="text-gray-300">
            感谢您的使用，再见！
          </p>
        </div>
        
        {/* 加载动画 */}
        <div className={`
          mt-6 flex justify-center
          ${stage === 'visible' ? 'animate-form-field-slide-in animate-delay-500' : ''}
        `}>
          <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
      
      {/* 装饰性粒子效果 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className={`
              absolute w-2 h-2 bg-blue-400/30 rounded-full
              ${stage === 'visible' ? 'animate-pulse' : ''}
            `}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${2 + Math.random() * 3}s`
            }}
          />
        ))}
      </div>
    </div>
  )
}

export default LogoutTransition