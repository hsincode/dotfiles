import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  applyLink,
  applyUnlink,
  inspect,
  planLink,
  planUnlink,
  resolveEntries,
  type Context,
} from "../src/core";
import type { Link } from "../src/types";

let tmp: string;
let ctx: Context;

function write(path: string, body = "") {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
}

beforeEach(() => {
  tmp = realpathSync(mkdtempSync(join(tmpdir(), "dot-test-")));
  const root = join(tmp, "repo");
  const home = join(tmp, "home");
  mkdirSync(home, { recursive: true });
  write(join(root, "config/app/conf"), "shared");
  write(join(root, "config/app/linux.conf"), "linux");
  write(join(root, "config/app/macos.conf"), "macos");
  write(join(root, "config/tool/settings"), "tool");
  ctx = { root, home, os: "linux" };
});

afterEach(() => rmSync(tmp, { recursive: true, force: true }));

const LINKS: Link[] = [
  { src: "app/conf", dest: "~/.config/app/conf", replaces: ["~/.apprc"] },
  { src: { linux: "app/linux.conf", macos: "app/macos.conf" }, dest: "~/.config/app/os.conf" },
  { src: "tool/settings", dest: { linux: "~/.config/tool/settings", macos: "~/Library/Tool/settings" } },
  { src: { macos: "app/macos.conf" }, dest: "~/.mac-only" },
];

function link(c = ctx) {
  return applyLink(planLink(resolveEntries(LINKS, c), c), c, join(c.home, "backup"));
}

describe("resolveEntries", () => {
  test("OS ごとの src / dest を選び、その OS に無い項目は飛ばす", () => {
    const linux = resolveEntries(LINKS, ctx).map((e) => e.dest.slice(ctx.home.length));
    expect(linux).toEqual(["/.config/app/conf", "/.config/app/os.conf", "/.config/tool/settings"]);

    const mac = resolveEntries(LINKS, { ...ctx, os: "macos" }).map((e) => e.dest.slice(ctx.home.length));
    expect(mac).toEqual(["/.config/app/conf", "/.config/app/os.conf", "/Library/Tool/settings", "/.mac-only"]);
  });

  test("リンク先の重複はエラー", () => {
    expect(() => resolveEntries([...LINKS, { src: "tool/settings", dest: "~/.config/app/conf" }], ctx)).toThrow();
  });
});

describe("link", () => {
  test("何も無いところにリンクを張り、親ディレクトリも作る", () => {
    link();
    const os = join(ctx.home, ".config/app/os.conf");
    expect(readlinkSync(os)).toBe(join(ctx.root, "config/app/linux.conf"));
    expect(readFileSync(os, "utf8")).toBe("linux");
  });

  test("2 回目は何も変えない", () => {
    link();
    const steps = planLink(resolveEntries(LINKS, ctx), ctx);
    expect(steps.every((s) => s.op === "keep")).toBe(true);
  });

  test("既存のファイルは退避してから張る", () => {
    write(join(ctx.home, ".config/app/conf"), "old");
    const moved = link();
    expect(moved).toHaveLength(1);
    expect(readFileSync(join(ctx.home, "backup/.config/app/conf"), "utf8")).toBe("old");
    expect(lstatSync(join(ctx.home, ".config/app/conf")).isSymbolicLink()).toBe(true);
  });

  test("別の場所へのリンクも退避する（リンクのまま）", () => {
    write(join(tmp, "elsewhere/conf"), "x");
    mkdirSync(join(ctx.home, ".config/app"), { recursive: true });
    symlinkSync(join(tmp, "elsewhere/conf"), join(ctx.home, ".config/app/conf"));
    link();
    expect(readlinkSync(join(ctx.home, "backup/.config/app/conf"))).toBe(join(tmp, "elsewhere/conf"));
  });

  test("replaces の古い置き場所を退避する", () => {
    write(join(ctx.home, ".apprc"), "legacy");
    link();
    expect(existsSync(join(ctx.home, ".apprc"))).toBe(false);
    expect(readFileSync(join(ctx.home, "backup/.apprc"), "utf8")).toBe("legacy");
  });

  test("OS を切り替えると、このリポジトリへの古いリンクは退避せず張り直す", () => {
    link();
    const mac = { ...ctx, os: "macos" as const };
    const moved = link(mac);
    expect(moved).toHaveLength(0);
    expect(readFileSync(join(ctx.home, ".config/app/os.conf"), "utf8")).toBe("macos");
  });

  test("途中のディレクトリがシンボリックリンクなら何も変えずに止まる", () => {
    mkdirSync(join(tmp, "other-repo/app"), { recursive: true });
    mkdirSync(join(ctx.home, ".config"), { recursive: true });
    symlinkSync(join(tmp, "other-repo/app"), join(ctx.home, ".config/app"));
    write(join(ctx.home, ".apprc"), "legacy");

    const entries = resolveEntries(LINKS, ctx);
    expect(inspect(entries[0]!, ctx).kind).toBe("blocked");
    expect(() => link()).toThrow();
    // 他の項目も含めて、何も変わっていない
    expect(readFileSync(join(ctx.home, ".apprc"), "utf8")).toBe("legacy");
    expect(existsSync(join(ctx.home, ".config/tool"))).toBe(false);
  });
});

test("古い置き場所がシンボリックリンクの先にあるときも、リンクの先のファイルを動かさない", () => {
  // ~/.legacy-dir → 別のリポジトリ。その中の古い設定ファイルは別リポジトリの持ち物
  write(join(tmp, "other-repo/legacy/old.conf"), "theirs");
  symlinkSync(join(tmp, "other-repo/legacy"), join(ctx.home, ".legacy-dir"));
  const links: Link[] = [{ src: "app/conf", dest: "~/.config/app/conf", replaces: ["~/.legacy-dir/old.conf"] }];

  const steps = planLink(resolveEntries(links, ctx), ctx);
  expect(steps.some((s) => s.op === "blocked" && s.path.endsWith("old.conf"))).toBe(true);
  expect(() => applyLink(steps, ctx, join(ctx.home, "backup"))).toThrow();
  expect(readFileSync(join(tmp, "other-repo/legacy/old.conf"), "utf8")).toBe("theirs");
  expect(existsSync(join(ctx.home, ".config/app/conf"))).toBe(false);
});

describe("unlink", () => {
  test("このリポジトリへのリンクだけを外す", () => {
    link();
    write(join(ctx.home, ".config/app/unrelated"), "keep");
    rmSync(join(ctx.home, ".config/tool/settings"));
    write(join(ctx.home, ".config/tool/settings"), "user file");

    const entries = resolveEntries(LINKS, ctx);
    applyUnlink(planUnlink(entries, ctx));

    expect(existsSync(join(ctx.home, ".config/app/conf"))).toBe(false);
    expect(existsSync(join(ctx.home, ".config/app/os.conf"))).toBe(false);
    expect(readFileSync(join(ctx.home, ".config/tool/settings"), "utf8")).toBe("user file");
    expect(readFileSync(join(ctx.home, ".config/app/unrelated"), "utf8")).toBe("keep");
  });
});
