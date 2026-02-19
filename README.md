# GitBranchTree

Git ブランチの派生関係を、キーボード中心で編集して ASCII ツリーとして出力できる Web アプリです。

## 機能一覧
- ツリー構造の編集（追加、インデント、アウトデント、削除）
- Vim ライクなモード分離
- Undo / Redo
- ASCII ツリー Export（モーダル表示 + Copy）
- ダークモード / ライトモード切り替え
- localStorage への自動保存と復元

## 起動方法
1. 依存関係をインストール
```bash
pnpm install
```
2. 開発サーバー起動
```bash
pnpm dev
```
3. テスト実行
```bash
pnpm test
```
4. 本番ビルド
```bash
pnpm build
```

## 操作方法
### モード
- `FOCUS`: 移動・構造編集モード
- `INPUT`: 名前入力モード
- `i`: FOCUS から INPUT へ
- `Esc`: INPUT から FOCUS へ（編集確定）

### FOCUS モード操作
- `↑ / ↓`: カーソル移動
- `h` または `j`: 下へ移動
- `l` または `k`: 上へ移動
- `gg`: 最上ノードへ移動
- `G`: 最下ノードへ移動
- `Enter`: 現在ノードの下に新規ノード追加
- `Tab`: 右インデント（直前兄弟を親にする）
- `Shift + Tab`: 左アウトデント
- `Delete` / `Backspace`: ノード削除（子は繰り上げ）
- `Cmd(Ctrl) + Shift + ↑`: ブランチを1段上へ移動
- `Cmd(Ctrl) + Shift + ↓`: ブランチを1段下へ移動
- `Cmd(Ctrl) + Z`: Undo
- `Cmd(Ctrl) + Y` または `Cmd(Ctrl) + Shift + Z`: Redo

### INPUT モード操作
- 通常入力: ブランチ名編集
- `Enter`: 編集確定
- `Esc`: 編集確定して FOCUS へ戻る
- スペースはブランチ名に入力されません

## UI
- 選択中ノードは行頭 `>` で表示
- ツリーは常時 ASCII スタイルで表示（`│`, `├──`, `└──`）
- 右上ボタンでテーマ切り替え（`Light` / `Dark`）

## Export
- `Export` ボタンで ASCII ツリーをモーダル表示
- `Copy` ボタンでクリップボードへコピー

## 保存仕様
- ドキュメント保存キー: `gitbranchtree.document.v1`
- テーマ保存キー: `gitbranchtree.theme.v1`
- 編集操作ごとに自動保存され、次回起動時に復元されます
