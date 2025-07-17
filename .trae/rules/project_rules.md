将服务端所有需要保存的数据统一保存在server\data 目录下
前端使用的token存储键是'gsm3_token'
路由文件的导入语句需要添加.js扩展名。
需要安装的库直接写进package.json文件中
切记所有涉及/api接口必须要加认证中间件import { authenticateToken } from '../middleware/auth.js'前端的实例管理 API 调用都通过 `api.ts` 中的 ApiClient 类进行
涉及实时通信相关需要使用websocket
操作config.json可以使用ConfigManager
改动目前已有的代码时要遵循当前设计逻辑，比如注释掉的代码非必要不要取消，部分功能没限制非必要不要限制