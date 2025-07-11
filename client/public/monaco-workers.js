// Monaco Editor Workers 配置
// 确保 Monaco Editor 使用本地 worker 文件而不是 CDN

self.MonacoEnvironment = {
  getWorkerUrl: function (moduleId, label) {
    if (label === 'json') {
      return '/node_modules/monaco-editor/esm/vs/language/json/json.worker.js';
    }
    if (label === 'css' || label === 'scss' || label === 'less') {
      return '/node_modules/monaco-editor/esm/vs/language/css/css.worker.js';
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return '/node_modules/monaco-editor/esm/vs/language/html/html.worker.js';
    }
    if (label === 'typescript' || label === 'javascript') {
      return '/node_modules/monaco-editor/esm/vs/language/typescript/ts.worker.js';
    }
    return '/node_modules/monaco-editor/esm/vs/editor/editor.worker.js';
  }
};