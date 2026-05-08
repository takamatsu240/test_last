# 課題一覧 - モバイル対応版

課題管理システムのモバイル対応課題一覧ページです。

## 特徴

### モバイルファーストデザイン
- **カード型レイアウト**: 各課題を見やすいカード形式で表示
- **レスポンシブ対応**: スマートフォン、タブレット、デスクトップに最適化
- **タッチフレンドリー**: モバイルデバイスでの操作性を重視

### 機能

1. **課題一覧表示**
   - オープン状態の課題のみを表示
   - カード型レイアウトで情報を整理

2. **検索機能**
   - 課題番号、タイトル、内容、担当者で検索可能
   - リアルタイム検索（入力中に絞り込み）

3. **フィルター機能**
   - ステータスでフィルター（オープン、作業中、確認待ち）
   - 重要度でフィルター（高、中、低）

4. **統計表示**
   - 全体件数
   - オープン件数
   - 期限超過件数

5. **視覚的なステータス表示**
   - 重要度による色分け（赤: 高、黄: 中、緑: 低）
   - ステータスバッジ
   - 期限超過の強調表示

## ファイル構成

```
public/
├── index.html              # メインHTMLファイル
├── css/
│   └── styles.css         # モバイル対応スタイルシート
├── js/
│   ├── firebase-config.js # Firebase設定
│   └── app.js             # アプリケーションロジック
└── README.md              # このファイル
```

## セットアップ

### 1. Firebase設定

`public/js/firebase-config.js` を編集し、Firebase設定を入力してください：

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "tecnos-cbp.firebaseapp.com",
  projectId: "tecnos-cbp",
  storageBucket: "tecnos-cbp.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

Firebase Consoleから取得できます：
1. Firebase Console (https://console.firebase.google.com/) を開く
2. プロジェクト設定 > 全般 > マイアプリ
3. ウェブアプリの設定をコピー

### 2. Firestoreセキュリティルール

Firestoreのセキュリティルールを設定してください：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /issues/{issueId} {
      allow read: if true;  // 本番環境では認証を追加
      allow write: if false;
    }
  }
}
```

### 3. ローカルサーバーで起動

HTTPサーバーで起動してください（ファイルプロトコルではFirebaseが動作しません）：

```bash
# Python 3の場合
python -m http.server 8000

# Node.jsの場合
npx http-server public -p 8000

# VSCodeのLive Server拡張機能も利用可能
```

ブラウザで `http://localhost:8000` を開きます。

## 画面レイアウト

### モバイル（〜767px）
- 1カラム表示
- フルスクリーン幅
- タッチ操作に最適化

### タブレット（768px〜1023px）
- 2カラムグリッド表示
- 余白を適度に確保

### デスクトップ（1024px〜）
- 3カラムグリッド表示
- 最大幅1200pxで中央配置

## 技術スタック

- **HTML5**: セマンティックマークアップ
- **CSS3**: Flexbox、Grid、カスタムプロパティ
- **JavaScript (ES6+)**: モダンJavaScript機能
- **Firebase SDK**: Firestore データベース接続

## ブラウザ対応

- Chrome（推奨）
- Safari
- Firefox
- Edge

## カスタマイズ

### 色のカスタマイズ

`styles.css` の `:root` セクションでカラー変数を変更できます：

```css
:root {
    --primary-color: #3b82f6;  /* メインカラー */
    --danger-color: #ef4444;   /* 高重要度 */
    --warning-color: #f59e0b;  /* 中重要度 */
    --success-color: #10b981;  /* 低重要度 */
}
```

### フィルター項目の追加

`index.html` のフィルターパネルセクションで項目を追加できます。

## トラブルシューティング

### 課題が表示されない

1. Firebase設定が正しいか確認
2. Firestoreセキュリティルールを確認
3. ブラウザのコンソールでエラーを確認
4. HTTPサーバーで起動しているか確認（file://では動作しません）

### スタイルが崩れる

1. ブラウザのキャッシュをクリア
2. CSSファイルが正しく読み込まれているか確認
3. レスポンシブデザインを確認（ブラウザのデベロッパーツールを使用）

## ライセンス

UNLICENSED

## 作成者

Tecnos Japan - タスク管理チーム
