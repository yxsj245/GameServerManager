import React, { useState, useEffect } from 'react'
import { useOnboardingStore } from '@/stores/onboardingStore'
import { X, ChevronLeft, ChevronRight, Check, SkipForward } from 'lucide-react'
import SteamCMDOnboardingStep from './onboarding/SteamCMDOnboardingStep'
import GamePathOnboardingStep from './onboarding/GamePathOnboardingStep'

const OnboardingWizard: React.FC = () => {
  const {
    currentStep,
    steps,
    showOnboarding,
    shouldShowOnboarding,
    nextStep,
    prevStep,
    completeOnboarding,
    setShowOnboarding
  } = useOnboardingStore()

  // 动画状态管理
  const [isVisible, setIsVisible] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [stepContentKey, setStepContentKey] = useState(0)

  // 控制整体显示/隐藏动画
  useEffect(() => {
    if (shouldShowOnboarding() && showOnboarding) {
      setIsVisible(true)
      setIsClosing(false)
    } else {
      setIsVisible(false)
    }
  }, [shouldShowOnboarding, showOnboarding])

  // 步骤切换时的内容动画
  useEffect(() => {
    setStepContentKey(prev => prev + 1)
  }, [currentStep])

  // 如果不需要显示引导，返回null
  if (!shouldShowOnboarding() || !showOnboarding) {
    return null
  }

  const currentStepData = steps[currentStep]
  const isLastStep = currentStep === steps.length - 1
  // 可以继续的条件：步骤已完成 或 步骤可跳过 或 是最后一步
  const canGoNext = currentStepData?.completed || currentStepData?.skippable || isLastStep



  const handleNext = () => {
    if (isLastStep) {
      handleClose()
    } else {
      nextStep()
    }
  }

  const handleClose = () => {
    setIsClosing(true)
    // 延迟执行关闭，让动画播放完成
    setTimeout(() => {
      setShowOnboarding(false)
      completeOnboarding()
      setIsClosing(false)
    }, 300) // 与CSS动画时间匹配
  }

  const renderStepContent = () => {
    switch (currentStepData?.id) {
      case 'steamcmd':
        return <SteamCMDOnboardingStep />
      case 'game-path':
        return <GamePathOnboardingStep />
      default:
        return <div>未知步骤</div>
    }
  }

  return (
    <div
      className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-300 ease-in-out ${
        isVisible && !isClosing ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
          isVisible && !isClosing
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 translate-y-4'
        }`}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="animate-fade-in-up">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              欢迎使用 GSManager3
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              让我们快速配置您的游戏服务器管理环境
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-all duration-200 hover:scale-110 animate-fade-in-up animation-delay-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 进度指示器 */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`
                  flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-all duration-300 ease-in-out
                  ${index < currentStep ? 'bg-green-500 text-white transform scale-110' :
                    index === currentStep ? 'bg-blue-500 text-white animate-pulse-glow' :
                    'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400'}
                `}>
                  {index < currentStep ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                <div className="ml-3">
                  <p className={`text-sm font-medium ${
                    index === currentStep ? 'text-blue-600 dark:text-blue-400' : 
                    'text-gray-600 dark:text-gray-400'
                  }`}>
                    {step.title}
                  </p>
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-16 h-0.5 mx-4 transition-all duration-500 ease-in-out ${
                    index < currentStep ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 步骤内容 */}
        <div className="p-6 flex-1 overflow-y-auto min-h-0">
          <div
            key={`header-${stepContentKey}`}
            className="mb-6 animate-fade-in-up"
          >
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {currentStepData?.title}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {currentStepData?.description}
            </p>
          </div>

          <div
            key={`content-${stepContentKey}`}
            className="animate-fade-in-up animation-delay-100"
          >
            {renderStepContent()}
          </div>
        </div>

        {/* 底部操作栏 */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <button
            onClick={prevStep}
            disabled={currentStep === 0}
            className="flex items-center space-x-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 animate-fade-in-up animation-delay-300"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>上一步</span>
          </button>

          <div className="flex items-center space-x-3">
            {currentStepData?.skippable && !currentStepData.completed && (
              <button
                onClick={() => {
                  useOnboardingStore.getState().skipStep(currentStepData.id)
                  // 跳过后自动进入下一步
                  if (!isLastStep) {
                    nextStep()
                  } else {
                    handleClose()
                  }
                }}
                className="flex items-center space-x-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-all duration-200 hover:scale-105 animate-fade-in-up animation-delay-400"
              >
                <SkipForward className="w-4 h-4" />
                <span>跳过</span>
              </button>
            )}

            <button
              onClick={handleNext}
              disabled={!canGoNext}
              className="flex items-center space-x-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 animate-fade-in-up animation-delay-500"
            >
              <span>{isLastStep ? '退出' : '下一步'}</span>
              {!isLastStep && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OnboardingWizard
