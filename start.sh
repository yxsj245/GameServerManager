#!/bin/bash

# GSM3 游戏服务端管理面板启动脚本

echo "======================================"
echo "    GSM3 游戏服务端管理面板"
echo "======================================"
echo

# 检查是否存在GSM3应用文件
if [ -f "server/index.js" ]; then
    echo "🚀 启动GSM3管理面板..."
    echo "📍 访问地址: http://localhost:3001"
    echo "📍 默认账户: admin / admin123"
    echo
    
    # 设置PTY可执行权限
    if [ -f "server/PTY/pty_linux_x64" ]; then
        chmod +x server/PTY/pty_linux_x64
        echo "✅ PTY权限设置完成"
    fi
    
    # 启动应用
    cd server
    node index.js
else
    echo "❌ 未找到GSM3应用文件，正在启动传统Steam服务器管理..."
    echo
    
    # 传统的Steam服务器管理菜单
    while true; do
        echo "请选择操作:"
        echo "1. 启动SteamCMD"
        echo "2. 查看游戏目录"
        echo "3. 退出"
        echo -n "请输入选项 (1-3): "
        read choice
        
        case $choice in
            1)
                echo "启动SteamCMD..."
                cd ${STEAMCMD_DIR}
                ./steamcmd.sh
                ;;
            2)
                echo "游戏目录内容:"
                ls -la ${GAMES_DIR}
                ;;
            3)
                echo "退出"
                exit 0
                ;;
            *)
                echo "无效选项，请重新选择"
                ;;
        esac
        echo
    done
fi