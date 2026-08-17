<script lang="ts">
  import type { Snippet } from "svelte";

  interface TabItem {
    id: string;
    label: string;
  }

  interface Props {
    items: TabItem[];
    active?: string;
    class?: string;
    onchange?: (id: string) => void;
    children?: Snippet<[{ active: string }]>;
  }

  let {
    items,
    active = $bindable(items[0]?.id ?? ""),
    class: className = "",
    onchange,
    children,
  }: Props = $props();
</script>

<div class="tabs {className}">
  <div class="tabs__list" role="tablist">
    {#each items as item (item.id)}
      <button
        type="button"
        role="tab"
        class="tabs__tab"
        class:tabs__tab--active={active === item.id}
        aria-selected={active === item.id}
        onclick={() => {
          active = item.id;
          onchange?.(item.id);
        }}
      >
        {item.label}
      </button>
    {/each}
  </div>
  <div class="tabs__panel" role="tabpanel">
    {#if children}
      {@render children({ active })}
    {/if}
  </div>
</div>

<style lang="scss">
  .tabs {
    display: flex;
    flex-direction: column;
    gap: var(--space-16);
  }

  .tabs__list {
    display: flex;
    gap: var(--space-4);
    border-bottom: 1px solid var(--border-subtle);
  }

  .tabs__tab {
    position: relative;
    height: var(--control-height-md);
    padding: 0 var(--space-16);
    border-radius: var(--radius-control) var(--radius-control) 0 0;
    color: var(--text-muted);
    font-size: var(--text-13);
    font-weight: 500;
    transition:
      color var(--motion-fast) var(--ease-standard),
      background-color var(--motion-fast) var(--ease-standard);
  }

  .tabs__tab:hover {
    color: var(--text-primary);
    background: var(--panel-hover-background);
  }

  .tabs__tab--active {
    color: var(--text-primary);
  }

  .tabs__tab--active::after {
    content: "";
    position: absolute;
    left: var(--space-8);
    right: var(--space-8);
    bottom: -1px;
    height: 2px;
    border-radius: var(--radius-pill);
    background: var(--accent);
  }

  .tabs__panel {
    min-width: 0;
  }
</style>
