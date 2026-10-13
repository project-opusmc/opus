import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { AccountSummary, ClientInfo } from "../bridge/types";
import { AccountAvatar } from "./AccountAvatar";
import { Button } from "./ui";
import { UiIcon } from "./ui/UiIcon";

export type AccountView = "list" | "settings" | "add";
export type AccountCatalogStatus = "unavailable" | "ready" | "unconfirmed";
export type AccountFeedbackState = { pendingId: string | null; message: string | null; error: string | null };

type AccountProps = {
  client: ClientInfo | null;
  account: AccountSummary | null;
  accounts: AccountSummary[];
  catalog: AccountCatalogStatus;
  loading: boolean;
  feedback: AccountFeedbackState;
  onSelect: (id: string) => void;
};

function accountKind(account: AccountSummary | null, client?: ClientInfo | null) {
  if (account) return account.kind === "microsoft" ? "Microsoft account" : "Offline account";
  if (client) return client.accountKind === "official" ? "Microsoft account" : "Offline account";
  return "Session details unavailable";
}

function AccountFeedback({ feedback }: { feedback: AccountFeedbackState }) {
  return (
    <>
      {feedback.message && <p className="account-feedback" role="status">{feedback.message}</p>}
      {feedback.error && <p className="account-feedback account-feedback--error" role="alert">{feedback.error}</p>}
    </>
  );
}

function AccountRow({ account, pendingId, disabled, selectionKnown, onSelect, compact = false }: {
  account: AccountSummary;
  pendingId: string | null;
  disabled: boolean;
  selectionKnown: boolean;
  onSelect: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <button type="button" className={compact ? `account-option${selectionKnown && account.current ? " is-current" : ""}${pendingId === account.id ? " is-pending" : ""}` : "account-row"} data-opus-account-id={account.id}
      aria-label={`${account.username}, ${!selectionKnown ? "refresh saved accounts to confirm" : account.current ? "active now" : "switch to this account"}`}
      aria-pressed={selectionKnown && account.current} disabled={disabled || !selectionKnown || account.current}
      onClick={() => onSelect(account.id)}>
      <AccountAvatar account={account} size="sm" />
      <span className={compact ? "account-option-copy" : "account-row__copy"}>
        <strong className="account-ign">{account.username}</strong>
        <small>{accountKind(account)}</small>
      </span>
      <span className={compact ? "account-option-state" : "account-row__state"}>
        {pendingId === account.id ? "Switching…" : !selectionKnown ? "Unconfirmed" : account.current ? "In use" : compact ? "Use now" : <UiIcon name="chevron" />}
      </span>
    </button>
  );
}

export function AccountMenu({ client, account, accounts, catalog, loading, feedback, active, onSelect, onManage }: AccountProps & {
  active: boolean;
  onManage: (view: AccountView) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const name = client?.account ?? account?.username ?? "Account";
  const selectionKnown = catalog === "ready";
  const busy = loading || feedback.pendingId !== null;

  const dismiss = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus({ preventScroll: true });
  };

  useLayoutEffect(() => {
    if (!active) setOpen(false);
    else if (open) panel.current?.focus({ preventScroll: true });
    // Opt-in headless CEF probe; never logs profile names or credentials.
    if (new URLSearchParams(window.location.search).get("opusMediaProbe") === "1") {
      console.info(`OPUS_ACCOUNT_MENU open=${open && active}`);
      const element = panel.current;
      const bounds = element?.getBoundingClientRect();
      const style = element ? getComputedStyle(element) : null;
      console.info(`OPUS_ACCOUNT_DOM ${JSON.stringify({
        viewport: [innerWidth, innerHeight, devicePixelRatio],
        bounds: bounds ? [bounds.x, bounds.y, bounds.width, bounds.height] : null,
        background: style?.backgroundColor,
        display: style?.display,
        visibility: style?.visibility,
        focused: document.activeElement === element,
        documentFocused: document.hasFocus(),
      })}`);
    }
  }, [open, active]);

  useLayoutEffect(() => {
    if (new URLSearchParams(window.location.search).get("opusMediaProbe") !== "1") return;
    const selectable = panel.current?.querySelectorAll("[data-opus-account-id]:not(:disabled)").length ?? 0;
    console.info(`OPUS_ACCOUNT_READY ready=${open && active && !busy && selectionKnown} selectable=${selectable} focused=${document.activeElement === panel.current}`);
  }, [open, active, busy, selectionKnown, accounts]);

  useEffect(() => {
    if (!open || !active) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) dismiss();
    };
    const onFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) dismiss();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      dismiss(true);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, active]);

  const manage = (view: AccountView) => { dismiss(); onManage(view); };

  return (
    <div className="account-switcher" ref={root} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) dismiss();
    }}>
      <button type="button" className="account-trigger" ref={trigger} disabled={!active}
        data-opus-home-action="accounts" aria-label={`Account: ${name}`} title={name}
        aria-haspopup="dialog" aria-expanded={open && active} aria-controls={open && active ? panelId : undefined}
        onClick={() => open ? dismiss(true) : setOpen(true)}
        onKeyDown={event => {
          if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); }
        }}>
        <AccountAvatar account={account} />
        <span className="identity-copy"><span className="identity-name account-ign">{name}</span><span className="identity-caption">{feedback.pendingId ? "Switching account…" : accountKind(account, client)}</span></span>
        <UiIcon name="chevron" />
      </button>
      {open && active && (
        <div className="account-panel" id={panelId} ref={panel} role="dialog" aria-label="Account menu" tabIndex={-1}>
          <header className="account-panel-heading">
              <div><h2>Accounts</h2><span>{selectionKnown ? `${accounts.length} saved` : "Saved accounts"}</span></div>
              <button type="button" className="account-dismiss" aria-label="Close account menu" onClick={() => dismiss(true)}>
                <UiIcon name="close" />
              </button>
          </header>
            <section className="account-list" aria-label="Added accounts" aria-busy={busy}>
              {loading && <p className="account-menu__hint" role="status">Reading saved accounts…</p>}
              {!loading && catalog === "unavailable" && <p className="account-menu__empty">Saved accounts unavailable. Open Manage Accounts to refresh.</p>}
              {!loading && selectionKnown && accounts.length === 0 && <p className="account-menu__empty">No saved accounts yet. Add one in Opus Launcher.</p>}
              {accounts.map(item => <AccountRow compact key={item.id} account={item} pendingId={feedback.pendingId}
                disabled={busy} selectionKnown={selectionKnown} onSelect={id => {
                  // Keep focus inside the disclosure before disabling the row.
                  // Otherwise Chromium blurs a disabled button to the document.
                  panel.current?.focus({ preventScroll: true });
                  onSelect(id);
                }} />)}
            </section>
          <div className="account-feedback" aria-live="polite"><p role={feedback.error ? "alert" : "status"}>{feedback.error ?? feedback.message ?? "Choose an account. Your Client stays open."}</p></div>
          <footer className="account-panel-footer"><button type="button" className="text-button" data-opus-account-manage onClick={() => manage("list")}>Manage Accounts</button><button type="button" className="text-button" onClick={() => manage("add")}>Add account</button></footer>
        </div>
      )}
    </div>
  );
}

export function AccountsRoute({ client, account, accounts, catalog, loading, feedback, onSelect, view, onView, onRefresh }: AccountProps & {
  view: AccountView;
  onView: (view: AccountView) => void;
  onRefresh: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const selectionKnown = catalog === "ready";
  const selected = selectionKnown ? accounts.find(item => item.current) : undefined;
  const name = client?.account ?? account?.username ?? "Unknown";
  const busy = loading || feedback.pendingId !== null;

  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [view]);

  // A disabled focused button loses focus in Chromium. Hand off before the
  // async state update so keyboard navigation/Escape stays in this route.
  const select = (id: string) => { heading.current?.focus({ preventScroll: true }); onSelect(id); };
  const refresh = () => { heading.current?.focus({ preventScroll: true }); onRefresh(); };

  return (
    <section className="accounts-page" onKeyDownCapture={event => {
      if (event.key === "Escape" && view !== "list") {
        event.preventDefault(); event.stopPropagation(); onView("list");
      }
    }}>
      <header className="accounts-page__heading">
        <div>
          <h1 ref={heading} tabIndex={-1}>{view === "add" ? "Add in Opus Launcher" : view === "settings" ? "Account Settings" : "Accounts"}</h1>
          <p>{view === "add" ? "Sign-in stays in your launcher. Your game stays here."
            : "Manage your saved accounts and current session."}</p>
        </div>
        {view === "list" ? <Button onClick={() => onView("add")}><UiIcon name="plus" />Add account</Button>
          : <Button variant="ghost" onClick={() => onView("list")}><UiIcon name="back" />Back to accounts</Button>}
      </header>

      {view === "add" ? (
        <div className="accounts-page__guide">
          <ol>
            <li><strong>Open Opus Launcher</strong><p>Open the Account menu in the launcher, then choose Add account.</p></li>
            <li><strong>Add your account</strong><p>Sign in with Microsoft or enter an offline IGN exactly as you want it saved.</p></li>
            <li><strong>Return to your client</strong><p>Refresh the saved accounts below. Choose your account here to switch without restarting Minecraft.</p></li>
          </ol>
          <p className="accounts-page__note">New sign-in is managed by Opus Launcher.</p>
          <Button disabled={busy} onClick={refresh}><UiIcon name="refresh" />{loading ? "Refreshing…" : "Refresh accounts"}</Button>
          <AccountFeedback feedback={feedback} />
        </div>
      ) : (
        <>
          <div className="accounts-page__session" data-opus-account-current>
            <AccountAvatar account={account} size="lg" />
            <div><span className="account-kicker">Current game session</span><h2 className="account-ign">{name}</h2><p>{accountKind(account, client)}</p></div>
          </div>
          {view === "settings" ? (
            <div className="accounts-page__details">
              <dl><div><dt>In-game name</dt><dd className="account-ign">{name}</dd></div>
                <div><dt>Account type</dt><dd>{accountKind(account, client)}</dd></div>
                <div><dt>Next launch</dt><dd className="account-ign">{selectionKnown ? selected?.username ?? "Not selected" : "Unavailable — refresh saved accounts"}</dd></div></dl>
              <p className="accounts-page__note">Sign-in, profile changes and removal are managed in Opus Launcher.</p>
              <Button onClick={() => onView("list")}><UiIcon name="users" />Manage Accounts</Button>
            </div>
          ) : (
            <section className="accounts-page__saved" aria-labelledby="saved-accounts-title">
              <div className="accounts-page__section-heading"><h2 id="saved-accounts-title">Saved accounts</h2>
                <Button size="sm" variant="ghost" disabled={busy} onClick={refresh}><UiIcon name="refresh" />{loading ? "Refreshing…" : "Refresh"}</Button>
              </div>
              <p className="accounts-page__note">Choose an account to use immediately. Disconnect from your world first.</p>
              {loading && <p role="status">Reading saved accounts…</p>}
              {!loading && catalog === "unavailable" && <p className="account-menu__empty">Saved accounts unavailable. Refresh to try again.</p>}
              {!loading && selectionKnown && accounts.length === 0 && <p className="account-menu__empty">No saved accounts. Add one in Opus Launcher, then refresh this list.</p>}
              <div className="accounts-page__list">
                {accounts.map(item => <AccountRow key={item.id} account={item} pendingId={feedback.pendingId}
                  disabled={busy} selectionKnown={selectionKnown} onSelect={select} />)}
              </div>
              <AccountFeedback feedback={feedback} />
            </section>
          )}
        </>
      )}
    </section>
  );
}
