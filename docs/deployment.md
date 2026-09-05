# 部署手册（单机单实例）

- 状态：现行
- 关联：ADR-0002（服务器权威）、ADR-0007（内存态单实例与房间回收）
- 模板：`deploy/catan.service`（systemd）、`deploy/Caddyfile`（反向代理）、`deploy/release.sh`（发布）

## 架构

一台云服务器承载全部组件。房间与进行中的对局活在进程内存里（ADR-0007），
账号、登录会话和最终结算保存在 SQLite（ADR-0010/0011）。必须单实例部署，重启会结束所有进行中的对局。

**第一版为 IP 直连访问（HTTP:80），暂无域名**；接入域名时只需改 Caddyfile 一行，
前端不需要重新构建（客户端按页面协议自动在 `ws://` 与 `wss://` 之间切换）。

```text
用户浏览器
   │ HTTP (80)，v1 用 IP 访问；接入域名后升级为 HTTPS (443)
   ▼
Caddy ──静态文件──▶ /opt/catan/apps/web/dist      （前端构建产物）
   │
   ├─ /api/* 反代 ─▶ 127.0.0.1:8787 Node 单进程   （systemd: catan.service）
   └─ /ws    反代 ─▶ 同一进程，WebSocket 升级
                          │
                          ▼
                    进程内存中的房间与对局（无落盘，重启即丢）
```

目录约定：

| 路径 | 内容 |
|---|---|
| `/opt/catan` | 代码（git clone），属主 `catan` 用户 |
| `/var/log/catan/deploy.log` | 发布记录（`release.sh` 追写） |

账号数据库位于 `/var/lib/catan/catan.sqlite`，备份位于 `/var/lib/catan-backups`。
systemd 的 `StateDirectory` 与 `UMask=0077` 管理权限；日志仍由 stdout 交给 journald。

## 环境变量

| 变量 | 生产取值 | 说明 |
|---|---|---|
| `HOST` | `127.0.0.1` | API 只对本机反代暴露，不直接上公网 |
| `PORT` | `8787` | API 与 WebSocket 共用端口 |
| `LOG_LEVEL` | `info` | pino 日志级别；排查时可临时调 `debug` |
| `TRUST_PROXY` | 不设置（默认 `127.0.0.1`） | 信任哪一跳的 `X-Forwarded-For`。**限流按客户端 IP 计数，靠这个才能拿到真实地址**；默认信任本机 Caddy，前面再加一层 CDN/LB 时才需要改 |
| `ROOM_IDLE_TTL_MINUTES` | 不设置（默认 `60`） | 无人连接的房间闲置多久后被回收 |
| `ROOM_CREATIONS_PER_MINUTE` | 不设置（默认 `10`） | 单 IP 每分钟建房上限 |
| `DEEPSEEK_API_KEY` | 部署时设置 | DeepSeek 服务端密钥；不配置时游戏照常运行，AI 解说按钮会提示暂未配置 |
| `DEEPSEEK_MODEL` | 不设置（默认 `deepseek-v4-flash`） | AI 解说使用的模型，可在模型升级时覆盖 |
| `DEEPSEEK_BASE_URL` | 不设置（默认 `https://api.deepseek.com`） | DeepSeek OpenAI 兼容接口根地址 |
| `AI_REQUESTS_PER_MINUTE` | 不设置（默认 `6`） | 每个客户端 IP 每分钟的付费 AI 解说请求上限。「大家在惦记什么」在此之上还有一层硬限制：每个座位每回合只能读一次，写在服务端，无法用变量放宽 |

`ROOM_*` 两个变量的默认值写在 `apps/server/src/app.ts` 顶部；`deploy/catan.service` 里以注释形式列出，需要时解注释即可。传入非正整数会让进程启动失败并打印变量名，不会静默回退。

AI key 只交给 Node 服务，绝不能写成 `VITE_*` 变量或放进 `apps/web`。生产机可这样配置：

```bash
sudo install -d -m 750 -o root -g catan /etc/catan
sudo install -m 640 -o root -g catan /dev/null /etc/catan/catan.env
sudoedit /etc/catan/catan.env  # 在编辑器中写入 DEEPSEEK_API_KEY=真实密钥
sudo systemctl restart catan
```

`deploy/catan.service` 通过 `EnvironmentFile` 读取该文件。AI 请求由服务端转发，浏览器收到的只有解说文本；密钥不会进入静态前端、网络响应或游戏状态。

> **别把 `TRUST_PROXY` 关掉。** 关掉之后所有请求在服务端看来都来自 `127.0.0.1`（Caddy
> 的地址），每分钟的建房配额就从"每人 10 个"变成"全站 10 个"，一个人手快就把其他人全
> 挡在门外。`apps/server/src/app.test.ts` 里有一条回归测试盯着这个行为。

## 首次部署

前置：一台 Linux，Node ≥ 22.16、pnpm 9（`corepack enable`）、git、Caddy。
**两大发行版的运行时安装方式完全不同**（步骤 0），从步骤 1 起两边一样。

> **当前生产环境**（2026-08-24 部署，本节命令即为实际执行并验证过的）：
> AWS EC2 `t3.micro`（2 核 / 913 Mi 内存 / 8 GB 磁盘，us-east-2），
> **Amazon Linux 2023**，Node 22.23.2，Caddy 2.11.4，IP 直连 HTTP。

### 步骤 0：运行时（按发行版二选一）

#### Amazon Linux 2023

系统仓库里的 Node 是 **18.20.8**，低于本项目要求，必须走 NodeSource；
仓库里**根本没有 caddy 包**，用官方静态二进制，并自己建服务账号和 systemd 单元。

```bash
# git 与 Node 22
sudo dnf install -y git
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo dnf install -y nodejs
sudo corepack enable          # 仓库内按 packageManager 字段自动切到 pnpm 9

# Caddy：官方二进制 + 服务账号 + 单元文件
cd /tmp
curl -fsSL -o caddy.tar.gz https://github.com/caddyserver/caddy/releases/download/v2.11.4/caddy_2.11.4_linux_amd64.tar.gz
tar xzf caddy.tar.gz caddy && sudo install -m 755 caddy /usr/bin/caddy && rm -f caddy caddy.tar.gz
sudo groupadd --system caddy
sudo useradd --system --gid caddy --create-home --home-dir /var/lib/caddy --shell /usr/sbin/nologin caddy
sudo mkdir -p /etc/caddy
sudo tee /etc/systemd/system/caddy.service >/dev/null <<'UNIT'
[Unit]
Description=Caddy
After=network.target network-online.target
Requires=network-online.target

[Service]
Type=notify
User=caddy
Group=caddy
ExecStart=/usr/bin/caddy run --environ --config /etc/caddy/Caddyfile
ExecReload=/usr/bin/caddy reload --config /etc/caddy/Caddyfile --force
TimeoutStopSec=5s
LimitNOFILE=1048576
PrivateTmp=true
ProtectSystem=full
AmbientCapabilities=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
```

#### Ubuntu / Debian

Ubuntu 24.04 自带的 Node 也是 18，同样需要 NodeSource；Caddy 有官方 apt 源，
装完即自带 `caddy` 用户、`/etc/caddy` 和 systemd 单元，不用手工建。

```bash
sudo apt-get install -y git
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs
sudo corepack enable
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update && sudo apt-get install -y caddy
```

### 步骤 1：swap（内存不足 2 GB 时）

```bash
sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

t3.micro 只有 913 Mi 内存，构建期跑 TypeScript 和 Vite 有被 OOM 杀掉的风险。
实测这一步其实只用掉 4 MB swap、构建 6 秒完成 —— 但它是免费的保险，机器小就加上。

### 步骤 2：专用用户与目录

```bash
sudo useradd --system --home /opt/catan --shell /usr/sbin/nologin catan
sudo mkdir -p /opt/catan /var/log/catan
sudo chown -R catan:catan /opt/catan /var/log/catan
```

### 步骤 3：取代码

仓库目前是**公开**的，直接 HTTPS clone 即可：

```bash
sudo -u catan git clone https://github.com/John8752/Catan_YLTC.git /opt/catan
```

<details>
<summary>如果仓库转为私有，改用部署密钥</summary>

```bash
sudo mkdir -p /etc/catan
sudo ssh-keygen -t ed25519 -N "" -C "catan-deploy@<机器名>" -f /etc/catan/deploy_key
ssh-keyscan -t ed25519,rsa ssh.github.com github.com | sudo tee /etc/catan/known_hosts
sudo chown catan:catan /etc/catan/deploy_key /etc/catan/deploy_key.pub /etc/catan/known_hosts
sudo chmod 600 /etc/catan/deploy_key
sudo cat /etc/catan/deploy_key.pub
# → 加到 GitHub 仓库 Settings → Deploy keys，**不要勾 Allow write access**

SSHCMD="ssh -i /etc/catan/deploy_key -o IdentitiesOnly=yes -o UserKnownHostsFile=/etc/catan/known_hosts"
sudo -u catan env GIT_SSH_COMMAND="$SSHCMD" git clone <repo-url> /opt/catan
sudo -u catan git -C /opt/catan config core.sshCommand "$SSHCMD"   # 固化，release.sh 的 git pull 直接可用
```
</details>

### 步骤 4：构建

```bash
cd /opt/catan
sudo -u catan env HOME=/opt/catan pnpm install --frozen-lockfile
sudo -u catan env HOME=/opt/catan pnpm build
```

> **`HOME=/opt/catan` 不能省。** `sudo -u` 默认保留调用者的 `HOME`，而 corepack 和 pnpm
> 要往 `$HOME` 里写缓存 —— 不显式设置的话它们会去写 `/home/ec2-user`，catan 用户没有权限。

产物：服务端在 `apps/server/dist`，前端在 `apps/web/dist`。

### 步骤 5：服务与反代

模板默认就是 IP 直连 `:80`，一个字都不用改：

```bash
cd /opt/catan
sudo cp deploy/catan.service /etc/systemd/system/catan.service
sudo systemctl daemon-reload
sudo systemctl enable --now catan

sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile   # 先查语法
sudo systemctl enable --now caddy      # Amazon Linux：单元是刚建的，首次要 enable --now
# Ubuntu：apt 装完 caddy 已在运行且已 enable，改用 sudo systemctl reload caddy
```

没有第 6 步 —— 无数据库、无账号体系，服务起来就能开房。

### 验证

```bash
systemctl is-enabled catan caddy    # 都应为 enabled，否则重启机器不会自动拉起
systemctl is-active catan caddy
sudo journalctl -u catan -n 5       # 应有 "Catan server listening"
curl -s http://127.0.0.1:8787/health
```

然后浏览器打开 `http://<服务器IP>/`，建房，**再换一台设备用房间码加入并真的走两步**。
这一步不能省：只建房不开局的话，`/ws` 反代断了也看不出来 —— 症状是首页 200、建房 201、
大厅一切正常，唯独对局连不上。

安全提示（IP + HTTP 阶段）：流量未加密。这是个 demo，没有账号密码，风险主要是
陌生人建房占内存 —— 已由 `ROOM_CREATIONS_PER_MINUTE` 限流和 `MemoryMax=512M` 兜住。
若要收窄到熟人范围，用云厂商安全组把 80 端口来源限制到你们的出口 IP。

> 云厂商侧别忘了放行入站 **80**（和 SSH 的 22）。安全组不放行的话，机器里一切正常，
> 外面就是连不上。

## 明文 HTTP 是现行状态（不是待办）

**当前不接域名、不上 TLS**，线上长期就是 `http://<IP>/`。这不是"还没来得及做"，
而是一个需要写进代码约束的前提。

明文 IP 源不是**安全上下文（secure context）**，浏览器会对一整族 Web API 闭嘴，
直接把它们留成 `undefined` —— Safari 和 Chrome 一样。而本地开发跑在 `localhost`，
**localhost 算安全上下文**，所以这类故障在开发机上一次都不会复现，只在大家真正
用来玩的手机上炸。

已经踩过一次：`crypto.randomUUID` 在手机 Safari 上是 `undefined`，导致客户端提交
不了任何一条游戏命令，摆放定居点直接卡死；桌面开发全程无感。

约束与执行方式写在 `AGENTS.md` 的「Insecure-context constraint」一节，并由
`apps/web/src/lib/secure-context.test.ts` 在构建时拦截（`pnpm --filter @catan/web test`）。
要点：

- 禁止无保护地调用 secure-context-only API（`crypto.subtle`、`navigator.clipboard`、
  `navigator.share`、`navigator.geolocation`、Service Worker、`Notification` 等）
- 生成 id 一律走 `apps/web/src/lib/random-id.ts` 的 `randomId()`
- 不设 `Secure` cookie、不发 HSTS —— 两者都会让站点在这个源上直接不可用
- socket 协议从 `window.location.protocol` 推导，不写死 `wss://`

`crypto.getRandomValues`、`localStorage`、`fetch`、`WebSocket` 不受限制，可放心用。

## 将来接入域名与 HTTPS

只有一步，服务不动：`/etc/caddy/Caddyfile` 里把站点地址 `:80` 换成域名
（如 `catan.example.com`），`sudo systemctl reload caddy`。Caddy 自动申请并续期证书、
HTTP 自动跳转 HTTPS，页面变成 https 之后客户端会自动把游戏连接升级为 `wss://`
（见 `apps/web/src/api.ts` 的 `connectToRoom`）。前端无需重新构建。

> **运行方式说明**：`apps/server` 用 tsup 打包，`noExternal` 把 `@catan/game-core`
> 和 `@catan/protocol` 内联进 `dist/index.js`，所以生产直接 `node dist/index.js`，
> 不需要 tsx 或其他运行时转译。

## 日常发布

```bash
sudo bash /opt/catan/deploy/release.sh
```

脚本做四件事：`git pull` → `pnpm install --frozen-lockfile` → `pnpm build` →
`systemctl restart`，任一步失败即中止；发布成功需 `http://127.0.0.1:8787/health`
在 30 秒内返回正常。每次发布追写一行到 `/var/log/catan/deploy.log`：

```text
2026-08-21T14:30:12+0800  eab3ef2 → 9f3c1a8  by charles  OK       (build 42s)
2026-08-21T15:02:44+0800  9f3c1a8 → 9f3c1a8  by charles  FAILED   (pnpm build)
```

脚本在重启前会读一次 `/health` 的房间数，若不为 0 会打印提示。

**重启结束所有进行中的对局**（ADR-0007，内存态无持久化，且没有断线重连能跨越进程
重启的机制）。选没人在玩的时候发布。

手动等价步骤（脚本不可用时的兜底）：

```bash
cd /opt/catan
sudo -u catan git pull
sudo -u catan pnpm install --frozen-lockfile
sudo -u catan pnpm build
sudo systemctl restart catan
```

## 日志与观测

应用日志是 pino 的 JSON 行，打到 stdout 由 systemd 交给 journald（无独立日志文件，
无需 logrotate）。

```bash
journalctl -u catan -f              # 实时跟随
journalctl -u catan --since today   # 今天的日志
journalctl -u catan | grep '"level":50'   # 只看 ERROR
journalctl -u catan | grep '"level":40'   # 只看 WARN
```

> 级别过滤用 grep JSON 字段，而不是 `journalctl -p warn` —— 后者依赖行首的 syslog
> 优先级前缀，本服务没有加（那需要额外的 pino 传输层）。这一点与 CRM_Web 不同。

记什么、不记什么：

- **启动横幅**：`Catan server listening`，含监听端口、Node 版本、生效的日志级别
- **失败请求**：4xx 记 `WARN`、5xx 记 `ERROR`。**成功请求不记** —— 一局游戏几百个
  命令，全记会把 journal 冲垮
- **房间回收**：`evicted idle rooms`，含本轮回收数量与剩余房间数
- **停机**：`shutting down`，含触发的信号

> 日志里记的是**路由模板**（`/api/rooms/:roomId`）而不是原始 URL —— seatToken 走在
> query string 里，记原始 URL 等于把座位凭据写进日志。改动这段时请保持这个约束。

`/health` 返回 `{"ok":true,"service":"catan-server","rooms":N}`，`rooms` 是当前驻留的
房间数，可以用它判断内存增长是否正常。该端点只在 127.0.0.1 上可达（Caddy 不代理它）。

### 保留策略

journald 的保留是**整机全局**配置，在 `/etc/systemd/journald.conf` 设置：

```ini
[Journal]
SystemMaxUse=200M
MaxRetentionSec=30day
```

改后 `sudo systemctl restart systemd-journald` 生效。只记失败请求的话用量很小。

## 内存与容量

房间在内存里，是唯一会增长的东西。实测（2026-08-21，生产构建，通过真实 API 打完整局）：

| 状态 | RSS | 单次房间状态响应 |
|---|---|---|
| 空载 | 约 61 MB | — |
| 200 个空闲大厅房间 | 约 80 MB（每房间约 47 KB） | — |
| 一局进行到 1600 条命令 | 约 157 MB | 约 66 KB |
| 一局进行到 4000 条命令 | 约 158 MB | 约 71 KB |

**空闲大厅房间很便宜，进行中的对局才是大头**，但两者现在都不随对局长度失控：投影只带
最近的事件记录（`MAX_PROJECTED_EVENT_RECORDS`），所以响应体稳定在 70 KB 上下，不管这局
打了多久。作为参照，5 分制的三人局实测 215–590 条命令打完，10 分制会长不少。

`catan.service` 里的 `MemoryMax=512M` 按上表大约能容纳两三局同时进行的长局。私人局够用；
要开更多桌就调高它。真触发了 systemd 只会重启 Catan 自己（**代价是所有对局全丢**）。

放到当前这台 `t3.micro`（913 Mi）上看：这个上限已经超过整机内存的一半，所以它更像是
"别把机器拖垮"的保险丝而不是宽松余量。要同时开很多桌，先换更大的机器，别只调高这个数。

> 历史教训（2026-08-21 实测）：`RoomRegistry` 早期给每条命令缓存了一份完整的房间投影做
> 幂等，导致单局内存是命令数的**二次函数**，一局长局就能把 4 GB 堆撑爆并让进程 OOM。
> 现在只记命令的键，重试时按当前状态重新投影。改这块时别把整份投影再存回去。
>
> 同一轮还给投影的事件记录加了上限。取消这个上限，整局历史会重新挂在每一次房间推送上
> —— 而每条被接受的命令都会向每个座位全量推送房间，长局时就是每走一步给每人发上兆。

回收规则（ADR-0007）：**有人连着的房间永不回收**，无论玩家想多久；没有任何 WebSocket
连接、且超过 `ROOM_IDLE_TTL_MINUTES` 没被访问过的房间会在每 5 分钟一轮的扫描中删除。
所以"关标签页跑路"的房间最多留一小时。

代价要知道：断网超过 TTL 再回来，房间已经不在了。默认一小时对私人局够用，觉得不够
就调大 `ROOM_IDLE_TTL_MINUTES`，代价是废弃房间多占一会儿内存。

## 本地演练（可选）

不装任何新软件即可在开发机上模拟生产形态：

原理：`vite preview` 恰好承担 Caddy 的两个职责 —— 托管 `apps/web/dist` 构建产物、
把 `/api` 和 `/ws` 反代到 8787。（Vite 的 `preview.proxy` 缺省继承 `server.proxy`，
所以 `apps/web/vite.config.ts` 里那份开发代理配置在 preview 下同样生效，包括
`ws: true` 那条。）

```bash
pnpm build

# 终端 1：生产模式 API（跑生产构建，不是 tsx）
PORT=8787 HOST=127.0.0.1 LOG_LEVEL=info node apps/server/dist/index.js

# 终端 2：托管前端构建产物
pnpm --filter @catan/web exec vite preview --host
# 浏览器打开 http://localhost:4173，建房后另开一个标签页加入，验证对局连接
```

演练能覆盖：生产构建可运行、启动横幅、`/health`、限流、SIGTERM 优雅停机、
WebSocket 通路。未覆盖：systemd 单元、80 端口。注意本地开发的 API 若也在 8787 运行，
先停掉再演练。

### 连 Caddyfile 一起演练（更接近生产）

装了 Caddy 的话，可以直接用 `deploy/Caddyfile` 跑，把反代行为也一并验掉。只需改两处：
站点地址换成 `:8080`（免 sudo），`root` 换成本地 `apps/web/dist` 的绝对路径。

```bash
brew install caddy          # 或 apt install caddy
caddy validate --config deploy/Caddyfile --adapter caddyfile   # 先查语法
sed -e 's|^:80 {|:8080 {|' \
    -e "s|root \* /opt/catan/apps/web/dist|root * $PWD/apps/web/dist|" \
    deploy/Caddyfile > /tmp/Caddyfile.local

pnpm build
DATABASE_PATH="$HOME/.catan-yltc/catan.sqlite" NODE_ENV=production HOST=127.0.0.1 PORT=8787 node apps/server/dist/index.js &
caddy run --config /tmp/Caddyfile.local --adapter caddyfile
# 浏览器打开 http://127.0.0.1:8080
```

2026-08-21 实测走通：静态托管、`index.html` 的 `no-cache` 与构建产物的 `immutable`
缓存头、gzip、SPA 回退、`/api` 反代、`/ws` 的 WebSocket 升级，以及经由 Caddy 打完的
一整局（225 条命令分出胜负）。`/health` 确认从 Caddy 这一侧访问不到（落到静态回退返回
页面而非 JSON），符合预期。

> 顺带实测了漏掉 `handle /ws` 会怎样：首页 200、建房 201，大厅完全正常，只有对局的
> WebSocket 连不上。这就是那条规则值得单独强调的原因 —— 症状不指向反代配置。

API 挂掉时 Caddy 仍然照常返回页面，只有 `/api` 返回 502。所以"页面打得开"不代表服务
是好的，判断服务健康要看 `/health` 而不是首页。

## 迁移到新服务器

迁机时在新机完成「首次部署」，再按下文恢复账号和最终结算数据库。活动房间无法迁移。
旧机保留几天作回滚，确认稳定后下线。切换期间会中断正在进行的对局。

## 约束与注意事项（汇总）

- **单实例**：禁止 PM2 cluster / Node cluster / 多容器 / 多后端负载均衡 —— 房间在进程
  内存里，第二个实例看不到第一个实例的房间（ADR-0007）。
- **重启即丢局**：活动房间没有持久化；账号与已结束对局的结算保存在 SQLite。发布挑没人玩的时候。
- **人真的不回来了会卡死整局**：游戏开始后座位无法释放，也没有超时代打。座位存在浏览器里，
  所以关标签页、关浏览器、手机锁屏之后回来都还在原位；卡死的只剩"这个人再也不来了"这一种情况，
  剩下的人只能重开。处理方案已记在 `docs/risks-and-open-questions.md` 的 O3，尚未实现。
- **`/ws` 必须反代**：漏了这条 Caddy 规则，大厅正常但所有对局连不上，症状很隐蔽。
- **日志不记原始 URL**：seatToken 在 query string 里。
- **投影带的事件记录有上限**：完整历史留在服务端供重放，下发给客户端的只有最近一段。
- **API 绑 127.0.0.1**：公网入口只有 Caddy 一个。
- **限流依赖 `TRUST_PROXY`**：反代后面拿不到真实客户端 IP 的话，限流会误伤所有人。
- **发行版差异只在步骤 0**：Amazon Linux 与 Ubuntu 的运行时安装方式完全不同，
  且两边的系统仓库给的 Node 都是 18（太老），必须走 NodeSource。之后的步骤两边一致。
- **`catan.service` 的加固已在 Amazon Linux 2023 实测通过**（`ProtectSystem=strict`、
  `ProtectHome=true`）。换发行版后服务起不来时，先注释这两条确认能起，再逐条加回来定位。
- **云厂商安全组要放行 80**：机器里一切正常但外面连不上，先查这里再查 Caddy。
- 活动对局持久化仍是远期计划；账号和最终结算按 ADR-0010/0011 保存。


## 账号与最终结算数据库（2026-09-05）

运行时最低 Node 22.16。生产必须显式设置绝对 `DATABASE_PATH`，且目录必须在代码仓库之外并已存在。开发默认使用用户主目录下 `.catan-yltc/catan.sqlite`，首次启动创建权限为 0700 的目录。Linux 数据库和备份为 0600。Windows 开发机使用当前用户的目录权限，生产 Linux 权限需另行验收。

`catan.service` 使用 `StateDirectory=catan`、`UMask=0077`、`DATABASE_PATH=/var/lib/catan/catan.sqlite`。保持 `ProtectSystem=strict`，不需要开放代码目录写权限。启动按顺序核验和执行迁移；校验和变化、未知新版结构或错误路径会阻止启动。服务在数据库旁的空 SQLite 锁文件 `.runtime-lock` 上持有排他事务，离线维护与启动互斥。操作系统在进程异常退出后自动释放锁，文件可保留；不要删除运行中服务的锁文件。这份锁文件没有账号数据，不影响活动库的 WAL 写入和在线备份。

现有裸 IP HTTP 部署仍属于临时不安全模式。账号 Cookie 为 `catan_account_session`，只有 `HttpOnly; SameSite=Strict; Path=/`，没有 `Secure` 或 `__Host-`。这些措施不提供传输加密；登录表单保留提示。Caddy 必须保留 Host，服务器据此核验 Origin；不启用 CORS。`ACCOUNT_SESSION_DAYS` 默认 30，可在服务环境文件调整。

首次上线安装更新后的服务文件，并安装备份定时器。`deploy/release.sh` 已包含服务文件更新，并在已有数据库时使用旧版本 CLI 在线备份后再拉代码和构建。首次从无数据库版本升级时跳过备份，启动新服务创建数据库。

```bash
sudo cp deploy/catan.service deploy/catan-backup.service deploy/catan-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now catan-backup.timer
sudo systemctl restart catan
sudo systemctl start catan-backup.service
sudo journalctl -u catan-backup.service -n 20
```

备份每天服务器本地时间 04:00 执行，随机延迟不超过五分钟，保留 14 天；只清理匹配自身命名格式的旧备份。目录为 `/var/lib/catan-backups`，与活动库分开。备份使用 SQLite 在线 backup API，包含 WAL 中已提交内容，完成后校验完整性。服务器丢失会同时丢失本地备份，上线运维还需把备份复制到受控的异机位置。

常用命令如下，均从仓库根运行。开发可用 `pnpm --filter @catan/server db` 替代 `node apps/server/dist/database/cli.js`。

```bash
sudo -u catan env DATABASE_PATH=/var/lib/catan/catan.sqlite node apps/server/dist/database/cli.js status
sudo -u catan env DATABASE_PATH=/var/lib/catan/catan.sqlite node apps/server/dist/database/cli.js integrity
sudo -u catan env DATABASE_PATH=/var/lib/catan/catan.sqlite node apps/server/dist/database/cli.js backup /var/lib/catan-backups 14
```

恢复或回滚数据库必须停服，也暂停备份定时器并确认当前备份任务结束。不要把单个旧主文件覆盖在仍有 WAL 的活动目录上。先保留整个旧数据目录（包括 WAL/SHM），新建空目录，安装选定备份，校验后启动。下例需将 `BACKUP_FILE` 指向一次实际备份，并保证归档目录尚不存在。

```bash
sudo systemctl stop catan-backup.timer catan-backup.service catan
sudo mv /var/lib/catan /var/lib/catan-before-restore
sudo install -d -m 0700 -o catan -g catan /var/lib/catan
sudo install -m 0600 -o catan -g catan "$BACKUP_FILE" /var/lib/catan/catan.sqlite
sudo -u catan env DATABASE_PATH=/var/lib/catan/catan.sqlite node apps/server/dist/database/cli.js integrity
sudo -u catan env DATABASE_PATH=/var/lib/catan/catan.sqlite node apps/server/dist/database/cli.js revoke-sessions
sudo systemctl start catan catan-backup.timer
```

恢复后撤销所有登录，以免旧备份里的登录重新生效。账号和所选备份时间前的最终结算恢复，备份之后的数据不会出现，活动对局全部结束。回滚应用版本时，必须使用与目标版本结构兼容的备份；未知新版结构会拒绝启动。不提供向下迁移。回滚到无账号版本时保留完整数据库归档，用户无法访问账号与历史记录，但不能删除这些数据。

离线重置密码会撤销该账号的登录。先停服，使用终端静默读取新密码后通过标准输入传递；不能把密码放进参数、环境变量或日志。

```bash
sudo systemctl stop catan
read -r -s -p 'New password: ' RESET_PASSWORD
printf '%s' "$RESET_PASSWORD" | sudo -u catan env DATABASE_PATH=/var/lib/catan/catan.sqlite node apps/server/dist/database/cli.js reset-password USERNAME
unset RESET_PASSWORD
sudo systemctl start catan
```

上线前还需在 t3.micro 实测 scrypt 单次耗时和峰值内存。当前参数 N=131072/r=8/p=1，单个 hash 约占 128 MiB，服务最多同时执行一个，等待队列上限八个。注册和登录分别限流，用户名还有独立限流。以生产机结果调整前需更新密码参数升级测试和运维记录。
