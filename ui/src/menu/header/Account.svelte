<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "../Icon.svelte";
  import { api, bridge } from "../../integration/api";
  import { isStandalone } from "../../integration/host";
  import type { Account } from "../../integration/types";
  import { navigate } from "../../stores/ui";

  // Compact account chip (LiquidBounce header account, decluttered): avatar +
  // name + type, one quick-switch popover, and a single "manage" affordance
  // that jumps to the full Accounts screen. No duplicated action rail.
  let accounts: Account[] = $state([]);
  let expanded = $state(false);
  let error = $state("");
  let root: HTMLElement;

  let active = $derived(
    accounts.find((account) => account.active) ?? accounts[0],
  );
  let others = $derived(accounts.filter((account) => account.id !== active?.id));

  async function loadAccounts() {
    error = "";
    try {
      if (isStandalone) {
        accounts = await api.getAccounts();
        return;
      }
      const hello = await bridge.hello();
      accounts = hello.session
        ? [{
            id: "current",
            username: hello.session,
            // The launcher can start an offline identity without a Microsoft
            // token. Keep the bridge's authoritative account kind instead of
            // inferring "official" from the presence of a username.
            kind: hello.accountKind,
            active: true,
          }]
        : [];
    } catch (failure) {
      accounts = [];
      error = failure instanceof Error ? failure.message : "Bridge unavailable";
    }
  }

  onMount(() => {
    void loadAccounts();
  });

  function use(id: string) {
    accounts = accounts.map((account) => ({
      ...account,
      active: account.id === id,
    }));
    expanded = false;
  }

  function monogram(name: string) {
    return name.trim().slice(0, 1).toUpperCase() || "?";
  }

  function onWindowClick(event: MouseEvent) {
    if (root && !root.contains(event.target as Node)) {
      expanded = false;
    }
  }
</script>

<svelte:window onclick={onWindowClick} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="account" class:expanded bind:this={root}>
  <div class="header" onclick={() => (expanded = !expanded)}>
    <span class="avatar">{monogram(active?.username ?? "?")}</span>
    <span class="username">{active?.username ?? "No account"}</span>
    <span class="type" class:premium={active?.kind === "official"}>
      {error ? "Bridge unavailable" : active ? (active.kind === "official" ? "Current session" : "Offline") : "No session"}
    </span>
    {#if isStandalone}<button
      class="manage"
      type="button"
      aria-label="Manage accounts"
      onclick={(event) => {
        event.stopPropagation();
        navigate("accounts");
      }}
    >
      <Icon name="pen" size={20} />
    </button>{/if}
  </div>

  {#if expanded && isStandalone}
    <div class="switcher">
      {#if others.length > 0}
        {#each others as account (account.id)}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div class="switch-item" onclick={() => use(account.id)}>
            <span class="avatar sm">{monogram(account.username)}</span>
            <span class="name">{account.username}</span>
            <span class="chip">{account.kind === "official" ? "MS" : "Offline"}</span>
          </div>
        {/each}
      {:else}
        <div class="placeholder">No other accounts</div>
      {/if}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div class="switch-item add" onclick={() => navigate("accounts")}>
        <span class="avatar sm add-mark"><Icon name="plus" size={18} /></span>
        <span class="name">Manage accounts</span>
      </div>
    </div>
  {/if}
</div>

<style lang="scss">
  .account {
    position: relative;
    width: 320px;

    &.expanded .header { border-radius: var(--radius-control) var(--radius-control) 0 0; }
  }

  .header {
    background-color: var(--menu-account-header-background-color);
    padding: 12px 14px;
    border-radius: var(--radius-control);
    align-items: center;
    display: grid;
    grid-template-areas:
      "a b c"
      "a d c";
    grid-template-columns: max-content 1fr max-content;
    column-gap: 12px;
    cursor: pointer;
  }

  .avatar {
    grid-area: a;
    height: 44px;
    width: 44px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--accent-color) 26%, black);
    color: var(--menu-text-color);
    font-weight: 700;
    font-size: 18px;

    &.sm { height: 32px; width: 32px; font-size: 14px; }
    &.add-mark { background: var(--accent-color); }
  }

  .username {
    grid-area: b;
    font-weight: 600;
    color: var(--menu-text-color);
    font-size: 16px;
    align-self: flex-end;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .type {
    grid-area: d;
    font-weight: 500;
    font-size: 13px;
    align-self: flex-start;
    color: var(--menu-text-dimmed-color);

    &.premium { color: var(--menu-account-premium-color); }
  }

  .manage {
    grid-area: c;
    background: transparent;
    border: none;
    color: var(--menu-text-color);
    display: flex;
    align-items: center;
    cursor: pointer;
    transition: color 0.2s ease;

    &:hover { color: var(--accent-color); }
  }

  .switcher {
    position: absolute;
    z-index: 1000;
    width: 100%;
    border-radius: 0 0 var(--radius-control) var(--radius-control);
    background-color: var(--menu-account-switcher-background-color);
    overflow: hidden;
  }

  .switch-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    cursor: pointer;
    color: var(--menu-text-dimmed-color);
    transition: color 0.2s ease, background-color 0.2s ease;

    &:hover {
      color: var(--menu-text-color);
      background-color: color-mix(in srgb, var(--accent-color) 16%, transparent);
    }

    .name { flex: 1; font-weight: 500; }
    .chip {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: var(--radius-pill);
      background: var(--menu-list-tag-background-color);
      color: var(--menu-text-color);
    }
  }

  .placeholder {
    padding: 12px 14px;
    color: var(--menu-text-dimmed-color);
    font-size: 14px;
  }

  @media (max-height: 600px) {
    .account { width: 260px; }

    .header { padding: 7px 10px; }
    .avatar { height: 36px; width: 36px; font-size: 15px; }
    .username { font-size: 14px; }
    .type { font-size: 11px; }
  }
</style>
