/**
 * CSV エクスポートライブラリ (TypeScript版)
 *
 * Next.jsアプリケーション用のCSVエクスポート機能
 * papaparseを使用してToDo・課題データをCSV形式で出力
 *
 * @module export-csv
 */

import Papa from 'papaparse';

// ==================== 型定義 ====================

/**
 * ToDo項目の型定義
 */
export interface Todo {
  ToDoNo?: string;
  ToDoタイトル?: string;
  ToDo内容?: string;
  親課題No?: string;
  担当者?: string;
  期日?: string;
  ステータス?: string;
  優先度?: string;
  クローズ候補?: string;
  判定対象情報?: {
    成果物ファイル名?: string;
    成果物URL?: string;
  };
  起票日?: string;
  更新日?: string;
  projectId?: string;
}

/**
 * 課題の型定義
 */
export interface Issue {
  課題No?: string;
  課題タイトル?: string;
  課題内容?: string;
  '対応の方向性・結論'?: string;
  課題の最新状況?: string;
  担当者?: string;
  期日?: string;
  ステータス?: string;
  重要度?: string;
  クローズ候補?: string;
  起票日?: string;
  更新日?: string;
  projectId?: string;
}

/**
 * CSV出力オプション
 */
export interface CsvExportOptions {
  /** BOM付きUTF-8で出力（Excel対応） */
  withBOM?: boolean;
  /** 区切り文字（デフォルト: カンマ） */
  delimiter?: string;
  /** 改行コード（デフォルト: \r\n） */
  newline?: string;
  /** 引用符で囲む */
  quotes?: boolean;
}

// ==================== CSVエクスポート関数 ====================

/**
 * ToDoデータをCSV文字列に変換
 *
 * @param todos - ToDo配列
 * @param options - エクスポートオプション
 * @returns CSV文字列
 *
 * @example
 * ```typescript
 * const todos = await fetchTodos();
 * const csv = todosToCSV(todos, { withBOM: true });
 * downloadCSV(csv, 'todos.csv');
 * ```
 */
export function todosToCSV(
  todos: Todo[],
  options: CsvExportOptions = {}
): string {
  const {
    withBOM = true,
    delimiter = ',',
    newline = '\r\n',
    quotes = true
  } = options;

  // CSVフィールド定義
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

  // データを整形
  const data = todos.map(todo => ({
    'ToDoNo': todo.ToDoNo || '',
    'ToDoタイトル': todo.ToDoタイトル || '',
    'ToDo内容': todo.ToDo内容 || '',
    '親課題No': todo.親課題No || '',
    '担当者': todo.担当者 || '',
    '期日': todo.期日 || '',
    'ステータス': todo.ステータス || '',
    '優先度': todo.優先度 || '',
    'クローズ候補': todo.クローズ候補 || '',
    '成果物ファイル名': todo.判定対象情報?.成果物ファイル名 || '',
    '成果物URL': todo.判定対象情報?.成果物URL || '',
    '起票日': todo.起票日 || '',
    '更新日': todo.更新日 || ''
  }));

  // CSVに変換
  const csv = Papa.unparse({
    fields: fields,
    data: data
  }, {
    quotes: quotes,
    quoteChar: '"',
    delimiter: delimiter,
    header: true,
    newline: newline
  });

  // BOM付きで返す（Excel対応）
  return withBOM ? '﻿' + csv : csv;
}

/**
 * 課題データをCSV文字列に変換
 *
 * @param issues - 課題配列
 * @param options - エクスポートオプション
 * @returns CSV文字列
 *
 * @example
 * ```typescript
 * const issues = await fetchIssues();
 * const csv = issuesToCSV(issues);
 * ```
 */
export function issuesToCSV(
  issues: Issue[],
  options: CsvExportOptions = {}
): string {
  const {
    withBOM = true,
    delimiter = ',',
    newline = '\r\n',
    quotes = true
  } = options;

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
    quotes: quotes,
    quoteChar: '"',
    delimiter: delimiter,
    header: true,
    newline: newline
  });

  return withBOM ? '﻿' + csv : csv;
}

/**
 * CSVファイルをダウンロード（ブラウザ用）
 *
 * @param csv - CSV文字列
 * @param filename - ダウンロードするファイル名
 *
 * @example
 * ```typescript
 * const csv = todosToCSV(todos);
 * downloadCSV(csv, 'todos-export.csv');
 * ```
 */
export function downloadCSV(csv: string, filename: string): void {
  // Blobを作成
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });

  // ダウンロードリンクを作成
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  // DOMに追加してクリック
  document.body.appendChild(link);
  link.click();

  // クリーンアップ
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * オープン状態のToDoのみフィルタリング
 *
 * @param todos - ToDo配列
 * @returns オープン状態のToDo配列
 */
export function filterOpenTodos(todos: Todo[]): Todo[] {
  return todos.filter(todo => {
    const status = todo.ステータス || '';
    return status !== 'クローズ';
  });
}

/**
 * オープン状態の課題のみフィルタリング
 *
 * @param issues - 課題配列
 * @returns オープン状態の課題配列
 */
export function filterOpenIssues(issues: Issue[]): Issue[] {
  return issues.filter(issue => {
    const status = issue.ステータス || '';
    return status !== 'クローズ' && status !== '中止';
  });
}

// ==================== React フック（Next.js用） ====================

/**
 * CSVエクスポート用カスタムフック
 *
 * @example
 * ```typescript
 * function TodoList() {
 *   const { exportTodos, isExporting } = useCSVExport();
 *
 *   const handleExport = async () => {
 *     const todos = await fetchTodos();
 *     exportTodos(todos, 'todos.csv');
 *   };
 *
 *   return (
 *     <button onClick={handleExport} disabled={isExporting}>
 *       CSVエクスポート
 *     </button>
 *   );
 * }
 * ```
 */
export function useCSVExport() {
  const exportTodos = (todos: Todo[], filename: string = 'todos.csv') => {
    const csv = todosToCSV(todos);
    downloadCSV(csv, filename);
  };

  const exportIssues = (issues: Issue[], filename: string = 'issues.csv') => {
    const csv = issuesToCSV(issues);
    downloadCSV(csv, filename);
  };

  return {
    exportTodos,
    exportIssues
  };
}

// ==================== デフォルトエクスポート ====================

export default {
  todosToCSV,
  issuesToCSV,
  downloadCSV,
  filterOpenTodos,
  filterOpenIssues,
  useCSVExport
};
