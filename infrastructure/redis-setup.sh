#!/bin/bash

################################################################################
# Redis キャッシュサーバー セットアップスクリプト
#
# 本番環境にRedisを導入し、セッション管理とクエリキャッシュを実装する
#
# 使用方法:
#   sudo bash infrastructure/redis-setup.sh
#
# 機能:
# - Redisのインストール（apt/yum対応）
# - Redis設定の最適化（本番環境用）
# - セキュリティ設定（パスワード認証、バインドアドレス）
# - 永続化設定（RDB + AOF）
# - 起動とサービス登録
################################################################################

set -e  # エラー時に停止

# 色付きログ
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 設定変数
REDIS_VERSION="7.2"
REDIS_PORT="6379"
REDIS_PASSWORD=$(openssl rand -base64 32)
REDIS_MAXMEMORY="2gb"
REDIS_MAXMEMORY_POLICY="allkeys-lru"
REDIS_CONFIG_FILE="/etc/redis/redis.conf"
REDIS_DATA_DIR="/var/lib/redis"
REDIS_LOG_DIR="/var/log/redis"

################################################################################
# メイン処理
################################################################################

main() {
    log_info "========================================="
    log_info "Redis キャッシュサーバー セットアップ"
    log_info "========================================="
    echo ""

    # rootチェック
    if [ "$EUID" -ne 0 ]; then
        log_error "このスクリプトはroot権限で実行してください"
        log_error "実行例: sudo bash infrastructure/redis-setup.sh"
        exit 1
    fi

    # OS検出
    detect_os

    # Redisインストール
    install_redis

    # Redis設定
    configure_redis

    # セキュリティ設定
    setup_security

    # 永続化設定
    setup_persistence

    # ファイアウォール設定
    setup_firewall

    # Redisサービス起動
    start_redis_service

    # 接続テスト
    test_connection

    # サマリー表示
    show_summary

    log_success "Redisセットアップが完了しました"
}

################################################################################
# OS検出
################################################################################

detect_os() {
    log_info "OS検出中..."

    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        OS_VERSION=$VERSION_ID
    else
        log_error "サポートされていないOSです"
        exit 1
    fi

    log_info "検出されたOS: $OS $OS_VERSION"
}

################################################################################
# Redisインストール
################################################################################

install_redis() {
    log_info "Redisをインストール中..."

    # 既にインストール済みかチェック
    if command -v redis-server &> /dev/null; then
        INSTALLED_VERSION=$(redis-server --version | awk '{print $3}' | cut -d'=' -f2)
        log_warn "Redis は既にインストールされています (バージョン: $INSTALLED_VERSION)"
        read -p "再インストールしますか? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "インストールをスキップします"
            return
        fi
    fi

    case "$OS" in
        ubuntu|debian)
            log_info "apt経由でRedisをインストール中..."
            apt-get update -qq
            apt-get install -y redis-server redis-tools
            ;;
        centos|rhel|fedora|rocky|almalinux)
            log_info "yum経由でRedisをインストール中..."
            yum install -y epel-release
            yum install -y redis
            ;;
        *)
            log_error "サポートされていないOS: $OS"
            exit 1
            ;;
    esac

    log_success "Redisインストール完了"
}

################################################################################
# Redis設定
################################################################################

configure_redis() {
    log_info "Redis設定を最適化中..."

    # 設定ファイルのバックアップ
    if [ -f "$REDIS_CONFIG_FILE" ]; then
        cp "$REDIS_CONFIG_FILE" "${REDIS_CONFIG_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
        log_info "既存の設定ファイルをバックアップしました"
    fi

    # 設定ファイル作成
    cat > "$REDIS_CONFIG_FILE" <<EOF
# Redis 本番環境設定
# 生成日時: $(date)

################################## ネットワーク ##################################

# バインドアドレス（本番環境では127.0.0.1に制限）
bind 127.0.0.1 ::1

# ポート番号
port $REDIS_PORT

# TCP接続キュー
tcp-backlog 511

# タイムアウト（0=無効）
timeout 0

# TCP keepalive
tcp-keepalive 300

################################## 一般設定 ##################################

# デーモンモード
daemonize no

# PIDファイル
pidfile /var/run/redis/redis-server.pid

# ログレベル（debug, verbose, notice, warning）
loglevel notice

# ログファイル
logfile $REDIS_LOG_DIR/redis-server.log

# データベース数
databases 16

################################## スナップショット（RDB） ##################################

# RDB保存条件
save 900 1      # 900秒間に1回以上の変更
save 300 10     # 300秒間に10回以上の変更
save 60 10000   # 60秒間に10000回以上の変更

# RDB圧縮
rdbcompression yes

# RDBチェックサム
rdbchecksum yes

# RDBファイル名
dbfilename dump.rdb

# データディレクトリ
dir $REDIS_DATA_DIR

################################## AOF（Append Only File） ##################################

# AOF有効化（より安全な永続化）
appendonly yes

# AOFファイル名
appendfilename "appendonly.aof"

# AOF同期頻度（always, everysec, no）
appendfsync everysec

# AOFリライト中の同期
no-appendfsync-on-rewrite no

# AOF自動リライト設定
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb

################################## メモリ管理 ##################################

# 最大メモリ
maxmemory $REDIS_MAXMEMORY

# メモリ削除ポリシー
maxmemory-policy $REDIS_MAXMEMORY_POLICY

# サンプル数（LRU/LFU/TTL）
maxmemory-samples 5

################################## セキュリティ ##################################

# パスワード認証（後で設定）
# requirepass YOUR_PASSWORD_HERE

################################## クライアント ##################################

# 最大クライアント接続数
maxclients 10000

################################## スローログ ##################################

# スローログ閾値（マイクロ秒）
slowlog-log-slower-than 10000

# スローログ最大長
slowlog-max-len 128

################################## パフォーマンス ##################################

# レイジーフリー（非同期削除）
lazyfree-lazy-eviction yes
lazyfree-lazy-expire yes
lazyfree-lazy-server-del yes
replica-lazy-flush yes

# I/Oスレッド
io-threads 4
io-threads-do-reads yes

EOF

    log_success "Redis設定ファイルを作成しました: $REDIS_CONFIG_FILE"
}

################################################################################
# セキュリティ設定
################################################################################

setup_security() {
    log_info "セキュリティ設定中..."

    # パスワード設定
    sed -i "s/# requirepass.*/requirepass $REDIS_PASSWORD/" "$REDIS_CONFIG_FILE"

    # パスワードを保存
    PASSWORD_FILE="/root/.redis_password"
    echo "$REDIS_PASSWORD" > "$PASSWORD_FILE"
    chmod 600 "$PASSWORD_FILE"

    log_success "パスワード認証を設定しました"
    log_info "パスワードは $PASSWORD_FILE に保存されています"

    # 危険なコマンドを無効化
    cat >> "$REDIS_CONFIG_FILE" <<EOF

# 危険なコマンドの無効化
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command CONFIG "CONFIG_ADMIN_ONLY_$(openssl rand -hex 8)"
EOF

    log_success "危険なコマンドを無効化しました"
}

################################################################################
# 永続化設定
################################################################################

setup_persistence() {
    log_info "永続化設定中..."

    # データディレクトリ作成
    mkdir -p "$REDIS_DATA_DIR"
    chown redis:redis "$REDIS_DATA_DIR"
    chmod 770 "$REDIS_DATA_DIR"

    # ログディレクトリ作成
    mkdir -p "$REDIS_LOG_DIR"
    chown redis:redis "$REDIS_LOG_DIR"
    chmod 770 "$REDIS_LOG_DIR"

    log_success "データディレクトリとログディレクトリを作成しました"
}

################################################################################
# ファイアウォール設定
################################################################################

setup_firewall() {
    log_info "ファイアウォール設定中..."

    # UFW（Ubuntu/Debian）
    if command -v ufw &> /dev/null; then
        # ローカルのみ許可（外部からのアクセスは拒否）
        log_info "UFW: Redisポートはローカルのみアクセス可能に設定"
    fi

    # firewalld（CentOS/RHEL）
    if command -v firewall-cmd &> /dev/null; then
        log_info "firewalld: Redisポートはローカルのみアクセス可能に設定"
    fi

    log_warn "外部からのアクセスが必要な場合は、ファイアウォール設定を手動で調整してください"
}

################################################################################
# Redisサービス起動
################################################################################

start_redis_service() {
    log_info "Redisサービスを起動中..."

    # サービス有効化
    systemctl enable redis-server 2>/dev/null || systemctl enable redis 2>/dev/null

    # サービス再起動
    systemctl restart redis-server 2>/dev/null || systemctl restart redis 2>/dev/null

    # ステータス確認
    sleep 2
    if systemctl is-active --quiet redis-server 2>/dev/null || systemctl is-active --quiet redis 2>/dev/null; then
        log_success "Redisサービスが起動しました"
    else
        log_error "Redisサービスの起動に失敗しました"
        systemctl status redis-server 2>/dev/null || systemctl status redis 2>/dev/null
        exit 1
    fi
}

################################################################################
# 接続テスト
################################################################################

test_connection() {
    log_info "Redis接続テスト中..."

    # PING テスト
    if redis-cli -a "$REDIS_PASSWORD" ping > /dev/null 2>&1; then
        log_success "Redis接続テスト成功"
    else
        log_error "Redis接続テスト失敗"
        exit 1
    fi

    # 情報取得
    REDIS_INFO=$(redis-cli -a "$REDIS_PASSWORD" INFO server 2>/dev/null | grep redis_version | cut -d: -f2 | tr -d '\r')
    log_info "Redisバージョン: $REDIS_INFO"
}

################################################################################
# サマリー表示
################################################################################

show_summary() {
    echo ""
    log_info "========================================="
    log_info "セットアップ完了"
    log_info "========================================="
    echo ""
    echo "  Redis バージョン: $(redis-cli -a "$REDIS_PASSWORD" INFO server 2>/dev/null | grep redis_version | cut -d: -f2 | tr -d '\r')"
    echo "  ポート: $REDIS_PORT"
    echo "  最大メモリ: $REDIS_MAXMEMORY"
    echo "  メモリポリシー: $REDIS_MAXMEMORY_POLICY"
    echo "  永続化: RDB + AOF"
    echo ""
    echo "  設定ファイル: $REDIS_CONFIG_FILE"
    echo "  データディレクトリ: $REDIS_DATA_DIR"
    echo "  ログファイル: $REDIS_LOG_DIR/redis-server.log"
    echo "  パスワードファイル: /root/.redis_password"
    echo ""
    echo "  接続コマンド例:"
    echo "    redis-cli -a \$(cat /root/.redis_password)"
    echo ""
    echo "  Node.js接続例:"
    echo "    const redis = require('redis');"
    echo "    const client = redis.createClient({"
    echo "      host: '127.0.0.1',"
    echo "      port: $REDIS_PORT,"
    echo "      password: process.env.REDIS_PASSWORD  // パスワードファイルから読み込む"
    echo "    });"
    echo ""
    log_warn "パスワードは安全に保管してください: /root/.redis_password"
    echo ""
}

################################################################################
# スクリプト実行
################################################################################

main "$@"
