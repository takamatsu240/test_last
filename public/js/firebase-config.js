// ⚠️ セキュリティ警告:
// このファイルは公開されます。APIキーは公開情報として扱われます。
// 本番環境では必ずFirebaseセキュリティルールでアクセス制御を設定してください。
//
// Firebase Consoleから設定を取得:
// https://console.firebase.google.com/ > プロジェクト設定 > 全般 > マイアプリ

const firebaseConfig = {
  apiKey: "REPLACE_WITH_YOUR_FIREBASE_API_KEY",
  authDomain: "tecnos-cbp.firebaseapp.com",
  projectId: "tecnos-cbp",
  storageBucket: "tecnos-cbp.appspot.com",
  messagingSenderId: "REPLACE_WITH_YOUR_MESSAGING_SENDER_ID",
  appId: "REPLACE_WITH_YOUR_APP_ID"
};

// Firebase初期化
try {
  firebase.initializeApp(firebaseConfig);
  console.log('✅ Firebase初期化成功');
} catch (error) {
  console.error('❌ Firebase初期化エラー:', error);
}

// Firestoreインスタンス
const db = firebase.firestore();

// コレクション名
const COLLECTIONS = {
  ISSUES: 'issues',
  TODOS: 'todos',
  PROJECTS: 'projects'
};
