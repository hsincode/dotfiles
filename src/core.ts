import {
  cpSync,
  lstatSync,
  mkdirSync,
  readlinkSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  type Stats,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import type { Link, OS, PerOS } from "./types";

export interface Context {
  /** リポジトリのルート（実パス） */
  root: string;
  /** リンクを置くホームディレクトリ */
  home: string;
  os: OS;
}

/** links.ts の 1 項目を、今の OS について絶対パスへ解決したもの */
export interface Entry {
  src: string;
  dest: string;
  replaces: string[];
}

/** dest の今の状態 */
export type State =
  | { kind: "ok" }
  | { kind: "missing" }
  /** このリポジトリへのリンクだが、指す先が違う（OS の切り替えや links.ts の変更のあと） */
  | { kind: "stale"; target: string }
  /** 別のファイル・ディレクトリ・リンクがある。link はバックアップへ退避してから張る */
  | { kind: "occupied"; what: string }
  /** 途中のディレクトリがシンボリックリンクかファイルで、ここには張れない */
  | { kind: "blocked"; reason: string };

export type Step =
  | { op: "keep"; entry: Entry }
  | { op: "link"; entry: Entry; state: State }
  /** replaces に書いた古い置き場所を退避する（ours ならこのリポジトリへのリンクなので消すだけ） */
  | { op: "retire"; path: string; ours: boolean }
  /** 途中のディレクトリがシンボリックリンクなどで、path に手を付けられない */
  | { op: "blocked"; path: string; reason: string };

export function pick(value: PerOS, os: OS): string | undefined {
  return typeof value === "string" ? value : value[os];
}

export function expandHome(path: string, home: string): string {
  if (path.startsWith("~/")) return join(home, path.slice(2));
  throw new Error(`パスは ~/ から書く: ${path}`);
}

/** home の中なら ~/… の形にして表示する */
export function tilde(path: string, home: string): string {
  return isInside(path, home) ? `~/${relative(home, path)}` : path;
}

function isInside(path: string, dir: string): boolean {
  const rel = relative(dir, path);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

function lstat(path: string): Stats | undefined {
  try {
    return lstatSync(path);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") return undefined;
    throw e;
  }
}

/** シンボリックリンクが指す先を絶対パスで返す（相対リンクはリンクの場所から解決） */
function linkTarget(path: string): string {
  return resolve(dirname(path), readlinkSync(path));
}

export function resolveEntries(links: readonly Link[], ctx: Context): Entry[] {
  const entries: Entry[] = [];
  const seen = new Set<string>();
  for (const link of links) {
    const src = pick(link.src, ctx.os);
    const dest = pick(link.dest, ctx.os);
    if (src === undefined || dest === undefined) continue; // この OS では使わない
    const entry = {
      src: join(ctx.root, "config", src),
      dest: expandHome(dest, ctx.home),
      replaces: (link.replaces ?? []).map((p) => expandHome(p, ctx.home)),
    };
    if (seen.has(entry.dest)) throw new Error(`リンク先が重複している: ${dest}`);
    seen.add(entry.dest);
    entries.push(entry);
  }
  return entries;
}

/**
 * home から path までの途中のディレクトリに、シンボリックリンクかファイルがあれば理由を返す。
 * そのまま進めると、リンクの作成や退避がリンクの先（別のリポジトリなど）で起きてしまう
 */
function blockedAncestor(path: string, ctx: Context): string | undefined {
  for (let dir = dirname(path); isInside(dir, ctx.home); dir = dirname(dir)) {
    const st = lstat(dir);
    if (!st) continue;
    if (st.isSymbolicLink()) return `${tilde(dir, ctx.home)} がシンボリックリンク（→ ${linkTarget(dir)}）`;
    if (!st.isDirectory()) return `${tilde(dir, ctx.home)} がディレクトリではない`;
  }
  return undefined;
}

export function inspect(entry: Entry, ctx: Context): State {
  const reason = blockedAncestor(entry.dest, ctx);
  if (reason) return { kind: "blocked", reason };

  const st = lstat(entry.dest);
  if (!st) return { kind: "missing" };
  if (st.isSymbolicLink()) {
    const target = linkTarget(entry.dest);
    if (target === entry.src) return { kind: "ok" };
    if (isInside(target, ctx.root)) return { kind: "stale", target };
    return { kind: "occupied", what: `${target} へのリンク` };
  }
  return { kind: "occupied", what: st.isDirectory() ? "ディレクトリ" : "ファイル" };
}

export type LegacyState = { kind: "absent" } | { kind: "present"; ours: boolean } | { kind: "blocked"; reason: string };

/** replaces に書いた古い置き場所の状態。ours はこのリポジトリへのリンクかどうか */
export function inspectLegacy(path: string, ctx: Context): LegacyState {
  const st = lstat(path);
  if (!st) return { kind: "absent" };
  const reason = blockedAncestor(path, ctx);
  if (reason) return { kind: "blocked", reason };
  return { kind: "present", ours: st.isSymbolicLink() && isInside(linkTarget(path), ctx.root) };
}

export function planLink(entries: readonly Entry[], ctx: Context): Step[] {
  const steps: Step[] = [];
  for (const entry of entries) {
    for (const path of entry.replaces) {
      const legacy = inspectLegacy(path, ctx);
      if (legacy.kind === "present") steps.push({ op: "retire", path, ours: legacy.ours });
      if (legacy.kind === "blocked") steps.push({ op: "blocked", path, reason: legacy.reason });
    }
    const state = inspect(entry, ctx);
    if (state.kind === "ok") steps.push({ op: "keep", entry });
    else if (state.kind === "blocked") steps.push({ op: "blocked", path: entry.dest, reason: state.reason });
    else steps.push({ op: "link", entry, state });
  }
  return steps;
}

/** 退避先: ~/.local/state/dotfiles/backups/<日時>/<ホームからの相対パス> */
export function backupDir(home: string, now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-` +
    `${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
  return join(home, ".local/state/dotfiles/backups", stamp);
}

function moveAway(path: string, ctx: Context, backup: string): string {
  const to = join(backup, relative(ctx.home, path));
  mkdirSync(dirname(to), { recursive: true });
  try {
    renameSync(path, to);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EXDEV") throw e;
    cpSync(path, to, { recursive: true, verbatimSymlinks: true });
    rmSync(path, { recursive: true });
  }
  return to;
}

/**
 * planLink の結果を実行する。blocked が 1 つでもあれば何もせずに例外を投げる。
 * 戻り値は退避したもの（元の場所 → 退避先）。
 */
export function applyLink(steps: readonly Step[], ctx: Context, backup = backupDir(ctx.home)) {
  const blocked = steps.filter((s) => s.op === "blocked");
  if (blocked.length > 0) throw new Error(`張れないリンクがある（${blocked.length} 件）`);

  const moved: { from: string; to: string }[] = [];
  for (const step of steps) {
    if (step.op === "retire") {
      if (step.ours) unlinkSync(step.path);
      else moved.push({ from: step.path, to: moveAway(step.path, ctx, backup) });
    } else if (step.op === "link") {
      const { src, dest } = step.entry;
      if (step.state.kind === "stale") unlinkSync(dest);
      if (step.state.kind === "occupied") moved.push({ from: dest, to: moveAway(dest, ctx, backup) });
      mkdirSync(dirname(dest), { recursive: true });
      symlinkSync(src, dest);
    }
  }
  return moved;
}

/** このリポジトリへのリンクだけを外す。外したリンクの場所を返す */
export function planUnlink(entries: readonly Entry[], ctx: Context): Entry[] {
  return entries.filter((entry) => {
    const state = inspect(entry, ctx);
    return state.kind === "ok" || state.kind === "stale";
  });
}

export function applyUnlink(entries: readonly Entry[]): void {
  for (const entry of entries) unlinkSync(entry.dest);
}
