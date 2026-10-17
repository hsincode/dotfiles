# DOTFILES.md

hsincode の dotfiles の設計と運用ルール。
Linux（Void Linux）と macOS を、1 つのリポジトリ・1 つのブランチで管理する。

- 設定ファイルは `config/<アプリ>/` に置く
- どれをどこへリンクするかは `links.ts` に書く（唯一の一覧）
- リンクを張るのは `./dot`（bun 製のインストーラー。中身は `src/`）

## 入っているもの

| アプリ | 共通 | OS ごと | リンク先 |
| --- | --- | --- | --- |
| bash | `bash/bashrc`・`bash/bash_profile` | `bash/linux.bash`・`bash/macos.bash` | `~/.bashrc`・`~/.bash_profile`・`~/.config/bash/os.bash` |
| git | `git/config`・`git/ignore` | なし | `~/.config/git/` |
| mise | `mise/config.toml` | ファイル内の `os = [...]` | `~/.config/mise/config.toml` |
| tmux | `tmux/tmux.conf` | `tmux/linux.conf`・`tmux/macos.conf` | `~/.config/tmux/tmux.conf`・`~/.config/tmux/os.conf` |
| Ghostty | `ghostty/config.ghostty` | `ghostty/linux.ghostty`・`ghostty/macos.ghostty` | `~/.config/ghostty/config.ghostty`・`~/.config/ghostty/os.ghostty` |
| Neovim | `nvim/`（ディレクトリごと） | なし | `~/.config/nvim` |
| lazygit | `lazygit/config.yml` | なし（置き場所だけ違う） | Linux: `~/.config/lazygit/`、macOS: `~/Library/Application Support/lazygit/` |

入れていないもの: ウィンドウマネージャ周り（Linux の dwm・picom・dunst・rofi、macOS の AeroSpace）と、アプリ本体のインストール。

## ディレクトリ構成

```
dotfiles/
├── DOTFILES.md        この文書
├── README.md
├── dot                入口（bun を探して src/cli.ts を実行する）
├── links.ts           リンクの一覧
├── src/
│   ├── types.ts       Link / PerOS の型
│   ├── core.ts        状態の判定・リンク・退避（ファイル操作はここだけ）
│   └── cli.ts         コマンドと表示
├── test/              bun test
└── config/
    ├── bash/  git/  mise/  tmux/  ghostty/  nvim/  lazygit/
```

## 使い方

### 新しいマシンに入れる

```sh
# bun（macOS は brew install oven-sh/bun/bun でもよい）
curl -fsSL https://bun.sh/install | bash

ghq get hsincode/dotfiles
cd ~/ghq/github.com/hsincode/dotfiles
./dot link --dry-run               # 何が起きるかだけ見る
./dot link
```

アプリ本体（tmux・Neovim・lazygit・Ghostty・mise・gh）は Void なら xbps、macOS なら Homebrew で別に入れる。
mise のツールは `mise install`、Neovim のプラグインは初回起動時に `nvim-pack-lock.json` の版で入る。

### コマンド

| コマンド | すること |
| --- | --- |
| `./dot link` | リンクを張る。既にあるものはバックアップへ退避してから張る。何度実行してもよい |
| `./dot unlink` | このリポジトリへのリンクだけを外す。他のファイルには触らない |
| `./dot status` | 各リンクの状態を表示する。すべて揃っていれば終了コード 0 |

オプション: `-n, --dry-run`（表示だけ）、`--os linux|macos`（OS を指定）、`--home <dir>`（ホームを差し替える。試すとき用）。

### バックアップ

退避したものは `~/.local/state/dotfiles/backups/<日時>/` に、ホームからの相対パスのまま入る（シンボリックリンクはリンクのまま）。
元に戻すときは `./dot unlink` のあと、そこから `cp -a` で戻す。

## `./dot link` の動き

`links.ts` の各項目について、今の OS 用の `src` と `dest` を選び、`dest` の状態で決める。

| `dest` の状態 | すること |
| --- | --- |
| 無い | 親ディレクトリを作ってリンクを張る |
| このリポジトリの正しいファイルへのリンク | 何もしない |
| このリポジトリの別のファイルへのリンク（OS の指定や `links.ts` を変えたあと） | 張り直す（退避しない） |
| それ以外のファイル・ディレクトリ・リンク | 退避してから張る |
| 途中のディレクトリがシンボリックリンクかファイル | 触れない |

「触れない」が 1 件でもあれば、何も変えずに終わる。途中のディレクトリがリンクのまま進むと、リンクの作成や退避がリンクの先（以前の dotfiles のリポジトリなど）で起きてしまうため。

`replaces` に書いた古い置き場所（`~/.tmux.conf` など）も、残っていれば退避する。
リンクは絶対パスで張る。リポジトリを動かしたら `./dot link` をやり直せば張り直される。

## OS 差分の書き方

1. **まず共通ファイルに書く。** OS ファイルには、OS が違うせいで値が変わるものだけを置く。
2. **入っているかどうかで決まるものは、OS で分けずに存在チェックで書く。**
   PATH・補完スクリプト・Homebrew がこれに当たる。Void でも macOS でも、別の Linux でもそのまま動く。
   ```sh
   _path_add /opt/homebrew/bin                # 無ければ何もしない
   [ -r "$f" ] && . "$f"
   ```
3. **OS ファイルは `<アプリ>/linux.*` と `<アプリ>/macos.*` を対で置き、同じリンク先 `os.*` に割り当てる。**
   本体は最後に `os.*` を読む。後から読むので、本体の値を OS ファイルで上書きできる。
   ```ts
   { src: { linux: "tmux/linux.conf", macos: "tmux/macos.conf" }, dest: "~/.config/tmux/os.conf" },
   ```
   | アプリ | 本体での読み込み |
   | --- | --- |
   | bash | `. ~/.config/bash/os.bash` |
   | tmux | `source-file -q ~/.config/tmux/os.conf` |
   | Ghostty | `config-file = ?os.ghostty`（相対パスはリンクの置き場所から解決される） |
4. **アプリ自身に OS の指定があれば、それを使う。** mise は `os = ["linux"]` で入れる OS を絞れる。
5. **置き場所が OS で違うアプリは、`dest` を OS ごとに書く。** lazygit がこれ。
6. **マシン固有の値と秘密は git に入れない。** bash は `~/.env`、git は `~/.config/git/local` を読む（無ければ飛ばす）。
7. **古い置き場所は `replaces` に書く。** 残っていると、新しい設定より優先されたり二重に読まれたりする（`~/.tmux.conf`・`~/.gitconfig`・Ghostty の旧名 `config` と macOS の `~/Library/Application Support/com.mitchellh.ghostty/`）。

### 今の OS 差分

| | Linux | macOS |
| --- | --- | --- |
| bash | `ls --color`、`open` → `xdg-open`、xbps に sudo、`claude()` ラッパー | `ls -G`、zsh 移行メッセージを出さない |
| tmux | コピーを `clipset` へ、配色を dwm のテーマから | コピーを `pbcopy` へ |
| Ghostty | Berkeley Mono＋IBM Plex Sans JP 16pt、テーマは dwm に追従 | Iosevka Nerd Font 20pt、Catppuccin Latte、すりガラス、Option を Alt に |
| mise | BongoCat も入れる | |
| lazygit | `~/.config/lazygit/` | `~/Library/Application Support/lazygit/` |

`claude()` ラッパー（tmux 内で Claude Code を truecolor にする）は、macOS 側で 2026-07 に外したので Linux だけに置いている。

## 設定を足す・変える

- **既存の設定を変える:** リポジトリの `config/` を編集する。`~/.config/...` はリンクなので同じファイルだが、ツールによってはリンクを実ファイルで置き換えてしまう。
- **アプリを足す:** `config/<アプリ>/` にファイルを置き、`links.ts` に 1 行足し、`bun test` → `./dot link`。
  `bun test` は「リンク元がすべてある」「`config/` に使われていないファイルが無い」を確かめる。
- **OS 差分が要る:** 上のルール 3。両方の OS のファイルを必ず対で作る（中身が空でもよい）。
- **インストーラーが `~/.bashrc` に追記した:** リンクなのでリポジトリの `config/bash/bashrc` に入る。`git diff` で見て、要るものは `_path_add` の形に直して残す。

## dotfiles の外との接点（Linux）

配色は dwm のテーマ切替（別のリポジトリで管理している `~/.config/dwm/theme-apply.sh`）に追従する。このリポジトリはその仕組みを持たず、読む場所だけを決めている。

| アプリ | 読むもの |
| --- | --- |
| Ghostty | `theme = "dwm-current"` → `~/.config/ghostty/themes/dwm-current` |
| tmux | `~/.config/dwm/tmux/current.conf`（無ければ何もしない） |
| Neovim | theme-apply.sh が起動中の nvim へ `set background=...` を送る |

`~/.config/ghostty/themes` は dwm 側のテーマ置き場へのリンクで、`./dot` は触らない。
dwm のテーマが無い Linux では Ghostty が「theme "dwm-current" not found」を出すので、`linux.ghostty` の `theme` を Catppuccin などに変える。

## 確かめ方

```sh
bun test                 # インストーラーと links.ts の整合
bunx tsc --noEmit        # 型
./dot status             # このマシンのリンク

# 別のホーム・別の OS で試す（本物のホームには触らない）
./dot link --home /tmp/dot-mac --os macos
XDG_CONFIG_HOME=/tmp/dot-mac/.config ghostty +show-config | grep -E '^(font|theme)'
HOME=/tmp/dot-mac tmux -L test -f /tmp/dot-mac/.config/tmux/tmux.conf new -d \; show -sv copy-command
```

アプリごと: `ghostty +validate-config`、`nvim --headless +qa`、`git config --list --show-origin`、`bash -n config/bash/*`。

## 詰まったとき

**「触れない: ~/.config/xxx がシンボリックリンク」**
以前の dotfiles（stow など）がディレクトリごとリンクしている。リンクを外して本物のディレクトリにしてから `./dot link` する。
そのディレクトリに他の仕組みのファイルがあるなら、そこだけリンクで戻す。Ghostty の例:

```sh
rm ~/.config/ghostty                 # リンクだけが消える（リンク先の中身は残る）
mkdir ~/.config/ghostty
ln -s <dwm 側のリポジトリ>/.config/ghostty/themes ~/.config/ghostty/themes
./dot link
```

**tmux が古い設定のまま**
起動中のサーバーは前の設定を持ったまま。`tmux source-file ~/.config/tmux/tmux.conf` を 1 回実行する（以後は prefix + r）。

**macOS で lazygit の設定が効かない**
`XDG_CONFIG_HOME` を設定していると、lazygit は `~/.config/lazygit/` を読む。その場合は `links.ts` の macOS 側の `dest` を合わせる。

## 以前の dotfiles から変えたこと

以前の dotfiles は、ホームをそのまま写した stow 構成を OS ごとのブランチ（`void` / `macos`）に分けていた。ここでは構成は引き継がず、設定値だけを元に書き直した。

- **構成:** OS ごとのブランチ → 1 ブランチ＋`links.ts`。ホームの写し → アプリごとのディレクトリ。stow → `./dot`
- **置き場所:** tmux・git・Ghostty を XDG の場所へ（`~/.config/tmux/tmux.conf`、`~/.config/git/config`、`config.ghostty`）
- **bash:** PATH は存在チェック付きの `_path_add` にまとめた。環境変数を対話チェックより前に置き、`bash -lc` でも PATH が通るようにした。`go env GOPATH` の呼び出しをやめた。何もしていなかった `bind ': menu-complete'` の 2 行を消した
- **git:** credential helper を gh の絶対パスから PATH 上の `gh` に。`~/.config/git/local` で上書きできるようにした。`.DS_Store` を無視
- **Neovim:** `ignorecase` を足した（`smartcase` だけでは効かない）。`<leader>y` の余分な `<CR>`（次の行まで一緒にコピーしていた）を消した。7 つの `after/ftplugin` を 1 つの autocmd に、使っていなかった `lsp/vtsls.lua` を削除、`BUN_INSTALL` が無くても ts_ls が落ちないようにした
- **lazygit:** macOS の `pbcopy` / `pbpaste` に対応、X11 は `clipset` を優先
- **tmux:** macOS でも OS のクリップボードへコピー（`pbcopy`）
- **Ghostty:** Linux で入れていたカーソル設定（点滅なし・不透明度 0.85・入力中はマウスを隠す）を macOS にも
