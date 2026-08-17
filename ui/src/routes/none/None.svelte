<script lang="ts">
  import { onMount } from "svelte";
  import { bridge } from "../../integration/api";
  import { asRouteId, navigate } from "../../stores/ui";

  onMount(async () => {
    const screen = await bridge.getVirtualScreen();
    navigate(asRouteId(screen.name));
  });
</script>

<main class="none">
  <span class="text-secondary motion-pulse">In game — Opus UI suspended</span>
</main>

<style lang="scss">
  .none {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    background: var(--surface-0);
    color: var(--text-muted);
  }
</style>
