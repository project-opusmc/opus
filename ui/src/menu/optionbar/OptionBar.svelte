<script lang="ts">
  import type { Snippet } from "svelte";
  interface Props { children?: Snippet; }
  let { children }: Props = $props();
</script>

<div class="option-bar">
  {@render children?.()}
</div>

<style lang="scss">
  .option-bar {
    background-color: var(--menu-option-bar-background-color);
    padding: 12px 22px;
    display: flex;
    border-radius: var(--radius-control);
    align-items: center;
    column-gap: 22px;
    flex: none;
  }
</style>
