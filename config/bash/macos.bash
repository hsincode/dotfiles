# macOS 固有（~/.config/bash/os.bash としてリンクされ、~/.bashrc の最後に読まれる）

# BSD の ls は --color ではなく -G で色を付ける
alias ls='ls -G'

# /bin/bash で起動したときの「既定のシェルは zsh です」を出さない
export BASH_SILENCE_DEPRECATION_WARNING=1
