<script lang="ts">
  import type { Snippet } from "svelte";
  interface Props { children?: Snippet; class?: string; }
  let { children, class: className = "" }: Props = $props();
</script>

<div class="button-container {className}">
  {@render children?.()}
</div>

<style lang="scss">
  .button-container {
    background-color: var(--menu-button-container-background-color);
    padding: 10px 18px;
    width: max-content;
    border-radius: var(--radius-control);
    display: flex;
    column-gap: 14px;
    align-items: center;
  }

  @media (max-height: 600px) {
    .button-container { padding: 4px 10px; column-gap: 8px; }
  }
</style>
