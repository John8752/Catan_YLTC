#!/usr/bin/env bash
#
# First-time provisioning for a fresh Catan YLTC box: everything docs/deployment.md
# calls "首次部署", in one idempotent run. Re-running it is safe -- each step checks
# for its own result first -- so a run that dies halfway can just be repeated.
#
# This is the sibling of release.sh: provision.sh takes a bare machine to a serving
# one, release.sh moves a serving one to a newer commit.
#
#   curl -fsSL https://raw.githubusercontent.com/John8752/Catan_YLTC/main/deploy/provision.sh | sudo bash
#
# or, from a checkout:
#
#   sudo bash deploy/provision.sh

set -euo pipefail

REPO="https://github.com/John8752/Catan_YLTC.git"
APP_DIR=/opt/catan
CADDY_VERSION=2.11.4

step() { printf '\n\033[1m== %s\033[0m\n' "$1"; }

step "0. 运行时"
if [ -f /etc/amazon-linux-release ] || grep -qi "amazon linux" /etc/os-release; then
  DISTRO=amazon
  dnf install -y git tar
  # 系统仓库的 Node 是 18，低于本项目要求，必须走 NodeSource
  if ! command -v node >/dev/null || [ "$(node -v | cut -c2-3)" -lt 22 ]; then
    curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
    dnf install -y nodejs
  fi
  corepack enable

  # Amazon Linux 仓库里没有 caddy 包，用官方静态二进制并自建服务账号与单元
  if ! command -v caddy >/dev/null; then
    cd /tmp
    curl -fsSL -o caddy.tar.gz \
      "https://github.com/caddyserver/caddy/releases/download/v${CADDY_VERSION}/caddy_${CADDY_VERSION}_linux_amd64.tar.gz"
    tar xzf caddy.tar.gz caddy && install -m 755 caddy /usr/bin/caddy && rm -f caddy caddy.tar.gz
  fi
  getent group caddy >/dev/null || groupadd --system caddy
  id caddy >/dev/null 2>&1 || useradd --system --gid caddy --create-home \
    --home-dir /var/lib/caddy --shell /usr/sbin/nologin caddy
  mkdir -p /etc/caddy
  cat >/etc/systemd/system/caddy.service <<'UNIT'
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
  systemctl daemon-reload
else
  DISTRO=debian
  apt-get update && apt-get install -y git curl
  if ! command -v node >/dev/null || [ "$(node -v | cut -c2-3)" -lt 22 ]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs
  fi
  corepack enable
  if ! command -v caddy >/dev/null; then
    curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
      | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
      | tee /etc/apt/sources.list.d/caddy-stable.list
    apt-get update && apt-get install -y caddy
  fi
fi
echo "发行版: $DISTRO / node $(node -v) / caddy $(caddy version | head -1)"

step "1. swap（内存不足 2 GB 时）"
MEM_MB=$(free -m | awk '/^Mem:/{print $2}')
if [ "$MEM_MB" -lt 2000 ] && [ ! -f /swapfile ]; then
  dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "已加 2G swap（内存 ${MEM_MB}Mi）"
else
  echo "跳过（内存 ${MEM_MB}Mi，或 swap 已存在）"
fi

step "2. 专用用户与目录"
id catan >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin catan
mkdir -p "$APP_DIR" /var/log/catan
chown -R catan:catan "$APP_DIR" /var/log/catan

step "3. 取代码"
if [ -d "$APP_DIR/.git" ]; then
  sudo -u catan git -C "$APP_DIR" pull --ff-only
else
  sudo -u catan git clone "$REPO" "$APP_DIR"
fi
sudo -u catan git -C "$APP_DIR" log --oneline -1

step "4. 构建"
# HOME 不能省：corepack 和 pnpm 要往 $HOME 写缓存，默认会去写调用者的家目录
cd "$APP_DIR"
sudo -u catan env HOME="$APP_DIR" pnpm install --frozen-lockfile
sudo -u catan env HOME="$APP_DIR" pnpm build

step "5. 服务与反代"
cp "$APP_DIR/deploy/catan.service" /etc/systemd/system/catan.service
systemctl daemon-reload
systemctl enable --now catan
systemctl restart catan

cp "$APP_DIR/deploy/Caddyfile" /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl enable --now caddy
systemctl reload caddy || systemctl restart caddy

step "验证"
sleep 3
systemctl is-enabled catan caddy
systemctl is-active catan caddy
curl -fsS http://127.0.0.1:8787/health && echo
curl -s -o /dev/null -w "首页 http=%{http_code}\n" http://127.0.0.1/
journalctl -u catan -n 3 --no-pager -o cat
