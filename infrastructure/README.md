# Redis キャッシュサーバー構築

本番環境にRedisを導入し、セッション管理とクエリキャッシュを実装します。

## 目次

- [概要](#概要)
- [セットアップ方法](#セットアップ方法)
- [使用方法](#使用方法)
- [アーキテクチャ](#アーキテクチャ)
- [パフォーマンス最適化](#パフォーマンス最適化)
- [トラブルシューティング](#トラブルシューティング)

## 概要

### 導入するコンポーネント

1. **Redisサーバー** - インメモリキャッシュサーバー
2. **セッションストア** - ユーザーセッション管理
3. **クエリキャッシュ** - Firestoreクエリのキャッシュ

### 期待される効果

- **レスポンス時間**: 50-90%削減
- **Firestore読み取り回数**: 70-90%削減
- **同時接続数**: 3-5倍向上

## セットアップ方法

### 方法1: 自動セットアップスクリプト（推奨）

Ubuntu/Debian/CentOS/RHELに対応した自動セットアップスクリプトを提供しています。

```bash
# スクリプトを実行
sudo bash infrastructure/redis-setup.sh
```

スクリプトは以下を自動実行します：
- Redisのインストール
- 本番環境用の設定最適化
- セキュリティ設定（パスワード認証）
- 永続化設定（RDB + AOF）
- サービス起動と自動起動設定

セットアップ完了後、パスワードが `/root/.redis_password` に保存されます。

### 方法2: Docker Compose

Dockerを使用して簡単に起動できます。

```bash
# 環境変数を設定
cp infrastructure/.env.redis.example .env
# .env ファイルを編集してパスワードを設定

# Redisを起動
docker-compose -f infrastructure/docker-compose.redis.yml up -d

# ログ確認
docker-compose -f infrastructure/docker-compose.redis.yml logs -f redis

# Redis Commander（管理ツール）にアクセス
# http://localhost:8081
```

### 方法3: 手動インストール

#### Ubuntu/Debian

```bash
sudo apt-get update
sudo apt-get install -y redis-server redis-tools

# 設定ファイルをコピー
sudo cp infrastructure/redis.conf /etc/redis/redis.conf

# パスワードを設定
sudo sed -i 's/# requirepass.*/requirepass YOUR_PASSWORD/' /etc/redis/redis.conf

# 再起動
sudo systemctl restart redis-server
sudo systemctl enable redis-server
```

#### CentOS/RHEL

```bash
sudo yum install -y epel-release
sudo yum install -y redis

# 設定ファイルをコピー
sudo cp infrastructure/redis.conf /etc/redis.conf

# パスワードを設定
sudo sed -i 's/# requirepass.*/requirepass YOUR_PASSWORD/' /etc/redis.conf

# 再起動
sudo systemctl restart redis
sudo systemctl enable redis
```

## 使用方法

### 1. Node.js依存関係のインストール

```bash
npm install redis --save
```

### 2. 環境変数の設定

`.env` ファイルにRedis接続情報を追加：

```env
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password_here
```

### 3. アプリケーションでの使用

#### セッション管理

```javascript
const { sessionStore } = require('./infrastructure/redis-client');

// ログイン時: セッション作成
await sessionStore.set('session-id-12345', {
  userId: 'user-001',
  username: '馬場',
  role: 'admin',
  loginAt: new Date().toISOString()
}, 3600); // 1時間有効

// リクエスト時: セッション取得
const session = await sessionStore.get('session-id-12345');
if (session) {
  console.log('ユーザー:', session.username);
}

// ログアウト時: セッション削除
await sessionStore.destroy('session-id-12345');
```

#### クエリキャッシュ

```javascript
const { queryCache } = require('./infrastructure/redis-client');
const { firestore, COLLECTIONS } = require('./firestore-client');

// 課題一覧を取得（キャッシュ対応）
async function getOpenIssues(projectId) {
  const cacheKey = `issues:open:${projectId}`;

  return await queryCache.getOrSet(
    cacheKey,
    async () => {
      // キャッシュミス時のみFirestoreにアクセス
      const snapshot = await firestore
        .collection(COLLECTIONS.ISSUES)
        .where('projectId', '==', projectId)
        .get();

      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    600 // 10分間キャッシュ
  );
}

// データ更新時: キャッシュ無効化
async function updateIssue(issueNo, updates) {
  await firestore.collection(COLLECTIONS.ISSUES).doc(issueNo).update(updates);

  // 関連するキャッシュを削除
  await queryCache.invalidatePattern('issues:*');
}
```

### 4. 動作確認

```bash
# サンプルスクリプトを実行
node infrastructure/redis-example.js
```

## アーキテクチャ

### データベース構成

Redisは16個のデータベース（DB 0-15）を使用できます。

| DB番号 | 用途 | 説明 |
|--------|------|------|
| DB 0 | セッションストア | ユーザーセッション管理 |
| DB 1 | クエリキャッシュ | Firestoreクエリのキャッシュ |
| DB 2 | アプリケーションキャッシュ | 汎用キャッシュ |
| DB 3-15 | 予約 | 将来の拡張用 |

### キャッシュ戦略

#### 1. セッションストア

- **TTL**: 1時間（デフォルト）
- **延長**: アクティビティごとに自動延長
- **削除**: ログアウト時に即削除

#### 2. クエリキャッシュ

- **TTL**: 5-10分（クエリ種類による）
- **無効化**: データ更新時に関連キャッシュを削除
- **パターン**: `Get or Set` パターンを使用

### メモリ管理

- **最大メモリ**: 2GB
- **削除ポリシー**: `allkeys-lru`（全キーからLRUで削除）
- **永続化**: RDB + AOF（データ損失を防ぐ）

## パフォーマンス最適化

### 1. 接続プーリング

本番環境では接続プールを使用することを推奨します：

```javascript
const redis = require('redis');
const { createClient } = redis;

const pool = createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  max: 10,        // 最大接続数
  min: 2,         // 最小接続数
  idleTimeout: 30000
});
```

### 2. パイプライン

複数のコマンドを一度に実行：

```javascript
const pipeline = redisClient.pipeline();
pipeline.set('key1', 'value1');
pipeline.set('key2', 'value2');
pipeline.get('key1');
await pipeline.exec();
```

### 3. キャッシュウォーミング

アプリケーション起動時に頻繁に使用するデータを事前キャッシュ：

```javascript
async function warmupCache() {
  const projects = await fetchAllProjects();
  for (const project of projects) {
    await queryCache.set(`project:${project.id}`, project, 3600);
  }
}
```

## トラブルシューティング

### Redis接続エラー

```bash
# Redisが起動しているか確認
sudo systemctl status redis-server

# Redisログを確認
sudo tail -f /var/log/redis/redis-server.log

# 接続テスト
redis-cli -a $(cat /root/.redis_password) ping
```

### メモリ使用量の確認

```bash
# メモリ使用状況
redis-cli -a YOUR_PASSWORD INFO memory

# キー数の確認
redis-cli -a YOUR_PASSWORD DBSIZE

# 最大メモリに達した場合
redis-cli -a YOUR_PASSWORD CONFIG SET maxmemory 4gb
```

### パフォーマンスモニタリング

```bash
# スローログ確認
redis-cli -a YOUR_PASSWORD SLOWLOG GET 10

# リアルタイムモニタリング
redis-cli -a YOUR_PASSWORD --stat

# コマンド統計
redis-cli -a YOUR_PASSWORD INFO stats
```

### キャッシュのクリア

```bash
# 特定のDBをクリア
redis-cli -a YOUR_PASSWORD -n 0 FLUSHDB

# 全DBをクリア（注意！）
redis-cli -a YOUR_PASSWORD FLUSHALL
```

## セキュリティ

### 本番環境のセキュリティ対策

1. **強力なパスワード**: 32文字以上のランダム文字列
2. **バインドアドレス**: `127.0.0.1`に制限（外部アクセス不可）
3. **ファイアウォール**: 外部からのポート6379アクセスをブロック
4. **危険なコマンド無効化**: `FLUSHALL`, `FLUSHDB`, `CONFIG`など
5. **TLS/SSL**: 暗号化通信（必要に応じて）

### パスワードローテーション

```bash
# 新しいパスワードを設定
redis-cli -a OLD_PASSWORD CONFIG SET requirepass NEW_PASSWORD

# 設定ファイルを更新
sudo sed -i 's/requirepass OLD_PASSWORD/requirepass NEW_PASSWORD/' /etc/redis/redis.conf

# 再起動
sudo systemctl restart redis-server
```

## 関連ファイル

| ファイル | 説明 |
|---------|------|
| `redis-setup.sh` | 自動セットアップスクリプト |
| `redis.conf` | Redis設定ファイル |
| `docker-compose.redis.yml` | Docker Compose設定 |
| `redis-client.js` | Redisクライアント（セッション・キャッシュ） |
| `redis-example.js` | 使用例デモスクリプト |
| `.env.redis.example` | 環境変数サンプル |

## 参考資料

- [Redis公式ドキュメント](https://redis.io/documentation)
- [Redis Best Practices](https://redis.io/topics/best-practices)
- [Node.js Redis Client](https://github.com/redis/node-redis)

## ライセンス

UNLICENSED

## 作成者

Tecnos Japan - インフラチーム
