-- Lua（Neovim の設定を書くときに vim.* を補完できるよう runtime を読ませる）
return {
    settings = {
        Lua = {
            workspace = {
                library = vim.api.nvim_get_runtime_file('', true),
            },
        },
    },
}
