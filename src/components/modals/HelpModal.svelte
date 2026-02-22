<script>
  import { createEventDispatcher } from 'svelte'

  export let open = false

  const dispatch = createEventDispatcher()

  function close() {
    dispatch('close')
  }

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) {
      close()
    }
  }

  function handleBackdropKeydown(event) {
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      close()
    }
  }
</script>

{#if open}
  <div
    class="modal-backdrop"
    role="button"
    tabindex="0"
    onclick={handleBackdropClick}
    onkeydown={handleBackdropKeydown}
  >
    <div class="modal" role="dialog" aria-modal="true" aria-label="Keyboard help">
      <h2>Keyboard Help</h2>
      <div class="help-body">
        <p class="help-note">やりたいことから逆引きできます。<span class="cell-muted">—</span> はそのモードで利用不可です。</p>
        <div class="help-table-wrap">
          <table class="help-task-table">
            <thead class="help-sticky-head">
              <tr>
                <th scope="col">やりたいこと</th>
                <th scope="col">FOCUS</th>
                <th scope="col">INPUT</th>
                <th scope="col">COMMENT</th>
                <th scope="col">TOUCH / MOBILE</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">ノードを上下に移動</th>
                <td><span class="keycap">↑ / ↓</span>, <span class="keycap">h / j</span>, <span class="keycap">k / l</span></td>
                <td class="cell-muted">—</td>
                <td><span class="keycap">↑ / ↓</span> コメント確定 + 上下移動（COMMENT維持）</td>
                <td>下部バー <span class="keycap">↑</span> / <span class="keycap">↓</span></td>
              </tr>
              <tr>
                <th scope="row">子ノードを追加</th>
                <td><span class="keycap">Enter</span></td>
                <td class="cell-muted">—</td>
                <td class="cell-muted">—</td>
                <td>下部バー <span class="keycap">+</span>（FOCUS時）</td>
              </tr>
              <tr>
                <th scope="row">インデント変更</th>
                <td><span class="keycap">Tab</span> / <span class="keycap">Shift + Tab</span></td>
                <td><span class="keycap">Tab</span> / <span class="keycap">Shift + Tab</span></td>
                <td class="cell-muted">—</td>
                <td>下部バー <span class="keycap">Indent</span> / <span class="keycap">Outdent</span>（FOCUS時）</td>
              </tr>
              <tr>
                <th scope="row">ブランチ名を編集開始</th>
                <td><span class="keycap">i</span> またはブランチ名ダブルタップ</td>
                <td>入力中（再タップでFOCUS）</td>
                <td><span class="keycap">Ctrl/Cmd + I</span> で移行</td>
                <td>下部バー <span class="keycap">Pen</span></td>
              </tr>
              <tr>
                <th scope="row">コメント編集開始</th>
                <td><span class="keycap">c</span></td>
                <td>下部バー <span class="keycap">Comment</span> で切替</td>
                <td>入力中（再タップでFOCUS）</td>
                <td>下部バー <span class="keycap">Comment</span></td>
              </tr>
              <tr>
                <th scope="row">編集を確定して戻る</th>
                <td class="cell-muted">—</td>
                <td><span class="keycap">Enter</span> / <span class="keycap">Esc</span> でFOCUSへ</td>
                <td><span class="keycap">Enter</span> / <span class="keycap">Esc</span> でFOCUSへ</td>
                <td>同モードアイコン再タップでFOCUSへ</td>
              </tr>
              <tr>
                <th scope="row">COMMENTからINPUTへ移動</th>
                <td class="cell-muted">—</td>
                <td class="cell-muted">—</td>
                <td><span class="keycap">Ctrl/Cmd + I</span>（コメント確定後）</td>
                <td>COMMENT中に下部バー <span class="keycap">Pen</span></td>
              </tr>
              <tr>
                <th scope="row">ヘルプを開く / 閉じる</th>
                <td><span class="keycap">?</span> で開く</td>
                <td class="cell-muted">—</td>
                <td class="cell-muted">—</td>
                <td>下部バー <span class="keycap">Info</span> で開く / <span class="keycap">Esc</span> or Closeで閉じる</td>
              </tr>
              <tr>
                <th scope="row">Exportする</th>
                <td>右上 <span class="keycap">Export</span> ボタン</td>
                <td>右上 <span class="keycap">Export</span> ボタン</td>
                <td>右上 <span class="keycap">Export</span> ボタン</td>
                <td>下部バー <span class="keycap">Export</span></td>
              </tr>
              <tr>
                <th scope="row">Undo / Redo</th>
                <td><span class="keycap">Cmd/Ctrl + Z</span> / <span class="keycap">Cmd/Ctrl + Y</span></td>
                <td><span class="keycap">Cmd/Ctrl + Z</span> / <span class="keycap">Cmd/Ctrl + Y</span></td>
                <td><span class="keycap">Cmd/Ctrl + Z</span> / <span class="keycap">Cmd/Ctrl + Y</span></td>
                <td class="cell-muted">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="modal-actions">
        <button class="ghost" onclick={close}>Close</button>
      </div>
    </div>
  </div>
{/if}
