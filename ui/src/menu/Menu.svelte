<script lang="ts">
  import type { Snippet } from "svelte";
  import Header from "./header/Header.svelte";
  interface Props { children?: Snippet; }
  let { children }: Props = $props();
</script>

<!-- The menu shell: fixed padded frame like LiquidBounce, header on top, the
     routed screen fills the rest. No JS enter/leave transitions here: the
     embedded offscreen WebView throttles rAF so a stalled transition would
     overlay the old page and eat pointer events (the old "tan nát" bug). -->
<div class="menu">
  <Header />
  <div class="menu-content">
    {@render children?.()}
  </div>
</div>

<style lang="scss">
  .menu {
    padding: 40px 44px;
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  .menu-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  // Preserve LiquidBounce's small-window scaling so the layout never crushes.
  @media (max-width: 1100px) {
    .menu { padding: 28px 30px; }
  }

  @media (max-height: 720px) {
    .menu { padding: 24px 30px; }
  }

  @media (max-height: 600px) {
    .menu { padding: 16px 22px; }
  }
</style>
