import { useState, type FormEvent } from "react";
import { UserRound } from "lucide-react";
import type { AccountView, AuthResponse } from "@catan/protocol";
import { ApiError, type PlayerSession } from "../api.js";
import { loginAccount, registerAccount, logoutAccount, updateAccountProfile, changeAccountPassword } from "../auth-api.js";
import { Button } from "./ui/button.js";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog.js";
import { cn } from "../lib/utils.js";
import { AccountHistory } from "./AccountHistory.js";

interface Props {
  readonly account: AccountView | null;
  readonly session: PlayerSession | null;
  readonly onLogin: (response: AuthResponse) => void;
  readonly onLogout: () => void;
  readonly onProfile: (account: AccountView) => void;
  readonly compact?: boolean;
}
export function AccountControl(props: Props) {
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>
      <Button variant="ghost" size={props.compact ? "icon-sm" : "sm"} aria-label={props.account ? "我的账号" : "登录或注册"}>
        <UserRound />{props.compact ? null : props.account ? "我的账号" : "登录 / 注册（可选）"}
      </Button>
    </DialogTrigger>
    <DialogContent className={cn("max-h-[85dvh] overflow-y-auto", props.account && "sm:max-w-6xl")}>
      <DialogHeader>
        <DialogTitle>{props.account ? "我的账号" : "登录或注册"}</DialogTitle>
        <DialogDescription>游客也可以直接开局。登录后可跨设备接回座位，并保存最终结算。</DialogDescription>
      </DialogHeader>
      {open && <AccountForm {...props} close={() => setOpen(false)} />}
    </DialogContent>
  </Dialog>;
}
function AccountForm({ account, session, onLogin, onLogout, onProfile, close }: Props & { readonly close: () => void }) {
  const [mode, setMode] = useState<"login" | "register" | "profile" | "password" | "history">(account ? "history" : "login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(null); setNotice(null);
    try { await action(); } catch (caught) {
      if (caught instanceof ApiError && caught.code === "AUTH_REQUIRED") { onLogout(); close(); }
      else setError(caught instanceof Error ? caught.message : "请求失败，请重试");
    }
    finally { setBusy(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const value = (key: string) => String(fields.get(key) ?? "");
    void run(async () => {
      if (mode === "login" || mode === "register") {
        const input = { username: value("username"), password: value("password"), ...(session ? { guestSeat: { roomId: session.roomId, seatToken: session.seatToken } } : {}) };
        const response = mode === "register" ? await registerAccount({ ...input, displayName: value("displayName") }) : await loginAccount(input);
        form.reset(); onLogin(response); close();
      } else if (mode === "profile") {
        onProfile(await updateAccountProfile(value("displayName"))); setNotice("显示名称已更新，当前对局中的名称保持原样。");
      } else if (mode === "password") {
        await changeAccountPassword({ currentPassword: value("currentPassword"), newPassword: value("password") });
        form.reset(); onLogout(); close();
      }
    });
  }
  const modes = account ? (["history", "profile", "password"] as const) : (["login", "register"] as const);
  const labels = { login: "登录", register: "注册", profile: "修改名称", password: "修改密码", history: "对局记录" };
  return <div className="grid min-w-0 gap-4">
    {!window.isSecureContext && <p className="rounded border border-amber-500/40 bg-amber-100 p-3 text-sm text-amber-950" role="note">当前连接为 HTTP，密码和登录信息可能被截获。请勿使用其他网站的密码。</p>}
    {account && <p className="break-words text-sm">{account.displayName} · @{account.username}</p>}
    <div className="flex flex-wrap gap-2">{modes.map((next) => <Button key={next} size="sm" variant={mode === next ? "secondary" : "ghost"} disabled={busy} onClick={() => { setMode(next); setError(null); setNotice(null); }}>{labels[next]}</Button>)}</div>
    {mode === "history" ? <AccountHistory /> : <form key={mode} className="grid gap-3" onSubmit={submit}>
      {(mode === "register" || mode === "login") && <Field name="username" label="用户名" autoComplete="username" pattern="[a-zA-Z0-9_]+" help="英文字母、数字或下划线，不区分大小写。" />}
      {(mode === "register" || mode === "profile") && <Field name="displayName" label="账号显示名称" autoComplete="nickname" defaultValue={account?.displayName ?? ""} />}
      {mode === "password" && <Field name="currentPassword" label="当前密码" type="password" autoComplete="current-password" />}
      {mode !== "profile" && <Field name="password" label={mode === "password" ? "新密码" : "密码"} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} help={mode === "login" ? undefined : "修改密码后需重新登录。"} />}
      <Button type="submit" disabled={busy}>{busy ? "正在处理…" : mode === "profile" ? "保存名称" : labels[mode]}</Button>
    </form>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {account && <Button variant="outline" disabled={busy} onClick={() => void run(async () => { await logoutAccount(); onLogout(); close(); })}>退出登录</Button>}
  </div>;
}
function Field({ label, help, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { readonly name: string; readonly label: string; readonly help?: string | undefined }) {
  return <label className="grid gap-1.5 text-sm font-medium">
    {label}<input {...props} required className="h-10 w-full min-w-0 rounded-md border bg-background px-3 text-base font-normal" />
    {help && <span className="text-xs font-normal text-muted-foreground">{help}</span>}
  </label>;
}
