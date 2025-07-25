FROM debian:bullseye-slim

ENV DEBIAN_FRONTEND=noninteractive \
    STEAM_USER=steam \
    STEAM_HOME=/root \
    STEAMCMD_DIR=/root/steamcmd \
    GAMES_DIR=/root/games \
    NODE_VERSION=22.17.0

# 将apt源改为中国镜像源（阿里云）
# RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list \
#     && sed -i 's/security.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list

# 安装所有依赖、Node.js、Java和Python，并清理缓存
RUN apt-get update && apt-get upgrade -y \
    && dpkg --add-architecture i386 \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        locales \
        wget \
        curl \
        jq \
        xdg-user-dirs \
        sudo \
        # Node.js相关依赖
        gnupg \
        # Python相关依赖
        python3 \
        python3-pip \
        python3-dev \
        python3-venv \
        # Java相关依赖
        apt-transport-https \
        # 游戏服务器依赖
        libncurses5:i386 \
        libbz2-1.0:i386 \
        libicu67:i386 \
        libxml2:i386 \
        libstdc++6:i386 \
        lib32gcc-s1 \
        libc6-i386 \
        lib32stdc++6 \
        libcurl4-gnutls-dev:i386 \
        libcurl4-gnutls-dev \
        libgl1-mesa-glx:i386 \
        gcc-10-base:i386 \
        libssl1.1:i386 \
        libopenal1:i386 \
        libtinfo6:i386 \
        libtcmalloc-minimal4:i386 \
        # .NET和Mono相关依赖（ECO服务器等需要）
        libgdiplus \
        libc6-dev \
        libasound2 \
        libpulse0 \
        libnss3 \
        libgconf-2-4 \
        libcap2 \
        libatk1.0-0 \
        libcairo2 \
        libcups2 \
        libgtk-3-0 \
        libgdk-pixbuf2.0-0 \
        libpango-1.0-0 \
        libx11-6 \
        libxt6 \
        # Unity游戏服务端额外依赖（7日杀等）
        libsdl2-2.0-0:i386 \
        libsdl2-2.0-0 \
        libpulse0:i386 \
        libfontconfig1:i386 \
        libfontconfig1 \
        libudev1:i386 \
        libudev1 \
        libpugixml1v5 \
        libvulkan1 \
        libvulkan1:i386 \
        libgconf-2-4:i386 \
        # 额外的Unity引擎依赖（特别针对7日杀）
        libatk1.0-0:i386 \
        libxcomposite1 \
        libxcomposite1:i386 \
        libxcursor1 \
        libxcursor1:i386 \
        libxrandr2 \
        libxrandr2:i386 \
        libxss1 \
        libxss1:i386 \
        libxtst6 \
        libxtst6:i386 \
        libxi6 \
        libxi6:i386 \
        libxkbfile1 \
        libxkbfile1:i386 \
        libasound2:i386 \
        libgtk-3-0:i386 \
        libdbus-1-3 \
        libdbus-1-3:i386 \
        # ARK: Survival Evolved（方舟生存进化）服务器额外依赖
        libelf1 \
        libelf1:i386 \
        libatomic1 \
        libatomic1:i386 \
        nano \
        net-tools \
        netcat \
        procps \
        tar \
        unzip \
        bzip2 \
        xz-utils \
        zlib1g:i386 \
        fonts-wqy-zenhei \
        fonts-wqy-microhei \
        libc6 \
        libc6:i386 \
    # 安装Node.js
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    # 安装Java 21
    && wget -qO - https://packages.adoptium.net/artifactory/api/gpg/key/public | apt-key add - \
    && echo "deb https://packages.adoptium.net/artifactory/deb $(awk -F= '/^VERSION_CODENAME/{print$2}' /etc/os-release) main" | tee /etc/apt/sources.list.d/adoptium.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends temurin-21-jdk \
    # 配置npm和pip镜像源
    && npm config set registry https://registry.npmmirror.com \
    && npm install -g npm@latest \
    && pip3 config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple \
    # 设置locales
    && sed -i -e 's/# en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/' /etc/locale.gen \
    && sed -i -e 's/# zh_CN.UTF-8 UTF-8/zh_CN.UTF-8 UTF-8/' /etc/locale.gen \
    && locale-gen \
    # 创建steam用户和应用目录，并给予root权限
    && useradd -m -s /bin/bash ${STEAM_USER} \
    && usermod -aG root ${STEAM_USER} \
    && usermod -aG sudo ${STEAM_USER} \
    && echo "${STEAM_USER} ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers \
    && mkdir -p ${STEAMCMD_DIR} ${GAMES_DIR} /app \
    && chown -R ${STEAM_USER}:root /home/steam \
    && chown -R ${STEAM_USER}:root /app \
    && chmod -R 755 /home/steam \
    && chmod -R 755 /app \
    # 清理apt缓存和临时文件
    && apt-get autoremove -y \
    && apt-get autoclean \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /tmp/* \
    && rm -rf /var/tmp/* \
    && rm -rf /var/cache/apt/archives/*

# 设置环境变量
ENV JAVA_HOME=/usr/lib/jvm/temurin-21-jdk-amd64 \
    PATH="$JAVA_HOME/bin:$PATH" \
    LANG=zh_CN.UTF-8 \
    LANGUAGE=zh_CN:zh \
    LC_ALL=zh_CN.UTF-8

# 复制项目文件
COPY --chown=steam:steam . /app/

# 切换到steam用户构建项目
USER ${STEAM_USER}
WORKDIR /app

# 切换回root用户继续安装SteamCMD和构建项目
USER root

# 下载安装SteamCMD、构建项目、安装Python依赖，并清理所有缓存
RUN mkdir -p ${STEAMCMD_DIR} \
    && cd ${STEAMCMD_DIR} \
    # 下载并安装SteamCMD
    && (if curl -s --connect-timeout 3 http://192.168.10.23:7890 >/dev/null 2>&1 || wget -q --timeout=3 --tries=1 http://192.168.10.23:7890 -O /dev/null >/dev/null 2>&1; then \
          echo "代理服务器可用，使用代理下载和初始化"; \
          export http_proxy=http://192.168.10.23:7890; \
          export https_proxy=http://192.168.10.23:7890; \
          wget -t 5 --retry-connrefused --waitretry=1 --read-timeout=20 --timeout=15 -O steamcmd_linux.tar.gz https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz \
          || wget -t 5 --retry-connrefused --waitretry=1 --read-timeout=20 --timeout=15 -O steamcmd_linux.tar.gz https://media.steampowered.com/installer/steamcmd_linux.tar.gz; \
          tar -xzvf steamcmd_linux.tar.gz; \
          rm steamcmd_linux.tar.gz; \
          chmod +x ${STEAMCMD_DIR}/steamcmd.sh; \
          cd ${STEAMCMD_DIR} && ./steamcmd.sh +quit; \
          unset http_proxy https_proxy; \
        else \
          echo "代理服务器不可用，使用直接连接"; \
          wget -t 5 --retry-connrefused --waitretry=1 --read-timeout=20 --timeout=15 -O steamcmd_linux.tar.gz https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz \
          || wget -t 5 --retry-connrefused --waitretry=1 --read-timeout=20 --timeout=15 -O steamcmd_linux.tar.gz https://media.steampowered.com/installer/steamcmd_linux.tar.gz; \
          tar -xzvf steamcmd_linux.tar.gz; \
          rm steamcmd_linux.tar.gz; \
          chmod +x ${STEAMCMD_DIR}/steamcmd.sh; \
          cd ${STEAMCMD_DIR} && ./steamcmd.sh +quit; \
        fi) \
    # 创建steamclient.so符号链接
    && mkdir -p ${STEAM_HOME}/.steam/sdk32 ${STEAM_HOME}/.steam/sdk64 \
    && ln -sf ${STEAMCMD_DIR}/linux32/steamclient.so ${STEAM_HOME}/.steam/sdk32/steamclient.so \
    && ln -sf ${STEAMCMD_DIR}/linux64/steamclient.so ${STEAM_HOME}/.steam/sdk64/steamclient.so \
    # 创建额外的游戏常用目录链接
    && mkdir -p ${STEAM_HOME}/.steam/sdk32/steamclient.so.dbg.sig ${STEAM_HOME}/.steam/sdk64/steamclient.so.dbg.sig \
    && mkdir -p ${STEAM_HOME}/.steam/steam \
    && ln -sf ${STEAMCMD_DIR}/linux32 ${STEAM_HOME}/.steam/steam/linux32 \
    && ln -sf ${STEAMCMD_DIR}/linux64 ${STEAM_HOME}/.steam/steam/linux64 \
    && ln -sf ${STEAMCMD_DIR}/steamcmd ${STEAM_HOME}/.steam/steam/steamcmd \
    # 构建项目
    && cd /app \
    && npm run install:all \
    && npm run package:linux:no-zip \
    # 安装Python依赖
    && pip3 install --no-cache-dir -r /app/server/src/Python/requirements.txt \
    # 复制构建好的应用到root目录
    && cp -r /app/dist/package/* /root/ \
    && chmod +x /root/start.sh \
    # 创建数据目录并复制默认数据
    && mkdir -p /root/server/data \
    && cp -r /app/server/data/* /root/server/data/ \
    && chown -R root:root /root/server/data \
    && chmod -R 775 /root \
    && chmod -R 775 /root/server \
    && chmod -R 775 /root/server/data \
    # 清理所有缓存和临时文件
    && npm cache clean --force \
    && rm -rf /app/node_modules \
    && rm -rf /app/client/node_modules \
    && rm -rf /app/server/node_modules \
    && rm -rf /app/dist \
    && rm -rf /app/.npm \
    && rm -rf /root/.npm \
    && rm -rf /home/steam/.npm \
    && pip3 cache purge \
    && rm -rf /root/.cache/pip \
    && rm -rf /home/steam/.cache \
    && rm -rf /tmp/* \
    && rm -rf /var/tmp/* \
    && find /app -name "*.log" -delete \
    && find /app -name "*.tmp" -delete \
    && find /root -name "*.log" -delete 2>/dev/null || true \
    && find /root -name "*.tmp" -delete 2>/dev/null || true

# 复制启动脚本到root目录
COPY start.sh /root/start.sh
RUN chmod +x /root/start.sh

# 创建目录用于挂载游戏数据
VOLUME ["${GAMES_DIR}"]

# 暴露GSM3管理面板端口
EXPOSE 3001

# 保持root用户
USER root
WORKDIR /root

# 启动容器时运行start.sh
ENTRYPOINT ["/root/start.sh"]