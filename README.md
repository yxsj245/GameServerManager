在“实例管理”导航项的下面加一个“游戏部署”并按照下面要求实现功能
这个页面需要做多个标签页适配多种类型游戏部署界面
# steamCMD
从server\data\games\installgame.json 这个文件中读取所有steam快速部署游戏
这是个json文件示例如下
```json
{
    "Palworld": {
        "game_nameCN": "幻兽帕鲁",
        "appid": "2394010",
        "tip": "游戏端口：8211 UDP，配置文件位置：游戏根目录，存档位置：Pal/Saved/SaveGames，温馨提示：请将保存位置映射到容器外部，防止存档丢失",
        "image":"https://shared.cdn.queniuqe.com/store_item_assets/steam/apps/1623730/44e7cf48b38e3ace008e9f49c316f8cd949f7918/header_schinese.jpg",
        "url":"https://store.steampowered.com/app/1623730/Palworld/"
    },
}
```
Palworld-游戏名称，里面为所有此游戏的信息
game_nameCN-游戏名称（同时作为实例名称）
tip-游戏提示
image-图片地址
url-steam商城地址

# 安装游戏逻辑
 用户输入安装服务端到的路径
安装的时候，从设置中“SteamCMD设置”读取steamcmd所在路径，然后Windows使用steamcmd.exe调用终端在终端地方执行对应游戏安装的steamcmd命令。同时在需要在实例管理中创建此游戏的实例，启动命令写none

>注意事项：
您不能更改终端代码，请仔细阅读后您应该能看到已经有写好的接口可以直接用