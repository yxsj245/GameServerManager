在”设置“中加一个 ”赞助者密钥“ 并在用户点击保存后校验密钥是否有效 以下是校验逻辑
需要使用后端代理发送
向第二后端发送请求
# 校验密钥
请求地址 GET http://langlangy.server.xiaozhuhouses.asia:10002/api/key/check
请求参数Parameters
key(string)=<密钥>
返回：
```json
{
  "status": "success",
  "message": "密钥查询成功",
  "data": {
    "key": "jhYfzMWsQJPzZAAft1x0QVZE",
    "timeData": 1696694400000,
    "IP": [
      "127.0.0.1",
      "1.196.169.91"
    ],
    "current_request_ip": "1.196.169.91",
    "is_expired": true
  }
}
```
timeData=到期时间
其余参数不需要在前端展示