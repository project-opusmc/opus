<script lang="ts">
  import { onMount } from "svelte";
  import { fade, slide } from "svelte/transition";
  import { bridge } from "./integration/api";
  import { isStandalone } from "./integration/host";
  import { connectBridge, disconnectBridge, listen } from "./integration/ws";
  import Title from "./routes/title/Title.svelte";
  import Singleplayer from "./routes/singleplayer/Singleplayer.svelte";
  import Multiplayer from "./routes/multiplayer/Multiplayer.svelte";
  import Settings from "./routes/settings/Settings.svelte";
  import Accounts from "./routes/accounts/Accounts.svelte";
  import HudEditor from "./routes/hud/HudEditor.svelte";
  import GameMenu from "./routes/game-menu/GameMenu.svelte";
  import None from "./routes/none/None.svelte";
  import {
    asRouteId,
    initHashRoute,
    navigate,
    route,
    routes,
  } from "./stores/ui";

  let currentRoute = $derived($route);

  async function syncFromBridge(name: string) {
    navigate(asRouteId(name));
    await bridge.confirmVirtualScreen(name || "none");
  }

  onMount(() => {
    initHashRoute();
    if (isStandalone) {
      return;
    }

    connectBridge();
    const offReady = listen("socketReady", async () => {
      const screen = await bridge.getVirtualScreen();
      await syncFromBridge(screen.name);
    });
    const offScreen = listen("virtualScreen", async (event: {
      screenName: string;
      action: "open" | "close";
    }) => {
      if (event.action === "close") {
        await syncFromBridge("");
      } else {
        await syncFromBridge(event.screenName);
      }
    });

    return () => {
      offReady();
      offScreen();
      disconnectBridge();
    };
  });
</script>

<div class="app">
  {#if isStandalone}
    <aside class="app__rail" aria-label="Preview routes">
      <div class="app__rail-brand">
        <span class="app__rail-mark" aria-hidden="true"></span>
        <span class="text-control">OPUS UI</span>
      </div>
      <nav class="app__rail-nav">
        {#each routes as item (item.id)}
          <button
            type="button"
            class="app__rail-item"
            class:app__rail-item--active={currentRoute === item.id}
            onclick={() => navigate(item.id)}
          >
            {item.label}
          </button>
        {/each}
      </nav>
      <span class="app__rail-note text-metadata">standalone preview</span>
    </aside>
  {/if}

  <main class="app__stage">
    {#key currentRoute}
      <div
        class="app__page"
        in:slide={{ duration: 240 }}
        out:fade={{ duration: 160 }}
      >
        {#if currentRoute === "title"}
          <Title />
        {:else if currentRoute === "singleplayer"}
          <Singleplayer />
        {:else if currentRoute === "multiplayer"}
          <Multiplayer />
        {:else if currentRoute === "settings"}
          <Settings />
        {:else if currentRoute === "accounts"}
          <Accounts />
        {:else if currentRoute === "hud"}
          <HudEditor />
        {:else if currentRoute === "game_menu"}
          <GameMenu />
        {:else if currentRoute === "none"}
          <None />
        {/if}
      </div>
    {/key}
  </main>
</div>

<style lang="scss">
  .app {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    height: 100%;
    min-height: 0;
    background: var(--surface-0);
  }

  .app:has(> .app__rail) {
    grid-template-columns: 216px minmax(0, 1fr);
  }

  .app__rail {
    display: flex;
    flex-direction: column;
    gap: var(--space-24);
    padding: var(--space-20) var(--space-16);
    border-right: 1px solid var(--border-subtle);
    background: var(--surface-0);
  }

  .app__rail-brand {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    padding: 0 var(--space-8);
  }

  .app__rail-mark {
    width: 20px;
    height: 20px;
    border-radius: var(--radius-control);
    background: var(--accent);
  }

  .app__rail-nav {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .app__rail-item {
    display: flex;
    align-items: center;
    height: var(--control-height-md);
    padding: 0 var(--space-12);
    border-radius: var(--radius-control);
    color: var(--text-muted);
    font-size: var(--text-13);
    font-weight: 500;
    text-align: left;
    transition:
      background-color var(--motion-fast) var(--ease-standard),
      color var(--motion-fast) var(--ease-standard);
  }

  .app__rail-item:hover {
    background: var(--panel-hover-background);
    color: var(--text-primary);
  }

  .app__rail-item--active {
    background: var(--panel-hover-background);
    color: var(--text-primary);
    box-shadow: inset 2px 0 0 var(--accent);
  }

  .app__rail-note {
    margin-top: auto;
    color: var(--text-muted);
    padding: 0 var(--space-8);
  }

  .app__stage {
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .app__page {
    height: 100%;
  }
</style>
