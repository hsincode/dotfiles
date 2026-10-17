# Linux 固有（~/.config/bash/os.bash としてリンクされ、~/.bashrc の最後に読まれる）

alias ls='ls --color=auto'
alias open='xdg-open'
if command -v xbps-install >/dev/null; then
    alias xbps-install='sudo xbps-install'
    alias xbps-remove='sudo xbps-remove'
fi

# Claude Code: tmux 内では $TMUX を外して truecolor で描かせ（$TMUX があると
# 256 色に落ちる: anthropics/claude-code#60788）、tmux が上書きした TERM_PROGRAM を
# ghostty に戻して Ghostty 連携（プログレスバーなど）を保つ。
# macOS 側では 2026-07 に外したので Linux だけに置いている。
claude() {
    if [ -n "$TMUX" ] && [ -n "$GHOSTTY_RESOURCES_DIR" ]; then
        TMUX= TERM_PROGRAM=ghostty TERM_PROGRAM_VERSION=1.3.1 command claude "$@"
    else
        command claude "$@"
    fi
}
