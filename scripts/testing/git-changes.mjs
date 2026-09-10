import { execFileSync } from "node:child_process";

const git = (root, args, input) => execFileSync("git", args, { cwd: root, encoding: "utf8", input, stdio: ["pipe", "pipe", "pipe"] });
export function changedFiles(root, { base, head } = {}) {
  if (head && !base) throw Error("--head requires --base");
  if (base === "EMPTY") base = git(root, ["hash-object", "-t", "tree", "--stdin"], "").trim();
  // --no-renames retains BOTH owners on cross-domain moves. NUL delimiters support spaces.
  const committed = git(root, ["diff", "--name-only", "--no-renames", "-z", ...(base ? [base, head ?? "HEAD"] : ["HEAD"]), "--"]);
  const untracked = base ? "" : git(root, ["ls-files", "--others", "--exclude-standard", "-z"]);
  return [...new Set((committed + untracked).split("\0").filter(Boolean))].sort();
}
