#!/usr/bin/env node

/**
 * ToDo CSV エクスポートシステム
 *
 * Firestoreに保存されているオープン状態のToDo項目を
 * CSV形式でエクスポートします。
 *
 * 使用方法:
 *   node scripts/export-csv.js [--projectId PROJECT_ID] [--output FILE_PATH]
 *
 * 機能:
 * - オープン状態のToDoのみを抽出
 * - papaparseによるCSVファイル生成
 * - プロジェクト単位でのフィルタリング対応
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

// ==================== 設定 ====================

const EXPORTS_DIR = path.join(__dirname, '..', 'exports');

// ==================== コマンドライン引数解析 ====================

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    projectId: null,
    output: null,
    includeIssues: false
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--projectId' && i + 1 < args.length) {
      options.projectId = args[i + 1];
      i++;
    } else if (args[i] === '--output' && i + 1 < args.length) {
      options.output = args[i + 1];
      i++;
    } else if (args[i] === '--include-issues') {
      options.includeIssues = true;
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

/**
 * オープン状態の課題を取得（オプション）
 */
async function getOpenIssues(projectId = null) {
  try {
    let query = db.collection(COLLECTIONS.ISSUES);

    if (projectId) {
      query = query.where('projectId', '==', projectId);
    }

    const snapshot = await query.get();
    const issues = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

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

// ==================== CSV生成関数 ====================

/**
 * ToDoデータをCSV形式に変換
 */
function todosToCSV(todos) {
  // CSVに出力するフィールドを定義
  const fields = [
    'ToDoNo',
    'ToDoタイトル',
    'ToDo内容',
    '親課題No',
    '担当者',
    '期日',
    'ステータス',
    '優先度',
    'クローズ候補',
    '成果物ファイル名',
    '成果物URL',
    '起票日',
    '更新日'
  ];

  // ToDoデータをCSV用のオブジェクト配列に変換
  const data = todos.map(todo => {
    const judgementInfo = todo.判定対象情報 || {};

    return {
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
      '成果物URL': judgementInfo.成果物URL || '',
      '起票日': todo.起票日 || '',
      '更新日': todo.更新日 || ''
    };
  });

  // papaparseでCSVに変換
  const csv = Papa.unparse({
    fields: fields,
    data: data
  }, {
    quotes: true,        // すべてのフィールドを引用符で囲む
    quoteChar: '"',      // ダブルクォート
    delimiter: ',',      // カンマ区切り
    header: true,        // ヘッダー行を含める
    newline: '\r\n'      // Windows形式の改行
  });

  return csv;
}

/**
 * 課題データをCSV形式に変換
 */
function issuesToCSV(issues) {
  const fields = [
    '課題No',
    '課題タイトル',
    '課題内容',
    '対応の方向性・結論',
    '課題の最新状況',
    '担当者',
    '期日',
    'ステータス',
    '重要度',
    'クローズ候補',
    '起票日',
    '更新日'
  ];

  const data = issues.map(issue => ({
    '課題No': issue.課題No || '',
    '課題タイトル': issue.課題タイトル || '',
    '課題内容': issue.課題内容 || '',
    '対応の方向性・結論': issue['対応の方向性・結論'] || '',
    '課題の最新状況': issue.課題の最新状況 || '',
    '担当者': issue.担当者 || '',
    '期日': issue.期日 || '',
    'ステータス': issue.ステータス || '',
    '重要度': issue.重要度 || '',
    'クローズ候補': issue.クローズ候補 || '',
    '起票日': issue.起票日 || '',
    '更新日': issue.更新日 || ''
  }));

  const csv = Papa.unparse({
    fields: fields,
    data: data
  }, {
    quotes: true,
    quoteChar: '"',
    delimiter: ',',
    header: true,
    newline: '\r\n'
  });

  return csv;
}

/**
 * CSVファイルを保存
 */
function saveCSV(csv, outputPath) {
  console.log('💾 CSVファイルを保存中...');

  // ディレクトリが存在しない場合は作成
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // BOM付きUTF-8で保存（Excelで正しく開けるように）
  const BOM = '﻿';
  fs.writeFileSync(outputPath, BOM + csv, 'utf8');

  console.log(`✅ CSVファイルを保存しました: ${outputPath}`);
}

// ==================== メイン処理 ====================

async function main() {
  console.log('========================================');
  console.log('📊 ToDo CSVエクスポート開始');
  console.log('========================================');

  // コマンドライン引数を解析
  const options = parseArgs();

  console.log(`🏢 プロジェクトID: ${options.projectId || '(全プロジェクト)'}`);
  console.log(`📄 課題も含める: ${options.includeIssues ? 'はい' : 'いいえ'}`);
  console.log('');

  try {
    // 1. Firestoreに接続
    console.log('🔌 Firestoreに接続中...');
    await initializeFirestore();
    console.log('✅ Firestore接続成功');
    console.log('');

    // 2. データを取得
    console.log('📥 データを取得中...');
    const todos = await getOpenTodos(options.projectId);

    console.log(`✅ 取得完了:`);
    console.log(`   - オープンToDo: ${todos.length}件`);

    let issues = [];
    if (options.includeIssues) {
      issues = await getOpenIssues(options.projectId);
      console.log(`   - オープン課題: ${issues.length}件`);
    }
    console.log('');

    // 3. 出力先パスを決定
    let todoOutputPath = options.output;
    let issueOutputPath = null;

    if (!todoOutputPath) {
      // exportsディレクトリが存在しない場合は作成
      if (!fs.existsSync(EXPORTS_DIR)) {
        fs.mkdirSync(EXPORTS_DIR, { recursive: true });
      }

      // デフォルトのファイル名: todos-YYYYMMDD-HHMMSS.csv
      const now = new Date();
      const timestamp = now.toISOString()
        .replace(/T/, '-')
        .replace(/:/g, '')
        .replace(/\..+/, '')
        .substring(0, 15); // YYYYMMDD-HHMMSS

      todoOutputPath = path.join(EXPORTS_DIR, `todos-${timestamp}.csv`);

      if (options.includeIssues) {
        issueOutputPath = path.join(EXPORTS_DIR, `issues-${timestamp}.csv`);
      }
    } else {
      // 相対パスを絶対パスに変換
      todoOutputPath = path.isAbsolute(todoOutputPath)
        ? todoOutputPath
        : path.join(process.cwd(), todoOutputPath);

      if (options.includeIssues) {
        const ext = path.extname(todoOutputPath);
        const base = path.basename(todoOutputPath, ext);
        const dir = path.dirname(todoOutputPath);
        issueOutputPath = path.join(dir, `${base}-issues${ext}`);
      }
    }

    // 4. CSVファイルを生成・保存
    console.log('📝 CSVファイルを生成中...');

    // ToDoのCSV
    const todoCsv = todosToCSV(todos);
    saveCSV(todoCsv, todoOutputPath);

    // 課題のCSV（オプション）
    if (options.includeIssues && issues.length > 0) {
      const issueCsv = issuesToCSV(issues);
      saveCSV(issueCsv, issueOutputPath);
    }

    console.log('');

    // 5. サマリー
    console.log('========================================');
    console.log('✅ エクスポート完了');
    console.log('========================================');
    console.log(`📁 出力先:`);
    console.log(`   ToDo: ${todoOutputPath}`);
    if (options.includeIssues && issueOutputPath) {
      console.log(`   課題: ${issueOutputPath}`);
    }
    console.log(`📊 データ件数:`);
    console.log(`   ToDo: ${todos.length}件`);
    if (options.includeIssues) {
      console.log(`   課題: ${issues.length}件`);
    }
    console.log('');
    console.log('💡 ヒント:');
    console.log('   - Excelで開く場合、BOM付きUTF-8で保存されているため文字化けしません');
    console.log('   - カンマやダブルクォートを含むフィールドは自動的にエスケープされます');
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

module.exports = { getOpenTodos, getOpenIssues, todosToCSV, issuesToCSV, saveCSV };
