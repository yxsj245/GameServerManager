import React, { useRef, useEffect } from 'react'
import { Editor } from '@monaco-editor/react'
import { useThemeStore } from '@/stores/themeStore'
import { getFileExtension } from '@/utils/format'
import type { editor } from 'monaco-editor'

interface MonacoEditorProps {
  value: string
  onChange: (value: string) => void
  fileName?: string
  readOnly?: boolean
  height?: string | number
  onSave?: (value: string) => void
}

// 根据文件扩展名获取语言
const getLanguageFromFileName = (fileName: string): string => {
  const ext = getFileExtension(fileName)
  
  const languageMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'less': 'less',
    'json': 'json',
    'xml': 'xml',
    'md': 'markdown',
    'py': 'python',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'h': 'c',
    'php': 'php',
    'go': 'go',
    'rs': 'rust',
    'sql': 'sql',
    'yml': 'yaml',
    'yaml': 'yaml',
    'sh': 'shell',
    'bat': 'bat',
    'ps1': 'powershell',
    'vue': 'html',
    'svelte': 'html'
  }
  
  return languageMap[ext] || 'plaintext'
}

export const MonacoEditor: React.FC<MonacoEditorProps> = ({
  value,
  onChange,
  fileName = '',
  readOnly = false,
  height = '100%',
  onSave
}) => {
  const { theme } = useThemeStore()
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  
  const language = getLanguageFromFileName(fileName)
  const monacoTheme = theme === 'dark' ? 'vs-dark' : 'vs'

  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor
    
    // 添加保存快捷键
    editor.addCommand(
      // Ctrl+S 或 Cmd+S
      2048 | 49, // monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS
      () => {
        if (onSave && editorRef.current) {
          onSave(editorRef.current.getValue())
        }
      }
    )
    
    // 设置编辑器选项
    editor.updateOptions({
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      lineHeight: 20,
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      wordWrap: 'on',
      tabSize: 2,
      insertSpaces: true,
      renderWhitespace: 'selection',
      renderControlCharacters: true,
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on'
    })
  }

  const handleEditorChange = (value: string | undefined) => {
    onChange(value || '')
  }

  // 当主题改变时更新编辑器主题
  useEffect(() => {
    if (editorRef.current) {
      // 使用 monaco.editor.setTheme 来动态切换主题
      import('monaco-editor').then(monaco => {
        monaco.editor.setTheme(monacoTheme)
      })
    }
  }, [monacoTheme])

  return (
    <div className="w-full h-full border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <Editor
        height={height}
        language={language}
        value={value}
        theme={monacoTheme}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        options={{
          readOnly,
          selectOnLineNumbers: true,
          roundedSelection: false,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          minimap: {
            enabled: !readOnly
          },
          contextmenu: true,
          mouseWheelZoom: true,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          renderLineHighlight: 'all',
          renderWhitespace: 'selection',
          wordWrap: 'on',
          lineNumbers: 'on',
          glyphMargin: true,
          folding: true,
          lineDecorationsWidth: 10,
          lineNumbersMinChars: 3,
          scrollbar: {
            vertical: 'auto',
            horizontal: 'auto',
            useShadows: false,
            verticalHasArrows: false,
            horizontalHasArrows: false,
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10
          }
        }}
        loading={
          <div className="flex items-center justify-center h-full">
            <div className="rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        }
      />
    </div>
  )
}