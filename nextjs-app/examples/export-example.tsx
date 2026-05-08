/**
 * CSV エクスポート使用例
 *
 * Next.jsコンポーネントでCSVエクスポート機能を使用する方法を示します。
 */

import { useState, useEffect } from 'react';
import { useCSVExport, filterOpenTodos, Todo } from '../lib/export-csv';

// ==================== サンプルデータ ====================

const sampleTodos: Todo[] = [
  {
    ToDoNo: 'TODO-001',
    ToDoタイトル: 'ログイン機能の実装',
    ToDo内容: 'ユーザー認証機能を実装する',
    親課題No: 'ISSUE-001',
    担当者: '馬場',
    期日: '2026-04-10',
    ステータス: 'オープン',
    優先度: '高',
    クローズ候補: 'OFF',
    判定対象情報: {
      成果物ファイル名: 'src/auth/login.ts',
      成果物URL: ''
    },
    起票日: '2026-03-01',
    更新日: '2026-03-15'
  },
  {
    ToDoNo: 'TODO-002',
    ToDoタイトル: 'データベース設計',
    ToDo内容: 'ユーザーテーブルの設計と実装',
    親課題No: 'ISSUE-001',
    担当者: '高松',
    期日: '2026-04-05',
    ステータス: 'クローズ',
    優先度: '高',
    クローズ候補: 'ON',
    判定対象情報: {
      成果物ファイル名: 'schema.sql',
      成果物URL: ''
    },
    起票日: '2026-03-01',
    更新日: '2026-03-20'
  }
];

// ==================== コンポーネント ====================

/**
 * 例1: 基本的な使い方
 */
export function BasicExportExample() {
  const { exportTodos } = useCSVExport();
  const [todos] = useState<Todo[]>(sampleTodos);

  const handleExport = () => {
    // オープン状態のToDoのみエクスポート
    const openTodos = filterOpenTodos(todos);
    exportTodos(openTodos, 'todos-export.csv');
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">ToDo一覧</h2>
      <div className="mb-4">
        <p>全体: {todos.length}件</p>
        <p>オープン: {filterOpenTodos(todos).length}件</p>
      </div>
      <button
        onClick={handleExport}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        CSV エクスポート
      </button>
    </div>
  );
}

/**
 * 例2: ローディング状態の管理
 */
export function ExportWithLoadingExample() {
  const { exportTodos } = useCSVExport();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // データ取得（例）
  useEffect(() => {
    const fetchTodos = async () => {
      setIsLoading(true);
      try {
        // ここで実際のAPI呼び出しを行う
        // const response = await fetch('/api/todos');
        // const data = await response.json();

        // サンプルデータを使用
        await new Promise(resolve => setTimeout(resolve, 1000));
        setTodos(sampleTodos);
      } catch (error) {
        console.error('データ取得エラー:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTodos();
  }, []);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // エクスポート処理（少し遅延を追加）
      await new Promise(resolve => setTimeout(resolve, 500));

      const openTodos = filterOpenTodos(todos);
      exportTodos(openTodos, `todos-${new Date().toISOString().split('T')[0]}.csv`);

      alert('CSVエクスポートが完了しました');
    } catch (error) {
      console.error('エクスポートエラー:', error);
      alert('エクスポートに失敗しました');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return <div className="p-4">読み込み中...</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">ToDo一覧（ローディング対応）</h2>
      <div className="mb-4">
        <p>オープン: {filterOpenTodos(todos).length}件</p>
      </div>
      <button
        onClick={handleExport}
        disabled={isExporting || todos.length === 0}
        className={`px-4 py-2 rounded ${
          isExporting || todos.length === 0
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-500 hover:bg-blue-600'
        } text-white`}
      >
        {isExporting ? 'エクスポート中...' : 'CSV エクスポート'}
      </button>
    </div>
  );
}

/**
 * 例3: フィルター機能付きエクスポート
 */
export function FilteredExportExample() {
  const { exportTodos } = useCSVExport();
  const [todos] = useState<Todo[]>(sampleTodos);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');

  const getFilteredTodos = () => {
    let filtered = [...todos];

    // ステータスでフィルタリング
    if (filterStatus === 'open') {
      filtered = filterOpenTodos(filtered);
    } else if (filterStatus === 'closed') {
      filtered = filtered.filter(t => t.ステータス === 'クローズ');
    }

    // 優先度でフィルタリング
    if (filterPriority !== 'all') {
      filtered = filtered.filter(t => t.優先度 === filterPriority);
    }

    return filtered;
  };

  const handleExport = () => {
    const filtered = getFilteredTodos();
    exportTodos(filtered, `todos-filtered-${Date.now()}.csv`);
  };

  const filteredTodos = getFilteredTodos();

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">ToDo一覧（フィルター機能付き）</h2>

      {/* フィルター */}
      <div className="mb-4 flex gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">ステータス</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border rounded px-2 py-1"
          >
            <option value="all">全て</option>
            <option value="open">オープン</option>
            <option value="closed">クローズ</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">優先度</label>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="border rounded px-2 py-1"
          >
            <option value="all">全て</option>
            <option value="高">高</option>
            <option value="中">中</option>
            <option value="低">低</option>
          </select>
        </div>
      </div>

      {/* 統計 */}
      <div className="mb-4">
        <p>フィルター後: {filteredTodos.length}件</p>
      </div>

      {/* エクスポートボタン */}
      <button
        onClick={handleExport}
        disabled={filteredTodos.length === 0}
        className={`px-4 py-2 rounded ${
          filteredTodos.length === 0
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-500 hover:bg-blue-600'
        } text-white`}
      >
        CSV エクスポート ({filteredTodos.length}件)
      </button>
    </div>
  );
}

/**
 * 例4: カスタムオプション付きエクスポート
 */
export function CustomOptionsExample() {
  const [todos] = useState<Todo[]>(sampleTodos);
  const [delimiter, setDelimiter] = useState(',');
  const [withBOM, setWithBOM] = useState(true);

  const handleExport = () => {
    // カスタムオプションでエクスポート（直接API使用）
    const { todosToCSV, downloadCSV } = require('../lib/export-csv');

    const csv = todosToCSV(filterOpenTodos(todos), {
      withBOM: withBOM,
      delimiter: delimiter,
      newline: '\r\n',
      quotes: true
    });

    const extension = delimiter === '\t' ? 'tsv' : 'csv';
    downloadCSV(csv, `todos-custom.${extension}`);
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">カスタムオプション</h2>

      {/* オプション設定 */}
      <div className="mb-4 space-y-2">
        <div>
          <label className="block text-sm font-medium mb-1">区切り文字</label>
          <select
            value={delimiter}
            onChange={(e) => setDelimiter(e.target.value)}
            className="border rounded px-2 py-1"
          >
            <option value=",">カンマ (CSV)</option>
            <option value="\t">タブ (TSV)</option>
            <option value=";">セミコロン</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="bom"
            checked={withBOM}
            onChange={(e) => setWithBOM(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="bom" className="text-sm">
            BOM付きUTF-8（Excel対応）
          </label>
        </div>
      </div>

      <button
        onClick={handleExport}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        カスタムエクスポート
      </button>
    </div>
  );
}

// デフォルトエクスポート
export default BasicExportExample;
