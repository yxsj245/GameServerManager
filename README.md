在 实例管理 页面中 加一个新的标签页 “实例市场”
当用户进入这个标签页的时候 后端需要请求第二个服务用来获取实例市场的实例列表
# 接口
请求地址：GET http://langlangy.server.xiaozhuhouses.asia:10002/api/instances
请求参数（Parameters）
system_type: 系统类型，传入linux或windows

返回示例
```json
{
  "instances": [
    {
      "name": "欧洲卡车模拟2",
      "command":".\\bin\\win_x64\\eurotrucks2_server.exe",
      "stopcommand":"^C"
    }
  ]
}
```
name 用于实例名称
command 启动命令
stopcommand 停止命令 ^C解析为ctrl+c

用户需要在安装实例的时候输入运行目录
然后通过上面这几个参数创建一个实例