# 部署手册（单机单实例）

- 状态：现行
- 关联：ADR-0002（服务器权威）、ADR-0007（内存态单实例与房间回收）
- 模板：`deploy/catan.service`（systemd）、`deploy/Caddyfile`（反向代理）、`deploy/release.sh`（发布）

## 架构

一台云服务器承载全部组件。**没有数据库** —— 房间与对局全部活在进程内存里
（ADR-0007），因此必须单实例部署，且重启会结束所有进行中的对局。

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

没有数据目录 —— 服务不写任何文件，日志走 stdout 交给 journald。

## 环境变量

| 变量 | 生产取值 | 说明 |
|---|---|---|
| `HOST` | `127.0.0.1` | API 只对本机反代暴露，不直接上公网 |
| `PORT` | `8787` | API 与 WebSocket 共用端口 |
| `LOG_LEVEL` | `info` | pino 日志级别；排查时可临时调 `debug` |
| `TRUST_PROXY` | 不设置（默认 `127.0.0.1`） | 信任哪一跳的 `X-Forwarded-For`。**限流按客户端 IP 计数，靠这个才能拿到真实地址**；默认信任本机 Caddy，前面再加一层 CDN/LB 时才需要改 |
| `ROOM_IDLE_TTL_MINUTES` | 不设置（默认 `60`） | 无人连接的房间闲置多久后被回收 |
| `ROOM_CREATIONS_PER_MINUTE` | 不设置（默认 `10`） | 单 IP 每分钟建房上限 |

`ROOM_*` 两个变量的默认值写在 `apps/server/src/app.ts` 顶部；`deploy/catan.service` 里以注释形式列出，需要时解注释即可。传入非正整数会让进程启动失败并打印变量名，不会静默回退。

> **别把 `TRUST_PROXY` 关掉。** 关掉之后所有请求在服务端看来都来自 `127.0.0.1`（Caddy
> 的地址），每分钟的建房配额就从"每人 10 个"变成"全站 10 个"，一个人手快就把其他人全
> 挡在门外。`apps/server/src/app.test.ts` 里有一条回归测试盯着这个行为。

## 首次部署

前置：一台 Linux，Node ≥ 22.12、pnpm 9（`corepack enable`）、git、Caddy。
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

## 接入域名与 HTTPS（后续升级）

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
NODE_ENV=production HOST=127.0.0.1 PORT=8787 node apps/server/dist/index.js &
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

无状态服务，迁机就是在新机重做一遍「首次部署」，然后把访问地址换过去。没有数据要搬。
旧机保留几天作回滚，确认稳定后下线。切换期间会中断正在进行的对局。

## 约束与注意事项（汇总）

- **单实例**：禁止 PM2 cluster / Node cluster / 多容器 / 多后端负载均衡 —— 房间在进程
  内存里，第二个实例看不到第一个实例的房间（ADR-0007）。
- **重启即丢局**：没有持久化，也没有跨进程的断线重连。发布挑没人玩的时候。
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
- 持久化对局是远期计划（ADR-0002 已按可重放的命令/事件记录设计），当前规模不需要。
