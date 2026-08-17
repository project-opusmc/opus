<script lang="ts">
  import PageShell from "../../components/PageShell.svelte";
  import Button from "../../primitives/Button.svelte";
  import { bridge } from "../../integration/api";
  import { isStandalone } from "../../integration/host";
  import { navigate } from "../../stores/ui";

  async function resume() {
    await bridge.closeScreen();
  }
</script>

<PageShell
  title="Game Menu"
  description="Pause controls mirrored from the Opus client."
  badge="PAUSED"
>
  {#snippet actions()}
    <Button variant="primary" onclick={resume}>Resume Game</Button>
  {/snippet}

  <div class="game-menu__grid">
    <Button full size="lg" onclick={() => navigate("settings")}>
      Game Options
    </Button>
    <Button
      full
      size="lg"
      onclick={async () => {
        if (isStandalone) {
          navigate("title");
        } else {
          await bridge.leaveWorld();
        }
      }}
    >
      Disconnect
    </Button>
  </div>
</PageShell>

<style lang="scss">
  .game-menu__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: var(--space-12);
    max-width: 640px;
  }
</style>
