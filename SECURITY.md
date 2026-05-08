# セキュリティガイドライン

このドキュメントでは、タスク管理システムのセキュリティに関するベストプラクティスを説明します。

## 📋 目次

- [環境変数の管理](#環境変数の管理)
- [認証情報の保護](#認証情報の保護)
- [Redis セキュリティ](#redis-セキュリティ)
- [Firebase セキュリティ](#firebase-セキュリティ)
- [GitHub Actions セキュリティ](#github-actions-セキュリティ)
- [脆弱性報告](#脆弱性報告)

## 🔐 環境変数の管理

### ❌ やってはいけないこと

```javascript
// ❌ ハードコードされた認証情報（絶対に避ける）
const password = "[EXAMPLE_DO_NOT_USE]";  // 実際の値を直接書かない
const apiKey = "sk-*********************";  // APIキーをコードに含めない

// ❌ 設定ファイルに認証情報を直接記載
const firebaseConfig = {
  apiKey: "AIza***************",  // これは危険
  // ...
};
```

### ✅ 推奨される方法

```javascript
// ✅ 環境変数から取得
const password = process.env.REDIS_PASSWORD;
const apiKey = process.env.OPENAI_API_KEY;

// ✅ 必須チェック
if (!process.env.REDIS_PASSWORD) {
  throw new Error('REDIS_PASSWORD environment variable is required');
}
```

### .env ファイルの管理

1. **`.env.example` を提供する**
   ```bash
   # .env.example
   REDIS_PASSWORD=REPLACE_WITH_YOUR_PASSWORD
   OPENAI_API_KEY=REPLACE_WITH_YOUR_API_KEY
   ```

2. **`.env` は .gitignore に追加**
   ```bash
   # .gitignore
   .env
   .env.local
   .env.*.local
   ```

3. **強力なパスワードを生成**
   ```bash
   # ランダムパスワード生成
   openssl rand -base64 32
   
   # 結果例（これをコピーして使用）
   9K7xZpL2vQ8mN3fR6wT1yH4jB5nC8aE0pD=
   ```

## 🔑 認証情報の保護

### Firebaseサービスアカウント

```bash
# ✅ 環境変数として設定（GitHub Secrets）
export FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'

# ❌ ファイルをコミット
# credentials.json をリポジトリに含めない
```

### .gitignore に追加すべきファイル

```gitignore
# 認証情報
**/credentials.json
**/*-key.json
**/*.pem
**/*.key
**/service-account*.json

# 環境変数
.env
.env.local
.env.production

# Redis
.redis_password
*.rdb
*.aof
```

## 🔒 Redis セキュリティ

### 必須設定

1. **パスワード認証を有効化**
   ```bash
   # redis.conf
   requirepass YOUR_STRONG_PASSWORD_HERE
   ```

2. **ローカルバインドのみ許可**
   ```bash
   # redis.conf
   bind 127.0.0.1 ::1
   ```

3. **危険なコマンドを無効化**
   ```bash
   # redis.conf
   rename-command FLUSHDB ""
   rename-command FLUSHALL ""
   rename-command CONFIG ""
   ```

4. **ファイアウォール設定**
   ```bash
   # UFW (Ubuntu)
   sudo ufw deny 6379/tcp
   
   # iptables
   sudo iptables -A INPUT -p tcp --dport 6379 -s 127.0.0.1 -j ACCEPT
   sudo iptables -A INPUT -p tcp --dport 6379 -j DROP
   ```

### Docker使用時の注意

```yaml
# ✅ ローカルホストのみバインド
ports:
  - "127.0.0.1:6379:6379"

# ❌ 全インターフェースに公開しない
# ports:
#   - "6379:6379"

# ✅ 環境変数必須
command: >
  redis-server
  --requirepass ${REDIS_PASSWORD:?REDIS_PASSWORD is required}

# ❌ デフォルトパスワードを使用しない
# --requirepass changeme
```

## 🔥 Firebase セキュリティ

### Firestore セキュリティルール

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ✅ 認証済みユーザーのみ読み取り可能
    match /issues/{issueId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null 
                   && request.auth.token.role == 'admin';
    }
    
    // ❌ 全公開は避ける
    // allow read, write: if true;
  }
}
```

### Firebase設定の公開について

Firebase Web APIキーは公開情報です：

```javascript
// ⚠️ Firebase Web APIキーは公開されても問題ありません
// セキュリティはFirestoreルールで制御します
const firebaseConfig = {
  apiKey: "AIza***[省略]***",  // 公開OK（ただし省略して表示）
  authDomain: "your-project.firebaseapp.com",  // 公開OK
  projectId: "your-project-id",  // 公開OK
};
```

**重要**: セキュリティは**Firestoreセキュリティルール**で制御してください。

### サービスアカウントキー

```bash
# ✅ GitHub Secretsに保存
# Settings > Secrets > Actions > New repository secret

# ❌ リポジトリにコミットしない
# ❌ 公開チャンネルに投稿しない
# ❌ ログに出力しない
```

## 🛡️ GitHub Actions セキュリティ

### Secrets の使用

```yaml
# ✅ GitHub Secrets を使用
- name: Run script
  env:
    FIREBASE_SERVICE_ACCOUNT_KEY: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_KEY }}
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  run: node scripts/analyze-minutes.js

# ❌ ハードコードしない
# env:
#   OPENAI_API_KEY: sk-1234567890
```

### Secrets の設定方法

1. GitHubリポジトリを開く
2. **Settings** → **Secrets and variables** → **Actions**
3. **New repository secret** をクリック
4. 名前と値を入力して保存

### 必要な Secrets

| Secret名 | 説明 | 必須 |
|---------|------|------|
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Firebaseサービスアカウント（JSON） | ✅ |
| `OPENAI_API_KEY` | OpenAI APIキー | ✅ |
| `GCP_PROJECT_ID` | GCPプロジェクトID | ✅ |
| `REDIS_PASSWORD` | Redis パスワード | ⚪ |

### ログへの秘密情報の漏洩防止

```yaml
# ✅ パスワードをマスク
- name: Setup
  run: |
    echo "::add-mask::$REDIS_PASSWORD"
    
# ❌ 秘密情報をログに出力しない
# run: echo "Password is $REDIS_PASSWORD"
```

## 🐛 脆弱性報告

### セキュリティ問題を発見した場合

1. **公開しないでください** - Issueやプルリクエストで報告しない
2. **連絡先**: セキュリティチームに直接連絡
3. **詳細を提供**: 再現手順、影響範囲、推奨される修正方法

### 対応プロセス

1. 報告受理（24時間以内）
2. 影響範囲の調査（48時間以内）
3. 修正パッチの作成
4. 修正版のリリース
5. 脆弱性の公開（修正後）

## 📚 追加リソース

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Firebase Security Best Practices](https://firebase.google.com/docs/rules/basics)
- [Redis Security](https://redis.io/topics/security)
- [GitHub Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)

## ✅ セキュリティチェックリスト

本番環境デプロイ前に以下を確認してください：

- [ ] `.env` ファイルが `.gitignore` に含まれている
- [ ] ハードコードされた認証情報がない
- [ ] Redisにパスワード認証が設定されている
- [ ] Redisがローカルホストのみバインドされている
- [ ] Firestoreセキュリティルールが設定されている
- [ ] GitHub Secretsにすべての認証情報が登録されている
- [ ] サービスアカウントキーがリポジトリにコミットされていない
- [ ] 強力なパスワード（32文字以上）を使用している
- [ ] ファイアウォールが適切に設定されている
- [ ] ログに秘密情報が出力されていない

---

**最終更新**: 2026-05-08  
**担当**: Tecnos Japan セキュリティチーム
