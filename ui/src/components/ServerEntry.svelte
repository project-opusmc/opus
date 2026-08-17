<script lang="ts">
  import Badge from "../primitives/Badge.svelte";
  import type { Server } from "../integration/types";

  interface Props {
    server: Server;
    selected?: boolean;
    onselect?: () => void;
  }

  let { server, selected = false, onselect }: Props = $props();

  let stateLabel = $derived(
    server.state === "online"
      ? "Online"
      : server.state === "offline"
        ? "Offline"
        : server.state === "connecting"
          ? "Connecting"
          : "Pinging",
  );
</script>

<button
  type="button"
  class="server-entry"
  class:server-entry--selected={selected}
  onclick={onselect}
>
  <div class="server-entry__main">
    <span class="server-entry__name text-control">{server.name}</span>
    <span class="server-entry__address text-metadata">{server.address}</span>
  </div>
  <div class="server-entry__meta">
    {#if server.latencyMs != null}
      <span class="server-entry__latency text-metadata">
        {server.latencyMs} ms
      </span>
    {/if}
    <Badge
      tone={server.state === "online"
        ? "success"
        : server.state === "connecting"
          ? "accent"
          : "neutral"}
    >
      {#if server.state === "pinging"}
        <span class="server-entry__pulse"></span>
      {/if}
      {stateLabel}
    </Badge>
  </div>
</button>

<style lang="scss">
  .server-entry {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-16);
    width: 100%;
    padding: var(--space-12) var(--space-16);
    border-radius: var(--radius-card);
    border: 1px solid var(--border-subtle);
    background: var(--panel-background);
    text-align: left;
    transition:
      background-color var(--motion-fast) var(--ease-standard),
      border-color var(--motion-fast) var(--ease-standard);
  }

  .server-entry:hover {
    background: var(--panel-hover-background);
    border-color: var(--border-strong);
  }

  .server-entry--selected {
    background: var(--panel-hover-background);
    border-color: var(--accent);
  }

  .server-entry__main {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    min-width: 0;
  }

  .server-entry__name {
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .server-entry__address {
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .server-entry__meta {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    flex: none;
  }

  .server-entry__latency {
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }

  .server-entry__pulse {
    width: 6px;
    height: 6px;
    border-radius: var(--radius-pill);
    background: currentColor;
    animation: opus-pulse var(--motion-medium) ease-in-out infinite;
  }
</style>
