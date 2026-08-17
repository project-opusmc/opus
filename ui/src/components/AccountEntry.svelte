<script lang="ts">
  import Badge from "../primitives/Badge.svelte";
  import type { Account } from "../integration/types";

  interface Props {
    account: Account;
    selected?: boolean;
    onselect?: () => void;
    onremove?: () => void;
  }

  let { account, selected = false, onselect, onremove }: Props = $props();

  let kindLabel = $derived(
    account.kind === "official"
      ? "Official"
      : account.kind === "demo"
        ? "Demo"
        : "Unofficial",
  );

  let tone = $derived(
    account.kind === "official"
      ? ("success" as const)
      : account.kind === "demo"
        ? ("warning" as const)
        : ("neutral" as const),
  );
</script>

<div
  class="account-entry"
  class:account-entry--selected={selected}
  role="button"
  tabindex="0"
  onclick={onselect}
  onkeydown={(event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onselect?.();
    }
  }}
>
  <div class="account-entry__avatar" aria-hidden="true">
    {account.username.slice(0, 1).toUpperCase()}
  </div>
  <div class="account-entry__main">
    <span class="account-entry__username text-control">{account.username}</span>
    <span class="account-entry__label text-metadata">{account.label}</span>
  </div>
  <div class="account-entry__meta">
    <Badge tone={tone}>{kindLabel}</Badge>
    {#if onremove}
      <button
        type="button"
        class="account-entry__remove"
        aria-label={`Remove ${account.username}`}
        onclick={(event) => {
          event.stopPropagation();
          onremove();
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    {/if}
  </div>
</div>

<style lang="scss">
  .account-entry {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    width: 100%;
    padding: var(--space-12) var(--space-16);
    border-radius: var(--radius-card);
    border: 1px solid var(--border-subtle);
    background: var(--panel-background);
    cursor: pointer;
    transition:
      background-color var(--motion-fast) var(--ease-standard),
      border-color var(--motion-fast) var(--ease-standard);
  }

  .account-entry:hover {
    background: var(--panel-hover-background);
    border-color: var(--border-strong);
  }

  .account-entry--selected {
    border-color: var(--accent);
  }

  .account-entry__avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    flex: none;
    border-radius: var(--radius-card);
    border: 1px solid var(--border-subtle);
    background: var(--surface-3);
    color: var(--text-secondary);
    font-size: var(--text-14);
    font-weight: 600;
  }

  .account-entry__main {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }

  .account-entry__username {
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .account-entry__label {
    color: var(--text-muted);
  }

  .account-entry__meta {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    flex: none;
  }

  .account-entry__remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-control);
    color: var(--text-muted);
    transition:
      color var(--motion-fast) var(--ease-standard),
      background-color var(--motion-fast) var(--ease-standard);
  }

  .account-entry__remove:hover {
    color: var(--danger);
    background: var(--panel-hover-background);
  }
</style>
