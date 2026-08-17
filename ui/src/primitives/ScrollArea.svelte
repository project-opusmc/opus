<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    class?: string;
    children?: Snippet;
  }

  let { class: className = "", children }: Props = $props();
</script>

<div class="scroll-area {className}">
  <div class="scroll-area__viewport">
    {@render children?.()}
  </div>
</div>

<style lang="scss">
  .scroll-area {
    min-height: 0;
    min-width: 0;
    position: relative;
  }

  .scroll-area__viewport {
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    padding-right: var(--space-4);
  }
</style>
