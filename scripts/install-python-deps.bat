@echo off
echo 正在安装Python依赖...
pip install -r server/Python/requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple/ --trusted-host pypi.tuna.tsinghua.edu.cn
echo Python依赖安装完成！
pause