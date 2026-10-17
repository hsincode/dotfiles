// どの設定ファイルを、どの OS で、どこへリンクするか。./dot はこの一覧だけを見る。
// 書き方と OS 差分の扱いは DOTFILES.md を参照。
import type { Link } from "./src/types";

export default [
  // ---- bash ----
  { src: "bash/bashrc", dest: "~/.bashrc" },
  { src: "bash/bash_profile", dest: "~/.bash_profile" },
  { src: { linux: "bash/linux.bash", macos: "bash/macos.bash" }, dest: "~/.config/bash/os.bash" },

  // ---- git ----
  { src: "git/config", dest: "~/.config/git/config", replaces: ["~/.gitconfig"] },
  { src: "git/ignore", dest: "~/.config/git/ignore" },

  // ---- mise ----
  { src: "mise/config.toml", dest: "~/.config/mise/config.toml" },

  // ---- tmux ----
  { src: "tmux/tmux.conf", dest: "~/.config/tmux/tmux.conf", replaces: ["~/.tmux.conf"] },
  { src: { linux: "tmux/linux.conf", macos: "tmux/macos.conf" }, dest: "~/.config/tmux/os.conf" },

  // ---- Ghostty ----
  {
    src: "ghostty/config.ghostty",
    dest: "~/.config/ghostty/config.ghostty",
    // 旧名の config と、macOS で追加で読まれる場所
    replaces: [
      "~/.config/ghostty/config",
      "~/Library/Application Support/com.mitchellh.ghostty/config",
      "~/Library/Application Support/com.mitchellh.ghostty/config.ghostty",
    ],
  },
  { src: { linux: "ghostty/linux.ghostty", macos: "ghostty/macos.ghostty" }, dest: "~/.config/ghostty/os.ghostty" },

  // ---- Neovim（ディレクトリごと。vim.pack が nvim-pack-lock.json をここへ書く） ----
  { src: "nvim", dest: "~/.config/nvim" },

  // ---- lazygit（置き場所が OS で違う） ----
  {
    src: "lazygit/config.yml",
    dest: {
      linux: "~/.config/lazygit/config.yml",
      macos: "~/Library/Application Support/lazygit/config.yml",
    },
  },
] satisfies Link[];
