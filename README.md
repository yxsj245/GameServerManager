再写一个文件管理功能 使用了 Ant Design (antd) 作为基础UI组件库 使用Monaco Editor （VS Code的编辑器内核）：
其中Monaco Editor 应当在面板中集成
```json
"@monaco-editor/react": "^4.6.0",
"monaco-editor": "^0.45.0"
```
```ts
import loader from '@monaco-editor/loader';
import * as monaco from 'monaco-editor';

// 配置@monaco-editor/react使用本地的monaco-editor包而不是CDN
loader.config({ monaco });

export default loader;
```
- 导入本地安装的 monaco-editor 包
- 使用 loader.config({ monaco }) 告诉 @monaco-editor/react 使用本地的monaco实例而不是从CDN加载

要支持文件的新建、删除、重命名、上传、下载、查看文件内容、切换目录等基础功能 并且支持右键文件的功能

文件管理要支持多选批量操作 做成九宫格形式优先展示文件夹之后再展示文件 要支持路径的输入和识别 默认路径应当设置在程序运行路径下

所有需要用户输入交互操作 专门做一个对话框或表单 要求具备动画