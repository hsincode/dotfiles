-- Neovim（hsincode/dotfiles の config/nvim）。Linux と macOS で共通

vim.g.mapleader = ' '

-- ---- 表示・編集 ----
vim.opt.guicursor = ''
vim.opt.termguicolors = true
vim.opt.number = true
vim.opt.relativenumber = true
vim.opt.signcolumn = 'yes'
vim.opt.scrolloff = 6
vim.opt.wrap = false
vim.opt.winborder = 'rounded'
vim.opt.pumborder = 'rounded'
vim.opt.swapfile = false

vim.opt.tabstop = 4
vim.opt.shiftwidth = 4
vim.opt.expandtab = true
vim.opt.smartindent = true

vim.opt.hlsearch = false
-- 小文字だけなら大文字小文字を区別せず、大文字を含めば区別する
vim.opt.ignorecase = true
vim.opt.smartcase = true

vim.diagnostic.config({ virtual_text = { current_line = true } })

-- Web 系と YAML は 2 スペース
vim.api.nvim_create_autocmd('FileType', {
    pattern = { 'javascript', 'javascriptreact', 'typescript', 'typescriptreact', 'vue', 'json', 'yaml' },
    callback = function()
        vim.bo.tabstop = 2
        vim.bo.shiftwidth = 2
    end,
})

-- ---- 補完（LSP の補完を打鍵ごとに出す） ----
vim.opt.complete = 'o'
vim.opt.pumheight = 10
vim.opt.completeopt = { 'menuone', 'noinsert' }
vim.api.nvim_create_autocmd('LspAttach', {
    callback = function(args)
        local client = assert(vim.lsp.get_client_by_id(args.data.client_id))
        if client:supports_method('textDocument/completion') then
            client.server_capabilities.completionProvider.triggerCharacters = nil
            vim.lsp.completion.enable(true, client.id, args.buf, {
                autotrigger = true,
                convert = function(item)
                    return { abbr = item.label:gsub('%b()', '') }
                end,
            })
        end
    end,
})

-- ---- プラグイン（vim.pack。版は nvim-pack-lock.json に固定される） ----
vim.pack.add({
    { src = 'https://github.com/neovim/nvim-lspconfig' },
    { src = 'https://github.com/stevearc/oil.nvim' },
    { src = 'https://github.com/lewis6991/gitsigns.nvim' },
    { src = 'https://github.com/nvim-mini/mini.pick' },
    { src = 'https://github.com/catppuccin/nvim' },
})

-- 上の一覧から外したプラグインは消す
local inactive = vim.iter(vim.pack.get())
    :filter(function(p) return not p.active end)
    :map(function(p) return p.spec.name end)
    :totable()
if #inactive > 0 then
    vim.pack.del(inactive)
end

require('gitsigns').setup()
require('mini.pick').setup()
require('oil').setup({
    view_options = { show_hidden = true },
    win_options = {
        winbar = "%#@attribute.builtin#%{substitute(v:lua.require('oil').get_current_dir(), '^' . $HOME, '~', '')}",
    },
})

-- ---- 配色 ----
-- 'background' は起動時に端末の背景色から決まり、Latte / Mocha が選ばれる。
-- Linux では dwm のテーマを切り替えると theme-apply.sh が起動中の nvim へ
-- set background=... を送ってくる。
require('catppuccin').setup({
    flavour = 'auto',
    background = { light = 'latte', dark = 'mocha' },
    transparent_background = true,
    float = { transparent = true },
})
vim.cmd.colorscheme('catppuccin')

-- catppuccin は flavour = 'auto' を起動時に一度しか見ないので、'background' が変わったら読み直す
vim.api.nvim_create_autocmd('OptionSet', {
    pattern = 'background',
    callback = function()
        if (vim.g.colors_name or ''):match('^catppuccin') then
            vim.cmd.colorscheme('catppuccin')
        end
    end,
})

-- ---- LSP（設定は lsp/ 以下。サーバー本体は各自で入れる） ----
vim.lsp.enable({ 'gopls', 'ts_ls', 'lua_ls', 'bashls' })

-- ---- キー ----
local map = vim.keymap.set
map('n', '<leader>e', vim.cmd.Oil)
map('n', '<leader>w', vim.cmd.write)
map('n', '<leader>q', vim.cmd.quit)
map('n', '<leader>x', vim.cmd.bdelete)
map('n', '<leader>t', vim.cmd.terminal)
map('n', '<leader>d', function() vim.diagnostic.setqflist({ severity = vim.diagnostic.severity.ERROR }) end)
map({ 'n', 'x' }, '<leader>y', '"+y')

map('n', 'grd', vim.lsp.buf.definition)
map('n', 'gre', vim.diagnostic.open_float)
map('n', '<leader>lf', vim.lsp.buf.format)

map('n', '<leader>f', '<Cmd>Pick files<CR>')
map('n', '<leader>s', '<Cmd>Pick grep<CR>')
map('n', '<leader>b', '<Cmd>Pick buffers<CR>')
