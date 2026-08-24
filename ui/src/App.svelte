<script lang="ts">
  import { onMount } from "svelte";
  import { bridge } from "./integration/api";
  import { isStandalone } from "./integration/host";
  import { connectBridge, disconnectBridge, listen } from "./integration/ws";
  import Menu from "./menu/Menu.svelte";
  import Title from "./routes/title/Title.svelte";
  import Singleplayer from "./routes/singleplayer/Singleplayer.svelte";
  import Multiplayer from "./routes/multiplayer/Multiplayer.svelte";
  import Settings from "./routes/settings/Settings.svelte";
  import Accounts from "./routes/accounts/Accounts.svelte";
  import HudEditor from "./routes/hud/HudEditor.svelte";
  import GameMenu from "./routes/game-menu/GameMenu.svelte";
  import QuickHub from "./routes/quick-hub/QuickHub.svelte";
  import ModsCatalog from "./routes/mods/ModsCatalog.svelte";
  import ModuleDetail from "./routes/mods/ModuleDetail.svelte";
  import None from "./routes/none/None.svelte";
  import { back, commitNavigation, initHashRoute, navigation } from "./stores/ui";
  import type { RouteId } from "./stores/ui";

  let currentRoute = $derived($navigation.current.id);
  let currentRouteKey = $derived(
    `${currentRoute}:${$navigation.current.params?.moduleId ?? ""}:${$navigation.current.params?.settingsSection ?? ""}:${$navigation.revision}`,
  );

  // Routes shown inside the padded Menu shell (header + account). "none" is the
  // in-game suspended state and stands alone; the shell would only add chrome.
  const menuRoutes: RouteId[] = [
    "title",
    "singleplayer",
    "multiplayer",
    "settings",
    "accounts",
    "game_menu",
    "mods_catalog",
    "module_detail",
  ];

  let inMenu = $derived(menuRoutes.includes(currentRoute));

  async function syncFromBridge(state: typeof $navigation) {
    commitNavigation(state);
    document.documentElement.dataset.presentation = state.presentation;
    await bridge.acknowledgeNavigation(state.revision);
  }

  onMount(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Modal.svelte owns its own close handler. If a modal is present, do not
      // let the same key fall through to route history.
      if (document.querySelector(".modal-wrapper")) return;
      void back();
    };
    window.addEventListener("keydown", onEscape);
    if (isStandalone) {
      initHashRoute();
      return () => window.removeEventListener("keydown", onEscape);
    }

    const offReady = listen("socketReady", async () => {
      await syncFromBridge(await bridge.getNavigationState());
    });
    const offNavigation = listen("uiNavigationChanged", syncFromBridge);
    // Register both listeners before opening the loopback socket. CEF can
    // complete a localhost WebSocket handshake immediately; connecting first
    // could lose socketReady and leave the initial navigation unacknowledged.
    connectBridge();

    return () => {
      offReady();
      offNavigation();
      window.removeEventListener("keydown", onEscape);
      disconnectBridge();
    };
  });
</script>

<!--
  No enter/leave transitions on route swap. The embedded in-game surface renders
  in an offscreen helper WebView where requestAnimationFrame is throttled, so a
  stalled out: transition used to overlay the previous page on top of the new
  one and intercept pointer hits (the old broken/"tan nát" menu). Swapping the
  page instantly with {#key} keeps hover/click alive after navigation.
-->
<div class="app" class:app--centered={currentRoute === "quick_hub"}>
  {#if inMenu}
    <Menu>
      {#key currentRouteKey}
        <div class="app__page">
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
          {:else if currentRoute === "game_menu"}
            <GameMenu />
          {:else if currentRoute === "mods_catalog"}
            <ModsCatalog />
          {:else if currentRoute === "module_detail"}
            <ModuleDetail />
          {/if}
        </div>
      {/key}
    </Menu>
  {:else if currentRoute === "quick_hub"}
    <QuickHub />
  {:else if currentRoute === "hud_editor"}
    <HudEditor />
  {:else}
    <None />
  {/if}
</div>

<style lang="scss">
  .app {
    height: 100%;
    min-height: 0;
  }

  .app--centered {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .app__page {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
</style>
