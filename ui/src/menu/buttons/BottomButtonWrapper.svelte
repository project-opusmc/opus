<script lang="ts">
  import type { Snippet } from "svelte";
  interface Props { children?: Snippet; }
  let { children }: Props = $props();
</script>

<div class="bottom-button-wrapper">
  {@render children?.()}
</div>

<style lang="scss">
  .bottom-button-wrapper {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    flex: none;
  }
</style>
