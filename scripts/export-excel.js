#!/usr/bin/env node

/**
 * 課題・ToDo Excel エクスポートシステム
 *
 * Firestoreに保存されているオープン状態の課題(Issues)とToDo項目を
 * Excel形式でエクスポートします。
 *
 * 使用方法:
 *   node scripts/export-excel.js [--projectId PROJECT_ID] [--output FILE_PATH]
 *
 * 機能:
 * - オープン状態の課題・ToDoのみを抽出
 * - ExcelJSによる2シート構成のExcelファイル生成
 * - プロジェクト単位でのフィルタリング対応
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

// ==================== 設定 ====================

const EXPORTS_DIR = path.join(__dirname, '..', 'exports');

// ==================== コマンドライン引数解析 ====================

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    projectId: null,
    output: null
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--projectId' && i + 1 < args.length) {
      options.projectId = args[i + 1];
      i++;
    } else if (args[i] === '--output' && i + 1 < args.length) {
      options.output = args[i + 1];
      i++;
    }
  }

  return options;
}

// ==================== Firestore初期化 ====================

let db;
let COLLECTIONS;

async function initializeFirestore() {
  // Firebase Admin SDKの初期化
  const admin = require('firebase-admin');

  if (!admin.apps.length) {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (!serviceAccountKey) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is required');
    }

    const serviceAccount = JSON.parse(serviceAccountKey);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.GCP_PROJECT_ID
    });
  }

  db = admin.firestore();

  COLLECTIONS = {
    ISSUES: 'issues',
    TODOS: 'todos',
    PROJECTS: 'projects'
  };

  return { db, COLLECTIONS };
}

// ==================== データ取得関数 ====================

/**
 * オープン状態の課題を取得
 */
async function getOpenIssues(projectId = null) {
  try {
    let query = db.collection(COLLECTIONS.ISSUES);

    // プロジェクトIDでフィルタリング
    if (projectId) {
      query = query.where('projectId', '==', projectId);
    }

    const snapshot = await query.get();
    const issues = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // オープン状態のみフィルタリング（ステータスが「クローズ」「中止」以外）
    const openIssues = issues.filter(issue => {
      const status = issue.ステータス || '';
      return status !== 'クローズ' && status !== '中止';
    });

    return openIssues;
  } catch (error) {
    console.error('❌ 課題取得エラー:', error.message);
    throw error;
  }
}

/**
 * オープン状態のToDoを取得
 */
async function getOpenTodos(projectId = null) {
  try {
    let query = db.collection(COLLECTIONS.TODOS);

    // プロジェクトIDでフィルタリング
    if (projectId) {
      query = query.where('projectId', '==', projectId);
    }

    const snapshot = await query.get();
    const todos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // オープン状態のみフィルタリング（ステータスが「クローズ」以外）
    const openTodos = todos.filter(todo => {
      const status = todo.ステータス || '';
      return status !== 'クローズ';
    });

    return openTodos;
  } catch (error) {
    console.error('❌ ToDo取得エラー:', error.message);
    throw error;
  }
}

// ==================== Excel生成関数 ====================

/**
 * Excelファイルを生成
 */
async function generateExcel(issues, todos, outputPath) {
  console.log('📊 Excelファイルを生成中...');

  const workbook = new ExcelJS.Workbook();

  // ワークブックのプロパティを設定
  workbook.creator = 'Task Management System';
  workbook.created = new Date();

  // シート1: 課題一覧
  const issuesSheet = workbook.addWorksheet('課題一覧');

  // ヘッダー行を定義
  const issueHeaders = [
    { header: '課題No', key: '課題No', width: 15 },
    { header: '課題タイトル', key: '課題タイトル', width: 30 },
    { header: '課題内容', key: '課題内容', width: 40 },
    { header: '対応の方向性・結論', key: '対応の方向性・結論', width: 40 },
    { header: '課題の最新状況', key: '課題の最新状況', width: 40 },
    { header: '担当者', key: '担当者', width: 15 },
    { header: '期日', key: '期日', width: 12 },
    { header: 'ステータス', key: 'ステータス', width: 12 },
    { header: '重要度', key: '重要度', width: 10 },
    { header: 'クローズ候補', key: 'クローズ候補', width: 12 }
  ];

  issuesSheet.columns = issueHeaders;

  // ヘッダー行のスタイリング
  issuesSheet.getRow(1).font = { bold: true };
  issuesSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD9E1F2' } // 薄い青
  };

  // データを追加
  issues.forEach(issue => {
    issuesSheet.addRow({
      '課題No': issue.課題No || '',
      '課題タイトル': issue.課題タイトル || '',
      '課題内容': issue.課題内容 || '',
      '対応の方向性・結論': issue['対応の方向性・結論'] || '',
      '課題の最新状況': issue.課題の最新状況 || '',
      '担当者': issue.担当者 || '',
      '期日': issue.期日 || '',
      'ステータス': issue.ステータス || '',
      '重要度': issue.重要度 || '',
      'クローズ候補': issue.クローズ候補 || ''
    });
  });

  // フィルターを有効化
  issuesSheet.autoFilter = {
    from: 'A1',
    to: `J${issues.length + 1}`
  };

  // シート2: ToDo一覧
  const todosSheet = workbook.addWorksheet('ToDo一覧');

  // ヘッダー行を定義
  const todoHeaders = [
    { header: 'ToDoNo', key: 'ToDoNo', width: 15 },
    { header: 'ToDoタイトル', key: 'ToDoタイトル', width: 30 },
    { header: 'ToDo内容', key: 'ToDo内容', width: 40 },
    { header: '親課題No', key: '親課題No', width: 15 },
    { header: '担当者', key: '担当者', width: 15 },
    { header: '期日', key: '期日', width: 12 },
    { header: 'ステータス', key: 'ステータス', width: 12 },
    { header: '優先度', key: '優先度', width: 10 },
    { header: 'クローズ候補', key: 'クローズ候補', width: 12 },
    { header: '成果物ファイル名', key: '成果物ファイル名', width: 40 },
    { header: '成果物URL', key: '成果物URL', width: 40 }
  ];

  todosSheet.columns = todoHeaders;

  // ヘッダー行のスタイリング
  todosSheet.getRow(1).font = { bold: true };
  todosSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD9E1F2' } // 薄い青
  };

  // データを追加
  todos.forEach(todo => {
    const judgementInfo = todo.判定対象情報 || {};

    todosSheet.addRow({
      'ToDoNo': todo.ToDoNo || '',
      'ToDoタイトル': todo.ToDoタイトル || '',
      'ToDo内容': todo.ToDo内容 || '',
      '親課題No': todo.親課題No || '',
      '担当者': todo.担当者 || '',
      '期日': todo.期日 || '',
      'ステータス': todo.ステータス || '',
      '優先度': todo.優先度 || '',
      'クローズ候補': todo.クローズ候補 || '',
      '成果物ファイル名': judgementInfo.成果物ファイル名 || '',
      '成果物URL': judgementInfo.成果物URL || ''
    });
  });

  // フィルターを有効化
  todosSheet.autoFilter = {
    from: 'A1',
    to: `K${todos.length + 1}`
  };

  // ファイルを保存
  await workbook.xlsx.writeFile(outputPath);

  console.log(`✅ Excelファイルを保存しました: ${outputPath}`);
}

// ==================== メイン処理 ====================

async function main() {
  console.log('========================================');
  console.log('📊 課題・ToDo Excelエクスポート開始');
  console.log('========================================');

  // コマンドライン引数を解析
  const options = parseArgs();

  console.log(`🏢 プロジェクトID: ${options.projectId || '(全プロジェクト)'}`);
  console.log('');

  try {
    // 1. Firestoreに接続
    console.log('🔌 Firestoreに接続中...');
    await initializeFirestore();
    console.log('✅ Firestore接続成功');
    console.log('');

    // 2. データを取得
    console.log('📥 データを取得中...');
    const issues = await getOpenIssues(options.projectId);
    const todos = await getOpenTodos(options.projectId);

    console.log(`✅ 取得完了:`);
    console.log(`   - オープン課題: ${issues.length}件`);
    console.log(`   - オープンToDo: ${todos.length}件`);
    console.log('');

    // 3. 出力先パスを決定
    let outputPath = options.output;

    if (!outputPath) {
      // exportsディレクトリが存在しない場合は作成
      if (!fs.existsSync(EXPORTS_DIR)) {
        fs.mkdirSync(EXPORTS_DIR, { recursive: true });
      }

      // デフォルトのファイル名: issues-todos-YYYYMMDD-HHMMSS.xlsx
      const now = new Date();
      const timestamp = now.toISOString()
        .replace(/T/, '-')
        .replace(/:/g, '')
        .replace(/\..+/, '')
        .substring(0, 15); // YYYYMMDD-HHMMSS

      outputPath = path.join(EXPORTS_DIR, `issues-todos-${timestamp}.xlsx`);
    } else {
      // 相対パスを絶対パスに変換
      outputPath = path.isAbsolute(outputPath)
        ? outputPath
        : path.join(process.cwd(), outputPath);
    }

    // 4. Excelファイルを生成
    await generateExcel(issues, todos, outputPath);
    console.log('');

    // 5. サマリー
    console.log('========================================');
    console.log('✅ エクスポート完了');
    console.log('========================================');
    console.log(`📁 出力先: ${outputPath}`);
    console.log(`📊 課題: ${issues.length}件`);
    console.log(`📊 ToDo: ${todos.length}件`);
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('========================================');
    console.error('❌ エラーが発生しました');
    console.error('========================================');
    console.error(error.message);
    console.error('');

    if (error.stack) {
      console.error('スタックトレース:');
      console.error(error.stack);
    }

    process.exit(1);
  }
}

// スクリプト実行
if (require.main === module) {
  main();
}

module.exports = { getOpenIssues, getOpenTodos, generateExcel };
