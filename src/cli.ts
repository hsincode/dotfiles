import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import links from "../links";
import {
  applyLink,
  applyUnlink,
  backupDir,
  inspect,
  inspectLegacy,
  planLink,
  planUnlink,
  resolveEntries,
  tilde,
  type Context,
  type State,
} from "./core";
import { OSES, type OS } from "./types";

const USAGE = `使い方: ./dot <link|unlink|status> [オプション]

  link     設定ファイルへのシンボリックリンクを張る（既にあるものはバックアップへ退避）
  unlink   このリポジトリへのリンクだけを外す
  status   リンクの状態を表示する（すべて揃っていれば終了コード 0）

  -n, --dry-run          何をするかだけ表示して、何も変えない
      --os <linux|macos> OS を指定する（既定は今の OS）
      --home <dir>       ホームディレクトリを指定する（試すとき用）
`;

/** 全角を 2 桁として、表示幅が width になるまで空白で埋める */
function pad(label: string, width: number): string {
  const w = [...label].reduce((n, c) => n + ((c.codePointAt(0) ?? 0) > 0xff ? 2 : 1), 0);
  return label + " ".repeat(Math.max(0, width - w));
}

function currentOS(): OS {
  if (process.platform === "linux") return "linux";
  if (process.platform === "darwin") return "macos";
  throw new Error(`対応していない OS: ${process.platform}`);
}

function main(argv: string[]): number {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      "dry-run": { type: "boolean", short: "n", default: false },
      os: { type: "string" },
      home: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  const command = positionals[0];
  if (values.help || !command) {
    console.log(USAGE);
    return values.help ? 0 : 1;
  }
  if (values.os !== undefined && !OSES.includes(values.os as OS)) {
    console.error(`--os は ${OSES.join(" / ")} のどれか`);
    return 1;
  }

  const ctx: Context = {
    root: realpathSync(join(import.meta.dir, "..")),
    home: resolve(values.home ?? homedir()),
    os: (values.os as OS | undefined) ?? currentOS(),
  };
  const entries = resolveEntries(links, ctx);
  const dry = values["dry-run"];
  const t = (p: string) => tilde(p, ctx.home);
  const srcOf = (p: string) => p.slice(ctx.root.length + 1);

  switch (command) {
    case "link": {
      const steps = planLink(entries, ctx);
      const backup = backupDir(ctx.home);
      for (const s of steps) {
        if (s.op === "keep") console.log(`  ${pad("そのまま", 10)}${t(s.entry.dest)}`);
        else if (s.op === "blocked") console.log(`! ${pad("触れない", 10)}${t(s.path)}: ${s.reason}`);
        else if (s.op === "retire")
          console.log(`  ${pad("退避", 10)}${t(s.path)}${s.ours ? "（古いリンクを外す）" : ` → ${t(join(backup, relative(ctx.home, s.path)))}`}`);
        else {
          const note = s.state.kind === "occupied" ? `（${s.state.what}を退避）` : s.state.kind === "stale" ? "（張り直し）" : "";
          console.log(`  ${pad("リンク", 10)}${t(s.entry.dest)} → ${srcOf(s.entry.src)}${note}`);
        }
      }
      if (steps.some((s) => s.op === "blocked")) {
        console.error("\n触れない場所があるので何も変えていない。DOTFILES.md の「詰まったとき」を参照");
        return 1;
      }
      if (dry) {
        console.log("\n--dry-run なので何も変えていない");
        return 0;
      }
      const moved = applyLink(steps, ctx, backup);
      if (moved.length > 0) console.log(`\n退避したもの: ${t(backup)}`);
      return 0;
    }

    case "unlink": {
      const targets = planUnlink(entries, ctx);
      for (const e of targets) console.log(`  ${pad("外す", 10)}${t(e.dest)}`);
      if (targets.length === 0) console.log("  外すリンクはない");
      if (!dry) applyUnlink(targets);
      return 0;
    }

    case "status": {
      let allOk = true;
      const label: Record<State["kind"], string> = {
        ok: "OK",
        missing: "未作成",
        stale: "古い",
        occupied: "別物",
        blocked: "張れない",
      };
      console.log(`OS: ${ctx.os}   ホーム: ${ctx.home}`);
      for (const e of entries) {
        const state = inspect(e, ctx);
        if (state.kind !== "ok") allOk = false;
        const detail =
          state.kind === "occupied" ? `（${state.what}）` : state.kind === "blocked" ? `（${state.reason}）` : state.kind === "stale" ? `（→ ${state.target}）` : "";
        console.log(`  ${pad(label[state.kind], 10)}${t(e.dest)}${detail}`);
        for (const p of e.replaces) {
          if (inspectLegacy(p, ctx).kind !== "absent") {
            allOk = false;
            console.log(`  ${pad("古い場所", 10)}${t(p)} が残っている（${t(e.dest)} と一緒に、または優先して読まれる）`);
          }
        }
      }
      return allOk ? 0 : 1;
    }

    default:
      console.error(`知らないコマンド: ${command}\n`);
      console.log(USAGE);
      return 1;
  }
}

process.exit(main(Bun.argv.slice(2)));
