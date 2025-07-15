在“游戏部署”-“更多游戏部署”的右边加一个新的标签页“在线部署”并按照下面要求实现功能
进入这个页面首先先校验赞助者密钥是否存在以及在有效期内
然后需要使用后端代理请求向第二后端发送请求

# 获取在线部署游戏
请求地址 POST http://langlangy.server.xiaozhuhouses.asia:10002/api/online-games
请求体
```json
{
  "system": "string",
  "key": "string"
}
```
system 提交操作系统类型 Windows提交为Windows Linux平台提交Linux
key 提交赞助者密钥
返回
```json
{
  "status": "success",
  "message": "获取在线部署游戏列表成功",
  "system": "Windows",
  "data": {
    "我的世界基岩版": {
      "txt": "我的世界是一款游戏",
      "image": "http://images.server.xiaozhuhouses.asia:40061/i/2025/06/12/t0i9wh.jpg",
      "download": "http://langlangy.server.xiaozhuhouses.asia:8082/disk1/MC%e5%86%85%e5%ae%b9/%e6%95%b4%e5%90%88%e5%8c%85/%e5%8e%9f%e7%89%88/BE/bedrock-server.zip"
    }
  }
}
```
前端需要根据返回data中的信息按照steam游戏部署风格进行展示
当用户点击安装，需要输入安装路径，然后根据download链接后端下载压缩包解压到用户安装的路径。要求下载过程需要做成实时进度并且支持取消功能