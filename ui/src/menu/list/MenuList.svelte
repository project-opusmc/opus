<script lang="ts">
  import type { Snippet } from "svelte";
  interface Props { children?: Snippet; }
  let { children }: Props = $props();
</script>

<div class="menu-list">
  <div class="menu-list-items">
    {@render children?.()}
  </div>
</div>

<style lang="scss">
  .menu-list {
    background-color: var(--menu-list-background-color);
    flex: 1;
    border-radius: var(--radius-control);
    position: relative;
    min-height: 0;
  }

  // Match LiquidBounce: the scroll area is inset with even padding all round.
  .menu-list-items {
    position: absolute;
    inset: 14px 0;
    padding: 0 22px;
    height: calc(100% - 28px);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
    row-gap: 12px;
  }
</style>
