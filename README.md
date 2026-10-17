# dotfiles

Linux（Void）と macOS で共通の dotfiles。bash・git・mise・tmux・Ghostty・Neovim・lazygit。

```sh
./dot link --dry-run   # 何が起きるかだけ見る
./dot link             # リンクを張る（既存のものは ~/.local/state/dotfiles/backups/ へ退避）
./dot status
```

bun が必要（`curl -fsSL https://bun.sh/install | bash`）。
構成・OS 差分の書き方・詰まったときは [DOTFILES.md](DOTFILES.md)。
