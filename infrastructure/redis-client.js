/**
 * Redis クライアント
 *
 * セッション管理とクエリキャッシュの実装例
 *
 * 使用方法:
 *   const { sessionStore, queryCache, redisClient } = require('./infrastructure/redis-client');
 */

const redis = require('redis');
const { promisify } = require('util');

// ==================== Redis接続設定 ====================

// セキュリティチェック: パスワードが設定されていない場合は警告
if (!process.env.REDIS_PASSWORD) {
  console.warn('⚠️  警告: REDIS_PASSWORD環境変数が設定されていません');
  console.warn('⚠️  本番環境では必ずパスワードを設定してください');
}

const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD, // 環境変数から取得（デフォルトなし）
  db: 0, // デフォルトDB
  retry_strategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      console.error('❌ Redis接続拒否:', options.error.message);
      return new Error('Redis接続拒否');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      console.error('❌ Redisリトライタイムアウト');
      return new Error('Redisリトライタイムアウト');
    }
    if (options.attempt > 10) {
      console.error('❌ Redisリトライ回数超過');
      return undefined;
    }
    // 再接続を試みる（指数バックオフ）
    return Math.min(options.attempt * 100, 3000);
  }
};

// ==================== Redisクライアント作成 ====================

const redisClient = redis.createClient(REDIS_CONFIG);

redisClient.on('connect', () => {
  console.log('✅ Redis接続成功');
});

redisClient.on('error', (err) => {
  console.error('❌ Redisエラー:', err.message);
});

redisClient.on('reconnecting', () => {
  console.log('🔄 Redis再接続中...');
});

// Promisify（async/await対応）
const getAsync = promisify(redisClient.get).bind(redisClient);
const setAsync = promisify(redisClient.set).bind(redisClient);
const delAsync = promisify(redisClient.del).bind(redisClient);
const existsAsync = promisify(redisClient.exists).bind(redisClient);
const expireAsync = promisify(redisClient.expire).bind(redisClient);
const ttlAsync = promisify(redisClient.ttl).bind(redisClient);
const keysAsync = promisify(redisClient.keys).bind(redisClient);

// ==================== セッションストア ====================

/**
 * セッション管理クラス
 * DB 0を使用
 */
class SessionStore {
  constructor() {
    this.prefix = 'session:';
    this.defaultTTL = 3600; // 1時間
  }

  /**
   * セッションキーを生成
   */
  _getKey(sessionId) {
    return `${this.prefix}${sessionId}`;
  }

  /**
   * セッションを保存
   * @param {string} sessionId - セッションID
   * @param {object} data - セッションデータ
   * @param {number} ttl - 有効期限（秒）
   */
  async set(sessionId, data, ttl = this.defaultTTL) {
    try {
      const key = this._getKey(sessionId);
      const value = JSON.stringify(data);
      await setAsync(key, value, 'EX', ttl);
      console.log(`✅ セッション保存: ${sessionId} (TTL: ${ttl}秒)`);
      return true;
    } catch (error) {
      console.error('❌ セッション保存エラー:', error.message);
      return false;
    }
  }

  /**
   * セッションを取得
   * @param {string} sessionId - セッションID
   * @returns {object|null} セッションデータ
   */
  async get(sessionId) {
    try {
      const key = this._getKey(sessionId);
      const value = await getAsync(key);
      if (!value) {
        console.log(`⚠️ セッションが見つかりません: ${sessionId}`);
        return null;
      }
      return JSON.parse(value);
    } catch (error) {
      console.error('❌ セッション取得エラー:', error.message);
      return null;
    }
  }

  /**
   * セッションを削除（ログアウト）
   * @param {string} sessionId - セッションID
   */
  async destroy(sessionId) {
    try {
      const key = this._getKey(sessionId);
      const deleted = await delAsync(key);
      console.log(`✅ セッション削除: ${sessionId}`);
      return deleted > 0;
    } catch (error) {
      console.error('❌ セッション削除エラー:', error.message);
      return false;
    }
  }

  /**
   * セッションの有効期限を延長
   * @param {string} sessionId - セッションID
   * @param {number} ttl - 新しい有効期限（秒）
   */
  async refresh(sessionId, ttl = this.defaultTTL) {
    try {
      const key = this._getKey(sessionId);
      const exists = await existsAsync(key);
      if (!exists) {
        console.log(`⚠️ セッションが存在しません: ${sessionId}`);
        return false;
      }
      await expireAsync(key, ttl);
      console.log(`✅ セッション延長: ${sessionId} (TTL: ${ttl}秒)`);
      return true;
    } catch (error) {
      console.error('❌ セッション延長エラー:', error.message);
      return false;
    }
  }

  /**
   * 全セッションをクリア（管理用）
   */
  async clear() {
    try {
      const keys = await keysAsync(`${this.prefix}*`);
      if (keys.length > 0) {
        await delAsync(...keys);
        console.log(`✅ ${keys.length}件のセッションをクリアしました`);
      }
      return keys.length;
    } catch (error) {
      console.error('❌ セッションクリアエラー:', error.message);
      return 0;
    }
  }
}

// ==================== クエリキャッシュ ====================

/**
 * クエリキャッシュクラス
 * DB 1を使用
 */
class QueryCache {
  constructor() {
    this.prefix = 'cache:query:';
    this.defaultTTL = 300; // 5分

    // DB 1に切り替え
    this.client = redis.createClient({ ...REDIS_CONFIG, db: 1 });
    this.getAsync = promisify(this.client.get).bind(this.client);
    this.setAsync = promisify(this.client.set).bind(this.client);
    this.delAsync = promisify(this.client.del).bind(this.client);
    this.keysAsync = promisify(this.client.keys).bind(this.client);
  }

  /**
   * キャッシュキーを生成
   * @param {string} queryKey - クエリの一意識別子
   */
  _getKey(queryKey) {
    return `${this.prefix}${queryKey}`;
  }

  /**
   * キャッシュを保存
   * @param {string} queryKey - クエリキー
   * @param {any} data - キャッシュデータ
   * @param {number} ttl - 有効期限（秒）
   */
  async set(queryKey, data, ttl = this.defaultTTL) {
    try {
      const key = this._getKey(queryKey);
      const value = JSON.stringify(data);
      await this.setAsync(key, value, 'EX', ttl);
      console.log(`✅ クエリキャッシュ保存: ${queryKey} (TTL: ${ttl}秒)`);
      return true;
    } catch (error) {
      console.error('❌ クエリキャッシュ保存エラー:', error.message);
      return false;
    }
  }

  /**
   * キャッシュを取得
   * @param {string} queryKey - クエリキー
   * @returns {any|null} キャッシュデータ
   */
  async get(queryKey) {
    try {
      const key = this._getKey(queryKey);
      const value = await this.getAsync(key);
      if (!value) {
        console.log(`⚠️ キャッシュミス: ${queryKey}`);
        return null;
      }
      console.log(`✅ キャッシュヒット: ${queryKey}`);
      return JSON.parse(value);
    } catch (error) {
      console.error('❌ クエリキャッシュ取得エラー:', error.message);
      return null;
    }
  }

  /**
   * キャッシュを削除
   * @param {string} queryKey - クエリキー
   */
  async invalidate(queryKey) {
    try {
      const key = this._getKey(queryKey);
      const deleted = await this.delAsync(key);
      console.log(`✅ キャッシュ削除: ${queryKey}`);
      return deleted > 0;
    } catch (error) {
      console.error('❌ キャッシュ削除エラー:', error.message);
      return false;
    }
  }

  /**
   * パターンマッチでキャッシュを一括削除
   * @param {string} pattern - パターン（例: 'user:*'）
   */
  async invalidatePattern(pattern) {
    try {
      const keys = await this.keysAsync(`${this.prefix}${pattern}`);
      if (keys.length > 0) {
        await this.delAsync(...keys);
        console.log(`✅ ${keys.length}件のキャッシュを削除しました: ${pattern}`);
      }
      return keys.length;
    } catch (error) {
      console.error('❌ キャッシュパターン削除エラー:', error.message);
      return 0;
    }
  }

  /**
   * キャッシュ済みクエリ実行（Get or Set パターン）
   * @param {string} queryKey - クエリキー
   * @param {Function} queryFn - クエリ実行関数
   * @param {number} ttl - 有効期限（秒）
   */
  async getOrSet(queryKey, queryFn, ttl = this.defaultTTL) {
    try {
      // キャッシュを確認
      const cached = await this.get(queryKey);
      if (cached !== null) {
        return cached;
      }

      // キャッシュミス - クエリ実行
      console.log(`🔍 クエリ実行: ${queryKey}`);
      const result = await queryFn();

      // 結果をキャッシュ
      await this.set(queryKey, result, ttl);

      return result;
    } catch (error) {
      console.error('❌ キャッシュ済みクエリ実行エラー:', error.message);
      throw error;
    }
  }

  /**
   * 全キャッシュをクリア
   */
  async clear() {
    try {
      const keys = await this.keysAsync(`${this.prefix}*`);
      if (keys.length > 0) {
        await this.delAsync(...keys);
        console.log(`✅ ${keys.length}件のキャッシュをクリアしました`);
      }
      return keys.length;
    } catch (error) {
      console.error('❌ キャッシュクリアエラー:', error.message);
      return 0;
    }
  }
}

// ==================== インスタンス作成 ====================

const sessionStore = new SessionStore();
const queryCache = new QueryCache();

// ==================== エクスポート ====================

module.exports = {
  redisClient,
  sessionStore,
  queryCache,

  // ユーティリティ
  getAsync,
  setAsync,
  delAsync,
  existsAsync,
  expireAsync,
  ttlAsync,
  keysAsync
};
