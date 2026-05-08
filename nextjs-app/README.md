# Next.js アプリケーション用ライブラリ

このディレクトリには、Next.jsアプリケーションで使用できるライブラリが含まれています。

## 📦 含まれるライブラリ

### export-csv.ts

ToDo・課題データをCSV形式でエクスポートするライブラリです。

#### 特徴

- **TypeScript完全対応**: 型安全なAPI
- **BOM付きUTF-8**: Excelで文字化けしない
- **Reactフック**: Next.jsで簡単に使用可能
- **カスタマイズ可能**: 区切り文字、改行コードなどを設定可能

#### 使用方法

##### 1. Node.jsスクリプトでの使用

```bash
# 依存関係のインストール
npm install papaparse
npm install --save-dev @types/papaparse

# スクリプト実行
node scripts/export-csv.js

# オプション付き
node scripts/export-csv.js --projectId PROJECT_ID --output todos.csv
```

##### 2. Next.jsコンポーネントでの使用

```typescript
import { useCSVExport, filterOpenTodos } from '@/lib/export-csv';

function TodoList() {
  const { exportTodos } = useCSVExport();
  const [todos, setTodos] = useState([]);

  const handleExport = () => {
    // オープン状態のToDoのみフィルタリング
    const openTodos = filterOpenTodos(todos);
    
    // CSVエクスポート
    exportTodos(openTodos, 'todos-export.csv');
  };

  return (
    <button onClick={handleExport}>
      CSV エクスポート
    </button>
  );
}
```

##### 3. API Routesでの使用

```typescript
// pages/api/export-todos.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { todosToCSV } from '@/lib/export-csv';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Firestoreからデータ取得
  const todos = await fetchTodosFromFirestore();

  // CSV生成
  const csv = todosToCSV(todos, { withBOM: true });

  // レスポンス設定
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=todos.csv');
  res.status(200).send(csv);
}
```

#### API リファレンス

##### `todosToCSV(todos, options?)`

ToDoデータをCSV文字列に変換します。

**パラメータ:**
- `todos: Todo[]` - ToDo配列
- `options?: CsvExportOptions` - エクスポートオプション
  - `withBOM?: boolean` - BOM付きUTF-8（デフォルト: true）
  - `delimiter?: string` - 区切り文字（デフォルト: ','）
  - `newline?: string` - 改行コード（デフォルト: '\r\n'）
  - `quotes?: boolean` - 引用符で囲む（デフォルト: true）

**戻り値:**
- `string` - CSV文字列

**例:**
```typescript
const csv = todosToCSV(todos, {
  withBOM: true,
  delimiter: ',',
  newline: '\r\n',
  quotes: true
});
```

##### `issuesToCSV(issues, options?)`

課題データをCSV文字列に変換します。

**パラメータ:**
- `issues: Issue[]` - 課題配列
- `options?: CsvExportOptions` - エクスポートオプション

**戻り値:**
- `string` - CSV文字列

##### `downloadCSV(csv, filename)`

CSVファイルをブラウザでダウンロードします。

**パラメータ:**
- `csv: string` - CSV文字列
- `filename: string` - ファイル名

**例:**
```typescript
const csv = todosToCSV(todos);
downloadCSV(csv, 'todos-export.csv');
```

##### `filterOpenTodos(todos)`

オープン状態のToDoのみフィルタリングします。

**パラメータ:**
- `todos: Todo[]` - ToDo配列

**戻り値:**
- `Todo[]` - オープン状態のToDo配列

##### `useCSVExport()`

CSVエクスポート用Reactフック。

**戻り値:**
- `{ exportTodos, exportIssues }`

**例:**
```typescript
const { exportTodos, exportIssues } = useCSVExport();
```

## 📊 CSVファイル形式

### ToDoのCSV

| 列名 | 説明 |
|------|------|
| ToDoNo | ToDo番号 |
| ToDoタイトル | タイトル |
| ToDo内容 | 内容 |
| 親課題No | 親課題の番号 |
| 担当者 | 担当者名 |
| 期日 | 期日（YYYY-MM-DD） |
| ステータス | ステータス |
| 優先度 | 優先度（高/中/低） |
| クローズ候補 | クローズ候補（ON/OFF） |
| 成果物ファイル名 | 判定対象ファイル名 |
| 成果物URL | 判定対象URL |
| 起票日 | 起票日 |
| 更新日 | 更新日 |

## 🔧 セットアップ

### 依存関係のインストール

```bash
npm install papaparse
npm install --save-dev @types/papaparse
```

### TypeScript設定

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "jsx": "preserve",
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@/lib/*": ["lib/*"]
    }
  }
}
```

## 💡 Tips

### Excelで正しく開く方法

1. **BOM付きUTF-8で保存する**
   ```typescript
   const csv = todosToCSV(todos, { withBOM: true });
   ```

2. **カンマやダブルクォートを含むデータ**
   - 自動的にエスケープされます
   - `quotes: true` オプションを使用

3. **日本語フィールド名**
   - BOM付きUTF-8で保存すれば文字化けしません

### カスタマイズ例

#### TSV（タブ区切り）で出力

```typescript
const tsv = todosToCSV(todos, {
  delimiter: '\t',
  withBOM: true
});
```

#### Unix形式の改行コード

```typescript
const csv = todosToCSV(todos, {
  newline: '\n'
});
```

## 🐛 トラブルシューティング

### Excelで文字化けする

**原因**: BOMが付いていない、またはUTF-8以外のエンコーディング

**解決方法**:
```typescript
const csv = todosToCSV(todos, { withBOM: true });
```

### 改行が正しく表示されない

**原因**: 改行コードが環境に合っていない

**解決方法**:
```typescript
// Windows
const csv = todosToCSV(todos, { newline: '\r\n' });

// Mac/Linux
const csv = todosToCSV(todos, { newline: '\n' });
```

## 📚 参考資料

- [papaparse公式ドキュメント](https://www.papaparse.com/)
- [CSV RFC 4180](https://www.rfc-editor.org/rfc/rfc4180)

## ライセンス

UNLICENSED

## 作成者

Tecnos Japan - 開発チーム
