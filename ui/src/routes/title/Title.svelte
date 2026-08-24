<script lang="ts">
  import { onMount } from "svelte";
  import MainButton from "../../menu/buttons/MainButton.svelte";
  import RouteState from "../../menu/RouteState.svelte";
  import ButtonContainer from "../../menu/buttons/ButtonContainer.svelte";
  import IconTextButton from "../../menu/buttons/IconTextButton.svelte";
  import IconButton from "../../menu/buttons/IconButton.svelte";
  import { navigate } from "../../stores/ui";
  import { settingsTab } from "../../stores/settings";
  import { api, bridge } from "../../integration/api";
  import { isStandalone } from "../../integration/host";
  import type { ClientInfo } from "../../integration/types";

  let info = $state<ClientInfo | null>(null);
  let loading = $state(true);
  let error = $state("");

  async function loadInfo() {
    loading = true;
    error = "";
    try {
      if (isStandalone) {
        info = await api.getClient();
      } else {
        const hello = await bridge.hello();
        info = {
          version: hello.version,
          minecraft: hello.minecraft,
          forge: hello.forge,
          optifine: hello.optifine,
          session: hello.session ?? "",
          runtime: "",
        };
      }
    } catch (failure) {
      // Integrated mode never substitutes standalone fixtures for failed game
      // data. The visible placeholders remain honest until the bridge recovers.
      info = null;
      error = failure instanceof Error ? failure.message : "Could not read client information";
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void loadInfo();
  });

  function openSettings(tab: "interface" | "game") {
    settingsTab.set(isStandalone ? tab : "game");
    void navigate({ id: "settings", params: { settingsSection: tab } });
  }

  function quit() {
    if (isStandalone) {
      console.info("[opus-ui] quit requested");
      return;
    }
    void bridge.quit();
  }
</script>

<div class="title">
  <div class="main-buttons">
    <MainButton title="Singleplayer" subtitle="Load a world" icon="singleplayer" onclick={() => navigate("singleplayer")} />
    <MainButton title="Multiplayer" subtitle="Join a server" icon="multiplayer" onclick={() => navigate("multiplayer")} />
    <MainButton title="Client" subtitle="Browse client modules" icon="client" onclick={() => void navigate("mods_catalog")} />
    <MainButton title="Options" subtitle="Game & interface" icon="options" onclick={() => openSettings("game")} />
  </div>

  <aside class="card">
    <div class="brand">
      <span class="ring" aria-hidden="true">
        <svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" stroke-width="5" /><circle cx="24" cy="24" r="6" fill="currentColor" /></svg>
      </span>
      <span class="brand-text">
        <span class="brand-name">Opus Client</span>
        <span class="brand-version">v{info?.version ?? "—"}</span>
      </span>
    </div>
    <div class="specs">
      <div class="spec"><span class="k">Minecraft</span><span class="v">{info?.minecraft ?? "—"}</span></div>
      <div class="spec"><span class="k">Forge</span><span class="v">{info?.forge ?? "—"}</span></div>
      <div class="spec"><span class="k">OptiFine</span><span class="v">{info?.optifine ?? "—"}</span></div>
      <div class="spec"><span class="k">Session</span><span class="v ok">{info?.session ?? "—"}</span></div>
    </div>
    <RouteState loading={loading} error={error} retry={() => void loadInfo()} />
  </aside>

  <div class="additional">
    <ButtonContainer>
      <IconTextButton icon="exit" title="Quit" onclick={quit} />
      {#if isStandalone}
        <IconTextButton icon="options" title="Settings" onclick={() => openSettings("interface")} />
      {/if}
    </ButtonContainer>
  </div>

  <div class="social">
    <ButtonContainer>
      <IconButton title="Accounts" icon="user" onclick={() => navigate("accounts")} />
    </ButtonContainer>
  </div>
</div>

<style lang="scss">
  // Fixed grid so nothing can overlap: actions top-left, client card top-right,
  // quit/settings bottom-left, social bottom-right. The middle stays open the
  // way the old layout did, but the previously-empty top-right corner now
  // carries the client card instead of dead space.
  .title {
    display: grid;
    grid-template-areas:
      "a d"
      "b c";
    grid-template-rows: 1fr max-content;
    grid-template-columns: minmax(0, 1fr) max-content;
    gap: 24px;
    flex: 1;
    min-height: 0;
  }

  .main-buttons {
    grid-area: a;
    display: flex;
    flex-direction: column;
    row-gap: 14px;
    align-content: start;
    max-width: 440px;
    min-width: 0;
  }

  .card {
    grid-area: d;
    align-self: start;
    width: 340px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 26px 26px;
    border-radius: var(--radius-card);
    background: var(--menu-base-68-color);
    border: 1px solid var(--border-subtle);
  }

  .brand { display: flex; align-items: center; gap: 15px; }
  .ring {
    width: 42px;
    height: 42px;
    color: var(--accent-color);
    flex: none;
    svg { width: 100%; height: 100%; display: block; }
  }
  .brand-text { display: flex; flex-direction: column; gap: 2px; }
  .brand-name { font-size: 19px; font-weight: 700; color: var(--menu-text-color); }
  .brand-version { font-size: 12px; font-weight: 600; letter-spacing: 0.04em; color: var(--accent-color); }

  .specs { display: flex; flex-direction: column; }
  .spec {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 0;
    font-size: 13px;

    & + .spec { border-top: 1px solid var(--menu-base-36-color); }
    .k { color: var(--menu-text-dimmed-color); }
    .v { color: var(--menu-text-color); font-weight: 600; }
    .v.ok { color: var(--success-color); }
  }

  .additional { grid-area: b; align-self: end; }
  .social { grid-area: c; align-self: end; justify-self: end; }

  @media (max-height: 600px) {
    .title {
      grid-template-areas:
        "a a"
        "d d"
        "b c";
      grid-template-rows: max-content max-content 1fr;
      gap: 12px 16px;
    }

    .main-buttons {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px 12px;
      max-width: none;
    }

    .card {
      width: auto;
      padding: 11px 14px;
      display: grid;
      grid-template-columns: minmax(150px, max-content) minmax(0, 1fr);
      align-items: center;
      gap: 16px;
    }

    .brand { gap: 10px; }
    .ring { width: 32px; height: 32px; }
    .brand-name { font-size: 15px; }
    .brand-version { font-size: 11px; }

    .specs {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      column-gap: 18px;
    }

    .spec {
      min-width: 0;
      padding: 4px 0;
      font-size: 11px;

      & + .spec { border-top: 0; }
      &:nth-child(n + 3) { border-top: 1px solid var(--menu-base-36-color); }
      .v { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    }
  }

  @media (max-width: 560px) {
    .card {
      grid-template-columns: 1fr;
      gap: 8px;
    }

    .brand { display: none; }
  }

  @media (max-height: 400px) {
    .title {
      grid-template-areas:
        "a a"
        "b c";
      grid-template-rows: max-content 1fr;
      gap: 8px 12px;
    }

    .main-buttons { gap: 6px 8px; }
    .card { display: none; }
  }
</style>
