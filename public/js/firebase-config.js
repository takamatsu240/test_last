// ⚠️ セキュリティ警告:
// このファイルは公開されます。APIキーは公開情報として扱われます。
// 本番環境では必ずFirebaseセキュリティルールでアクセス制御を設定してください。
//
// Firebase Consoleから設定を取得:
// https://console.firebase.google.com/ > プロジェクト設定 > 全般 > マイアプリ

// TODO: Firebase Consoleから取得した実際の値に置き換えてください
const firebaseConfig = {
  apiKey: "<your-api-key-here>",  // Firebase Console > プロジェクト設定 > 全般から取得
  authDomain: "tecnos-cbp.firebaseapp.com",
  projectId: "tecnos-cbp",
  storageBucket: "tecnos-cbp.appspot.com",
  messagingSenderId: "<your-sender-id>",  // Firebase Console から取得
  appId: "<your-app-id>"  // Firebase Console から取得
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
