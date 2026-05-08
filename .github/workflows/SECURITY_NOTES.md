# GitHub Actions セキュリティノート

このドキュメントでは、GitHub Actionsワークフローのセキュリティに関する重要事項を記載します。

## ✅ セキュリティチェックリスト

### Secretsの管理

- [x] すべての認証情報はGitHub Secretsで管理
- [x] ワークフローでは`secrets`経由でアクセス
- [x] ログに秘密情報が出力されない

### 必要なSecrets

| Secret名 | 用途 | 設定方法 |
|---------|------|---------|
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Firestore接続 | Firebase Console > プロジェクト設定 > サービスアカウント > 新しい秘密鍵を生成 |
| `OPENAI_API_KEY` | AI解析 | OpenAI Platform > API Keys |
| `GCP_PROJECT_ID` | GCPプロジェクトID | `tecnos-cbp`（固定値） |

### Secretsの設定手順

1. GitHubリポジトリを開く
2. **Settings** タブをクリック
3. **Secrets and variables** → **Actions** を選択
4. **New repository secret** をクリック
5. 名前と値を入力して **Add secret**

## 🔒 セキュリティベストプラクティス

### 1. 秘密情報の出力禁止

```yaml
# ❌ 避けるべき
- name: Debug
  run: |
    echo "API Key: ${{ secrets.OPENAI_API_KEY }}"
    echo "Service Account: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_KEY }}"

# ✅ 推奨
- name: Debug
  run: |
    echo "API Key is set: ${{ secrets.OPENAI_API_KEY != '' }}"
    echo "Service Account is set: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_KEY != '' }}"
```

### 2. マスキングの使用

```yaml
# ✅ 秘密情報をマスク
- name: Setup
  run: |
    echo "::add-mask::${{ secrets.OPENAI_API_KEY }}"
```

### 3. 最小権限の原則

```yaml
permissions:
  contents: read      # 必要最小限の権限
  # contents: write   # 書き込みが必要な場合のみ
```

### 4. Pull Requestからのワークフロー実行制限

```yaml
on:
  push:
    branches:
      - main
      - develop
  # pull_request からの実行は制限（Secrets漏洩防止）
```

### 5. スクリプトインジェクション防止

```yaml
# ❌ 危険（ユーザー入力を直接使用）
- name: Comment
  run: |
    echo "${{ github.event.comment.body }}"

# ✅ 安全（環境変数経由）
- name: Comment
  env:
    COMMENT_BODY: ${{ github.event.comment.body }}
  run: |
    echo "$COMMENT_BODY"
```

## 🚨 セキュリティインシデント対応

### Secretsが漏洩した場合

1. **即座に無効化**
   - Firebase: サービスアカウントキーを削除
   - OpenAI: APIキーを無効化

2. **新しいSecretsを生成**
   - 新しい認証情報を生成
   - GitHub Secretsを更新

3. **影響範囲の調査**
   - ログを確認
   - 不正使用がないかチェック

4. **再発防止**
   - セキュリティレビュー
   - ドキュメント更新

## 📋 定期セキュリティチェック

毎月実施すべき項目：

- [ ] 使用していないSecretsの削除
- [ ] Secretsのローテーション（可能な場合）
- [ ] ワークフローログのレビュー
- [ ] 権限設定の見直し
- [ ] 依存関係の脆弱性スキャン

## 🔍 監査ログ

GitHub Actionsの実行ログは以下で確認できます：

1. リポジトリの **Actions** タブ
2. 各ワークフロー実行の詳細ログ
3. **Settings** → **Actions** → **General** → **Workflow permissions**

## 📚 参考資料

- [GitHub Actions Security Best Practices](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
- [Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Automatic token authentication](https://docs.github.com/en/actions/security-guides/automatic-token-authentication)

---

**最終更新**: 2026-05-08  
**担当**: Tecnos Japan DevOps チーム
