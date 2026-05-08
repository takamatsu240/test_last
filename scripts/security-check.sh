#!/bin/bash

################################################################################
# セキュリティチェックスクリプト
#
# リポジトリ内の秘密情報や危険なパターンをチェックします
#
# 使用方法:
#   bash scripts/security-check.sh
################################################################################

set -e

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
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

ISSUES_FOUND=0

echo "========================================="
echo "セキュリティチェック開始"
echo "========================================="
echo ""

################################################################################
# 1. ハードコードされたパスワードのチェック
################################################################################

log_info "1. ハードコードされたパスワードをチェック中..."

# 危険なパターン
PATTERNS=(
    "password.*=.*['\"].*['\"]"
    "passwd.*=.*['\"].*['\"]"
    "apikey.*=.*['\"].*['\"]"
    "api_key.*=.*['\"].*['\"]"
    "secret.*=.*['\"].*['\"]"
    "token.*=.*['\"].*['\"]"
)

for pattern in "${PATTERNS[@]}"; do
    if git grep -iE "$pattern" -- ':!scripts/security-check.sh' ':!SECURITY.md' ':!*.example' ':!*.md' ':!node_modules' > /dev/null 2>&1; then
        log_error "ハードコードされた認証情報が見つかりました: $pattern"
        git grep -niE "$pattern" -- ':!scripts/security-check.sh' ':!SECURITY.md' ':!*.example' ':!*.md' ':!node_modules' | head -5
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
done

if [ $ISSUES_FOUND -eq 0 ]; then
    log_success "ハードコードされた認証情報は見つかりませんでした"
fi

################################################################################
# 2. .env ファイルのチェック
################################################################################

log_info "2. .env ファイルがコミットされていないかチェック中..."

if git ls-files | grep -E '^\.env$|^\.env\.local$|^\.env\.production$' > /dev/null 2>&1; then
    log_error ".env ファイルがコミットされています"
    git ls-files | grep -E '^\.env$|^\.env\.local$|^\.env\.production$'
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
    log_success ".env ファイルはコミットされていません"
fi

################################################################################
# 3. 認証情報ファイルのチェック
################################################################################

log_info "3. 認証情報ファイルがコミットされていないかチェック中..."

CREDENTIAL_PATTERNS=(
    "**/credentials.json"
    "**/*-key.json"
    "**/*.pem"
    "**/*.key"
    "**/service-account*.json"
)

for pattern in "${CREDENTIAL_PATTERNS[@]}"; do
    if git ls-files | grep -E "$(echo "$pattern" | sed 's/\*\*/.*/')" > /dev/null 2>&1; then
        log_error "認証情報ファイルがコミットされています: $pattern"
        git ls-files | grep -E "$(echo "$pattern" | sed 's/\*\*/.*/')"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
done

if [ $ISSUES_FOUND -eq 0 ]; then
    log_success "認証情報ファイルはコミットされていません"
fi

################################################################################
# 4. .gitignore の確認
################################################################################

log_info "4. .gitignore に必要なパターンが含まれているかチェック中..."

REQUIRED_IGNORES=(
    ".env"
    "*.log"
    "node_modules"
    "credentials.json"
)

MISSING_IGNORES=()

for ignore in "${REQUIRED_IGNORES[@]}"; do
    if ! grep -q "$ignore" .gitignore 2>/dev/null; then
        MISSING_IGNORES+=("$ignore")
    fi
done

if [ ${#MISSING_IGNORES[@]} -eq 0 ]; then
    log_success ".gitignore に必要なパターンが含まれています"
else
    log_warn ".gitignore に以下のパターンを追加することを推奨します:"
    for ignore in "${MISSING_IGNORES[@]}"; do
        echo "  - $ignore"
    done
fi

################################################################################
# 5. デフォルトパスワードのチェック
################################################################################

log_info "5. デフォルトパスワードが使用されていないかチェック中..."

DEFAULT_PASSWORDS=(
    "changeme"
    "password"
    "admin"
    "root"
    "123456"
)

for pwd in "${DEFAULT_PASSWORDS[@]}"; do
    if git grep -i "$pwd" -- ':!scripts/security-check.sh' ':!SECURITY.md' ':!*.example' ':!*.md' ':!node_modules' ':!firestore-client.js' > /dev/null 2>&1; then
        log_warn "デフォルトパスワードのような文字列が見つかりました: $pwd"
        git grep -ni "$pwd" -- ':!scripts/security-check.sh' ':!SECURITY.md' ':!*.example' ':!*.md' ':!node_modules' ':!firestore-client.js' | head -3
    fi
done

################################################################################
# 6. Firebase設定の確認
################################################################################

log_info "6. Firebase設定ファイルをチェック中..."

if [ -f "public/js/firebase-config.js" ]; then
    if grep -q "YOUR_API_KEY\|YOUR_SENDER_ID\|YOUR_APP_ID" public/js/firebase-config.js; then
        log_warn "Firebase設定がプレースホルダーのままです"
        log_info "本番環境では実際の値に置き換えてください"
    else
        log_success "Firebase設定が設定されています"
    fi
fi

################################################################################
# 7. npm audit
################################################################################

log_info "7. npm パッケージの脆弱性をチェック中..."

if [ -f "package.json" ]; then
    if command -v npm &> /dev/null; then
        if npm audit --audit-level=high > /dev/null 2>&1; then
            log_success "高リスクの脆弱性は見つかりませんでした"
        else
            log_warn "パッケージに脆弱性が見つかりました"
            log_info "詳細: npm audit"
        fi
    else
        log_warn "npm がインストールされていません（スキップ）"
    fi
fi

################################################################################
# サマリー
################################################################################

echo ""
echo "========================================="
echo "セキュリティチェック完了"
echo "========================================="
echo ""

if [ $ISSUES_FOUND -eq 0 ]; then
    log_success "重大な問題は見つかりませんでした"
    echo ""
    echo "✅ このリポジトリは基本的なセキュリティチェックをパスしました"
    exit 0
else
    log_error "$ISSUES_FOUND 個の問題が見つかりました"
    echo ""
    echo "⚠️  上記の問題を修正してからコミットしてください"
    echo ""
    echo "詳細: SECURITY.md を参照"
    exit 1
fi
