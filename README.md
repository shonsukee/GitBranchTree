# GitBranchTree

Git ブランチの派生関係を、キーボード中心で編集して ASCII ツリーとして出力できる Web アプリです。

## 機能一覧
- ツリー構造の編集（追加、インデント、アウトデント、削除）
- Vim ライクなモード分離（FOCUS / INPUT / COMMENT）
- ブランチごとのコメント編集
- Undo / Redo
- ASCII / Mermaid gitGraph Export（モーダル表示 + Copy）
- ダークモード / ライトモード切り替え
- ブランチ名のダブルタップ編集（1秒以内）
- モバイルBottom Action Bar（主要操作をタップで実行）
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

## GitHub Pages デプロイ
1. GitHub の対象リポジトリで `Settings > Pages` を開く
2. `Build and deployment` の `Source` を `GitHub Actions` にする
3. `main` ブランチに push すると `.github/workflows/deploy-pages.yml` が実行され、`dist` が Pages に公開される
4. 公開URLは `https://shonsukee.github.io/GitBranchTree/`

## 操作方法
### モード
- `FOCUS`: 移動・構造編集モード
- `INPUT`: ブランチ名入力モード
- `COMMENT`: コメント入力モード
- `i`: FOCUS から INPUT へ
- `c`: FOCUS から COMMENT へ
- `Esc`: INPUT / COMMENT から FOCUS へ（編集確定）

### FOCUS モード操作
- `↑ / ↓`: カーソル移動
- `h` または `j`: 下へ移動
- `l` または `k`: 上へ移動
- `gg`: 最上ノードへ移動
- `G`: 最下ノードへ移動
- `Enter`: 現在ノードの先頭子ノードを追加
- `Tab`: 右インデント（直前兄弟を親にする）
- `Shift + Tab`: 左アウトデント
- `Delete` / `Backspace`: ノード削除（子は繰り上げ）
- `Cmd(Ctrl) + Shift + ↑`: ブランチを1段上へ移動
- `Cmd(Ctrl) + Shift + ↓`: ブランチを1段下へ移動
- `Cmd(Ctrl) + Z`: Undo
- `Cmd(Ctrl) + Y` または `Cmd(Ctrl) + Shift + Z`: Redo
- `?`: 操作ヘルプモーダルを開く

### ポインタ / タッチ操作
- ブランチ名を1秒以内にダブルタップ: INPUTモードで編集開始
- 単タップ: ノード選択のみ（既存挙動維持）
- モバイル下部バー:
  - `↑` / `↓`: カーソル移動
  - `+`: 先頭子ノード追加
  - `Indent` / `Outdent`: インデント調整
  - `Pen` / `Comment`: モード切替
  - `Pen` / `Comment` を同モード中に再タップ: FOCUSへ戻る
  - `Info` / `Export`: モーダル起動

### INPUT モード操作
- 通常入力: ブランチ名編集
- `Enter`: 編集確定
- `Esc`: 編集確定して FOCUS へ戻る
- スペースはブランチ名に入力されません

### COMMENT モード操作
- 通常入力: コメント編集
- `h` / `j` / `k` / `l`: 通常入力として扱われます（移動しません）
- `↑ / ↓`: コメントを確定して上下ノードへ移動（COMMENT維持）
- `Ctrl(Cmd) + I`: コメントを確定して INPUT モードへ移行
- `Enter`: コメント確定して FOCUS へ戻る
- `Esc`: コメント確定して FOCUS へ戻る
- `Tab` / `Shift + Tab`: 無効（構造変更しない）
- `Cmd(Ctrl) + Z`: Undo
- `Cmd(Ctrl) + Y` または `Cmd(Ctrl) + Shift + Z`: Redo

## UI
- 選択中ノードは行頭 `>` で表示
- ツリーは常時 ASCII スタイルで表示（`│`, `├──`, `└──`）
- コメントは右側に表示（非空時のみ `# ` を自動付与）
- Neo Console テーマ（ライト/ダーク）と軽い行ハイライトアニメーション
- 右上ボタンでテーマ切り替え（`Light` / `Dark`）

## Export
- `Export` ボタンで ASCII / Mermaid gitGraph をモーダル表示
- モーダル内で `ASCII` と `Mermaid gitGraph` を切り替え
- `Copy` ボタンでクリップボードへコピー
- Mermaidは ```` ```mermaid ... ``` ```` 形式で出力され、貼り付けるとそのままレンダリングできます
- コメントがある行だけ `# コメント` を出力
- `#` の位置は「最長ブランチ行 + 4スペース」で列揃え
- Mermaid 出力にはコメントは含まれません

## 保存仕様
- ドキュメント保存キー: `gitbranchtree.document.v1`
- テーマ保存キー: `gitbranchtree.theme.v1`
- 編集操作ごとに自動保存され、次回起動時に復元されます
