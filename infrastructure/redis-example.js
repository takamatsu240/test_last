#!/usr/bin/env node

/**
 * Redis使用例
 *
 * セッション管理とクエリキャッシュの実装サンプル
 *
 * 実行方法:
 *   node infrastructure/redis-example.js
 */

require('dotenv').config();
const { sessionStore, queryCache, redisClient } = require('./redis-client');
const { firestore, COLLECTIONS } = require('../firestore-client');

// ==================== セッション管理の例 ====================

async function sessionExample() {
  console.log('\n========================================');
  console.log('セッション管理の例');
  console.log('========================================\n');

  const sessionId = 'user-session-12345';
  const userId = 'user-001';

  // セッション作成（ログイン時）
  console.log('1. ログイン時: セッション作成');
  await sessionStore.set(sessionId, {
    userId: userId,
    username: '馬場',
    email: 'baba@example.com',
    role: 'admin',
    loginAt: new Date().toISOString()
  }, 3600); // 1時間有効

  // セッション取得（リクエスト時）
  console.log('\n2. リクエスト時: セッション取得');
  const session = await sessionStore.get(sessionId);
  if (session) {
    console.log('   ユーザー情報:', session);
  }

  // セッション延長（アクティビティ時）
  console.log('\n3. アクティビティ時: セッション延長');
  await sessionStore.refresh(sessionId, 7200); // 2時間に延長

  // セッション削除（ログアウト時）
  console.log('\n4. ログアウト時: セッション削除');
  await sessionStore.destroy(sessionId);

  console.log('\n✅ セッション管理の例が完了しました\n');
}

// ==================== クエリキャッシュの例 ====================

async function queryCacheExample() {
  console.log('\n========================================');
  console.log('クエリキャッシュの例');
  console.log('========================================\n');

  // 例1: Firestore クエリのキャッシュ
  console.log('1. Firestoreクエリのキャッシュ');

  const projectId = 'project-001';
  const cacheKey = `issues:project:${projectId}`;

  // クエリ実行関数
  const fetchIssues = async () => {
    console.log('   🔍 Firestoreからデータを取得中...');
    const snapshot = await firestore.collection(COLLECTIONS.ISSUES)
      .where('projectId', '==', projectId)
      .limit(10)
      .get();

    const issues = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return issues;
  };

  // キャッシュ済みクエリ実行（Get or Set パターン）
  console.time('   初回実行時間');
  const issues1 = await queryCache.getOrSet(cacheKey, fetchIssues, 300);
  console.timeEnd('   初回実行時間');
  console.log(`   取得件数: ${issues1.length}件`);

  // 2回目はキャッシュヒット
  console.log('\n2. 2回目の実行（キャッシュヒット）');
  console.time('   2回目実行時間');
  const issues2 = await queryCache.getOrSet(cacheKey, fetchIssues, 300);
  console.timeEnd('   2回目実行時間');
  console.log(`   取得件数: ${issues2.length}件`);

  // キャッシュ無効化（データ更新時）
  console.log('\n3. データ更新時: キャッシュ無効化');
  await queryCache.invalidate(cacheKey);

  // パターンマッチで一括削除
  console.log('\n4. プロジェクト全体のキャッシュを削除');
  await queryCache.invalidatePattern(`issues:project:*`);

  console.log('\n✅ クエリキャッシュの例が完了しました\n');
}

// ==================== パフォーマンス比較 ====================

async function performanceComparison() {
  console.log('\n========================================');
  console.log('パフォーマンス比較');
  console.log('========================================\n');

  const iterations = 100;
  const testKey = 'performance-test';
  const testData = { message: 'パフォーマンステスト', timestamp: Date.now() };

  // Redisキャッシュあり
  console.log(`1. Redisキャッシュ（${iterations}回）`);
  await queryCache.set(testKey, testData, 60);

  console.time('   キャッシュあり');
  for (let i = 0; i < iterations; i++) {
    await queryCache.get(testKey);
  }
  console.timeEnd('   キャッシュあり');

  // Redisキャッシュなし（毎回計算）
  console.log(`\n2. キャッシュなし（${iterations}回）`);
  console.time('   キャッシュなし');
  for (let i = 0; i < iterations; i++) {
    // 重い処理をシミュレート
    const _ = JSON.stringify(testData);
  }
  console.timeEnd('   キャッシュなし');

  await queryCache.invalidate(testKey);

  console.log('\n✅ パフォーマンス比較が完了しました\n');
}

// ==================== 実践的な例：課題一覧のキャッシュ ====================

async function practicalExample() {
  console.log('\n========================================');
  console.log('実践的な例: 課題一覧のキャッシュ');
  console.log('========================================\n');

  /**
   * オープン状態の課題を取得（キャッシュ対応）
   */
  async function getOpenIssues(projectId = null) {
    const cacheKey = projectId
      ? `issues:open:project:${projectId}`
      : 'issues:open:all';

    return await queryCache.getOrSet(
      cacheKey,
      async () => {
        console.log('   🔍 Firestoreから課題を取得中...');

        let query = firestore.collection(COLLECTIONS.ISSUES);

        if (projectId) {
          query = query.where('projectId', '==', projectId);
        }

        const snapshot = await query.get();
        const issues = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(issue => {
            const status = issue.ステータス || '';
            return status !== 'クローズ' && status !== '中止';
          });

        return issues;
      },
      600 // 10分間キャッシュ
    );
  }

  /**
   * 課題を更新してキャッシュを無効化
   */
  async function updateIssue(issueNo, updates) {
    console.log(`\n   📝 課題を更新: ${issueNo}`);

    // Firestoreを更新
    await firestore.collection(COLLECTIONS.ISSUES)
      .doc(issueNo)
      .update(updates);

    // 関連するキャッシュを無効化
    await queryCache.invalidatePattern('issues:*');

    console.log('   ✅ キャッシュを無効化しました');
  }

  // 使用例
  console.log('1. 初回取得（Firestoreから）');
  console.time('   実行時間');
  const issues1 = await getOpenIssues();
  console.timeEnd('   実行時間');
  console.log(`   取得件数: ${issues1.length}件`);

  console.log('\n2. 2回目取得（キャッシュから）');
  console.time('   実行時間');
  const issues2 = await getOpenIssues();
  console.timeEnd('   実行時間');
  console.log(`   取得件数: ${issues2.length}件`);

  console.log('\n✅ 実践的な例が完了しました\n');
}

// ==================== メイン処理 ====================

async function main() {
  try {
    console.log('========================================');
    console.log('Redis 使用例デモ');
    console.log('========================================');

    // セッション管理の例
    await sessionExample();

    // クエリキャッシュの例
    await queryCacheExample();

    // パフォーマンス比較
    await performanceComparison();

    // 実践的な例
    await practicalExample();

    console.log('\n========================================');
    console.log('✅ すべての例が完了しました');
    console.log('========================================\n');

    // Redis接続を終了
    redisClient.quit();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ エラーが発生しました:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// スクリプト実行
if (require.main === module) {
  main();
}

module.exports = {
  sessionExample,
  queryCacheExample,
  performanceComparison,
  practicalExample
};
