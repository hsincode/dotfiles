-- TypeScript / JavaScript / Vue
local filetypes = { 'typescript', 'javascript', 'javascriptreact', 'typescriptreact', 'vue' }

-- Vue の TypeScript プラグインは bun で @vue/language-server を global に入れたときだけ使う
local bun = vim.env.BUN_INSTALL or vim.fs.joinpath(vim.env.HOME, '.bun')
local vue = vim.fs.joinpath(bun, 'install/global/node_modules/@vue/language-server')
local plugins = {}
if vim.uv.fs_stat(vue) then
    plugins = { { name = '@vue/typescript-plugin', location = vue, languages = filetypes } }
end

return {
    filetypes = filetypes,
    init_options = { plugins = plugins },
}
