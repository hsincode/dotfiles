export type OS = "linux" | "macos";

export const OSES: readonly OS[] = ["linux", "macos"];

/** 文字列なら全 OS 共通。オブジェクトなら書いた OS だけで使い、書いていない OS では項目ごと飛ばす */
export type PerOS = string | Partial<Record<OS, string>>;

export interface Link {
  /** リポジトリの config/ からの相対パス（ファイルでもディレクトリでもよい） */
  src: PerOS;
  /** リンクを置く場所。~/ から書く */
  dest: PerOS;
  /** dest より優先して読まれてしまう古い置き場所（~/ から）。link のときバックアップへ退避する */
  replaces?: string[];
}
