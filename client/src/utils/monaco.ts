import loader from '@monaco-editor/loader'
import * as monaco from 'monaco-editor'

// 配置@monaco-editor/react使用本地的monaco-editor包而不是CDN
loader.config({ 
  monaco,
  paths: {
    vs: '/node_modules/monaco-editor/min/vs'
  }
})

export default loader
export { monaco }