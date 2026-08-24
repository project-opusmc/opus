<script lang="ts">
  import MainButton from "../../menu/buttons/MainButton.svelte";
  import { bridge } from "../../integration/api";
  import { isStandalone } from "../../integration/host";
  import { close, navigate } from "../../stores/ui";
  import { settingsTab } from "../../stores/settings";

  async function resume() {
    if (isStandalone) {
      navigate("title");
      return;
    }
    await close();
  }

  function options() {
    settingsTab.set("game");
    void navigate({ id: "settings", params: { settingsSection: "game" } });
  }

  async function disconnect() {
    if (isStandalone) {
      navigate("title");
      return;
    }
    await bridge.leaveWorld();
  }
</script>

<div class="game-menu">
  <div class="main-buttons">
    <MainButton title="Resume" subtitle="Back to game" icon="play" onclick={resume} />
    <MainButton title="Options" subtitle="Game & interface" icon="options" onclick={options} />
    <MainButton title="Client" subtitle="Mods · HUD" icon="client" onclick={() => void navigate("mods_catalog")} />
    <MainButton title="Disconnect" subtitle="Leave world" icon="exit" onclick={disconnect} />
  </div>
</div>

<style lang="scss">
  .game-menu {
    position: relative;
    isolation: isolate;
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: space-between;
    min-height: 0;
    gap: 24px;
  }

  .game-menu::before {
    content: "";
    position: fixed;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    background: rgb(0 0 0 / 42%);
    backdrop-filter: blur(5px);
  }

  .main-buttons {
    display: flex;
    flex-direction: column;
    row-gap: 18px;
    align-content: start;
  }

  @media (max-height: 400px) {
    .game-menu { gap: 8px; }
    .main-buttons { row-gap: 6px; }
  }
</style>
