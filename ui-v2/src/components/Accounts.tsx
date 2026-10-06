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

function AccountRow({ account, pendingId, disabled, selectionKnown, onSelect }: {
  account: AccountSummary;
  pendingId: string | null;
  disabled: boolean;
  selectionKnown: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button type="button" className="account-row" data-opus-account-id={account.id}
      aria-label={`${account.username}, ${!selectionKnown ? "refresh saved accounts to confirm" : account.selected ? "selected for next launch" : "use for next launch"}`}
      aria-pressed={selectionKnown && account.selected} disabled={disabled || !selectionKnown || account.selected}
      onClick={() => onSelect(account.id)}>
      <AccountAvatar account={account} size="sm" />
      <span className="account-row__copy">
        <strong className="account-ign">{account.username}</strong>
        <small>{accountKind(account)}{account.current ? " · Playing now" : ""}</small>
      </span>
      <span className="account-row__state">
        {pendingId === account.id ? "Saving…" : !selectionKnown ? "Unconfirmed" : account.selected ? "Next launch" : <UiIcon name="chevron" />}
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
  const others = accounts.filter(item => item.id !== account?.id);
  const selectionKnown = catalog === "ready";
  const selected = selectionKnown ? accounts.find(item => item.selected) : undefined;
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
    <div className="account-menu" ref={root} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) dismiss();
    }}>
      <button type="button" className="home__profile" ref={trigger}
        data-opus-home-action="accounts" aria-label={`Account: ${name}`} title={name}
        aria-haspopup="dialog" aria-expanded={open && active} aria-controls={open && active ? panelId : undefined}
        onClick={() => open ? dismiss(true) : setOpen(true)}
        onKeyDown={event => {
          if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); }
        }}>
        <AccountAvatar account={account} />
        <span className="home__profile-name account-ign">{name}</span>
        <UiIcon name="chevron" />
      </button>
      {open && active && (
        <div className="account-menu__panel" id={panelId} ref={panel} role="dialog" aria-label="Account menu" tabIndex={-1}>
          <div className="account-menu__scroll">
            <div className="account-menu__identity">
              <AccountAvatar account={account} size="lg" />
              <div className="account-menu__identity-copy">
                <span className="account-kicker">Playing now</span>
                <strong className="account-ign">{name}</strong>
                <small>{accountKind(account, client)}</small>
              </div>
              <button type="button" className="account-menu__dismiss" aria-label="Close account menu" onClick={() => dismiss(true)}>
                <UiIcon name="close" />
              </button>
            </div>
            <Button block className="account-menu__settings" onClick={() => manage("settings")}>
              <UiIcon name="settings" />Account Settings
            </Button>
            <section className="account-menu__others" aria-labelledby={`${panelId}-others`}>
              <div className="account-menu__section-heading">
                <h2 id={`${panelId}-others`}>Other Accounts</h2>
                <Button size="sm" variant="ghost" onClick={() => manage("add")} aria-label="Add account">
                  <UiIcon name="plus" />Add
                </Button>
              </div>
              <p className="account-menu__hint">Choose an account for the next launch.</p>
              {loading && <p className="account-menu__hint" role="status">Reading saved accounts…</p>}
              {!loading && catalog === "unavailable" && <p className="account-menu__empty">Saved accounts unavailable. Open Manage Accounts to refresh.</p>}
              {!loading && selectionKnown && others.length === 0 && <p className="account-menu__empty">No other accounts yet. Add one in Opus Launcher.</p>}
              {others.map(item => <AccountRow key={item.id} account={item} pendingId={feedback.pendingId}
                disabled={busy} selectionKnown={selectionKnown} onSelect={id => {
                  // Keep focus inside the disclosure before disabling the row.
                  // Otherwise Chromium blurs a disabled button to the document.
                  panel.current?.focus({ preventScroll: true });
                  onSelect(id);
                }} />)}
            </section>
            <AccountFeedback feedback={feedback} />
            {selected && !feedback.message && <p className="account-menu__next">Next launch: <strong className="account-ign">{selected.username}</strong></p>}
          </div>
          <div className="account-menu__footer">
            <Button block onClick={() => manage("list")}><UiIcon name="users" />Manage Accounts</Button>
          </div>
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
  const selected = selectionKnown ? accounts.find(item => item.selected) : undefined;
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
            : "Keep your current session and your next launch separate."}</p>
        </div>
        {view === "list" ? <Button onClick={() => onView("add")}><UiIcon name="plus" />Add account</Button>
          : <Button variant="ghost" onClick={() => onView("list")}><UiIcon name="back" />Back to accounts</Button>}
      </header>

      {view === "add" ? (
        <div className="accounts-page__guide">
          <ol>
            <li><strong>Open Opus Launcher</strong><p>Open the Account menu in the launcher, then choose Add account.</p></li>
            <li><strong>Add your account</strong><p>Sign in with Microsoft or enter an offline IGN exactly as you want it saved.</p></li>
            <li><strong>Return to your client</strong><p>Refresh the saved accounts below. Your choice applies the next time Minecraft launches.</p></li>
          </ol>
          <p className="accounts-page__note">Your current game session stays unchanged.</p>
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
              <p className="accounts-page__note">Selecting here does not change the session you are playing.</p>
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
