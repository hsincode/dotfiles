// links.ts と config/ の対応が崩れていないかを見る
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import links from "../links";
import { pick, resolveEntries } from "../src/core";
import { OSES } from "../src/types";

const root = join(import.meta.dir, "..");

describe.each(OSES)("%s", (os) => {
  const entries = resolveEntries(links, { root, home: "/home/test", os });

  test("リンク元がすべて存在する", () => {
    for (const e of entries) expect(existsSync(e.src)).toBe(true);
  });

  test("bash / tmux / Ghostty の os.* が揃っている", () => {
    const dests = entries.map((e) => e.dest);
    expect(dests).toContain("/home/test/.config/bash/os.bash");
    expect(dests).toContain("/home/test/.config/tmux/os.conf");
    expect(dests).toContain("/home/test/.config/ghostty/os.ghostty");
  });
});

test("config/ のファイルはすべて links.ts から使われている", () => {
  const used = new Set<string>();
  for (const link of links) {
    for (const os of OSES) {
      const src = pick(link.src, os);
      if (src) used.add(src);
    }
  }
  const configDir = join(root, "config");
  const files = readdirSync(configDir, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => relative(configDir, join(d.parentPath, d.name)));
  // ディレクトリごとリンクしているもの（nvim）の中身は使われている扱い
  const unused = files.filter((f) => ![...used].some((u) => f === u || f.startsWith(`${u}/`)));
  expect(unused).toEqual([]);
});
