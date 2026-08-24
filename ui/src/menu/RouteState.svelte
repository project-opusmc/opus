<script lang="ts">
  interface Props {
    loading?: boolean;
    error?: string;
    empty?: string;
    retry?: () => void | Promise<void>;
  }

  let { loading = false, error = "", empty = "", retry }: Props = $props();
</script>

{#if loading}
  <div class="route-state" aria-live="polite">Loading…</div>
{:else if error}
  <div class="route-state route-state--error" role="alert">
    <span>{error}</span>
    {#if retry}
      <button type="button" onclick={() => void retry?.()}>Retry</button>
    {/if}
  </div>
{:else if empty}
  <div class="route-state">{empty}</div>
{/if}

<style lang="scss">
  .route-state {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    min-height: 64px;
    padding: 20px 4px;
    color: var(--menu-text-dimmed-color);
    font-size: 15px;
  }

  .route-state--error { color: var(--error-color); }

  button {
    flex: none;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-control);
    padding: 8px 14px;
    background: var(--menu-button-background-color);
    color: var(--menu-text-color);
    font: inherit;
    cursor: pointer;
  }

  button:hover { background: var(--menu-button-hover-background-color); }
</style>
