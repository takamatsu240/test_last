// Firebase設定
// 本番環境では環境変数から読み込むことを推奨
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "tecnos-cbp.firebaseapp.com",
  projectId: "tecnos-cbp",
  storageBucket: "tecnos-cbp.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
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
