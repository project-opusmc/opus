<script lang="ts">
  import { onMount } from "svelte";
  import RouteState from "../../menu/RouteState.svelte";
  import IconTextButton from "../../menu/buttons/IconTextButton.svelte";
  import SwitchSetting from "../../menu/setting/SwitchSetting.svelte";
  import { bridge } from "../../integration/api";
  import { isStandalone } from "../../integration/host";
  import { back, navigate, navigation } from "../../stores/ui";
  import type { HudModule } from "../../integration/types";

  const mockItems: HudModule[] = [
    { id: "fps", name: "FPS Display", enabled: true, offsetX: 16, offsetY: 16, scale: 100, anchor: "top-left" },
    { id: "armor", name: "Armor Status", enabled: true, offsetX: 16, offsetY: 60, scale: 100, anchor: "top-left" },
    { id: "keystrokes", name: "Keystrokes", enabled: false, offsetX: 220, offsetY: 16, scale: 100, anchor: "top-left" },
  ];

  let items: HudModule[] = $state([]);
  let selectedId = $state("");
  let loading = $state(true);
  let error = $state("");
  let inputError = $state("");
  let selected = $derived(items.find((item) => item.id === selectedId));
  let canvasElement: HTMLDivElement;

  async function loadModules() {
    loading = true;
    error = "";
    try {
      items = isStandalone ? mockItems : await bridge.getHudModules();
      selectedId = items[0]?.id ?? "";
    } catch (failure) {
      error = failure instanceof Error ? failure.message : "Could not load HUD modules";
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    let stopped = false;
    let resizeObserver: ResizeObserver | null = null;
    let publishTimer: ReturnType<typeof setTimeout> | null = null;
    let lastPayload = "";

    void loadModules();

    const publishCanvas = () => {
      if (stopped || isStandalone || !canvasElement) return;
      if (publishTimer) clearTimeout(publishTimer);
      publishTimer = setTimeout(() => {
        publishTimer = null;
        const rect = canvasElement.getBoundingClientRect();
        const region = {
          x: Math.max(0, Math.round(rect.left)),
          y: Math.max(0, Math.round(rect.top)),
          width: Math.max(0, Math.round(rect.width)),
          height: Math.max(0, Math.round(rect.height)),
        };
        const revision = $navigation.revision;
        const payload = `${revision}:${region.x}:${region.y}:${region.width}:${region.height}`;
        if (payload === lastPayload) return;
        lastPayload = payload;
        inputError = "";
        void bridge.reportHudEditorCanvas(revision, region).catch((error) => {
          inputError = error instanceof Error
            ? error.message
            : "HUD input ownership sync failed";
        });
      }, 0);
    };

    if (!isStandalone && canvasElement) {
      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(publishCanvas);
        resizeObserver.observe(canvasElement);
      }
      window.addEventListener("resize", publishCanvas);
      publishCanvas();
    }

    return () => {
      stopped = true;
      if (publishTimer) clearTimeout(publishTimer);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", publishCanvas);
    };
  });

  async function toggle(id: string, enabled: boolean) {
    const previous = items;
    items = items.map((item) => (item.id === id ? { ...item, enabled } : item));
    if (isStandalone) return;
    try {
      await bridge.setModuleEnabled(id, enabled);
    } catch (failure) {
      items = previous;
      error = failure instanceof Error ? failure.message : "Could not update HUD module";
    }
  }
</script>

<div class="hud-editor">
  <div class="hud-canvas" bind:this={canvasElement} aria-label="Live HUD canvas"></div>
  <div class="sidebar">
    <div class="sidebar__heading">
      <span class="eyebrow">OPUS</span>
      <span class="sidebar__title">HUD Editor</span>
      <span class="sidebar__note">
        {selected ? `Selected: ${selected.name}` : "Live widget layout"}
      </span>
    </div>
    <span class="sidebar__section">Components</span>
    <RouteState
      loading={loading}
      error={error}
      retry={() => void loadModules()}
      empty={items.length === 0 ? "No HUD modules are available." : ""}
    />
    {#if !loading && !error && items.length > 0}
      <div class="list">
        {#each items as item (item.id)}
          <div class="list-item" class:selected={item.id === selectedId}>
            <button class="list-item__name" type="button" onclick={() => (selectedId = item.id)}>
              {item.name}
            </button>
            <SwitchSetting value={item.enabled} onchange={(value) => void toggle(item.id, value)} />
          </div>
        {/each}
      </div>
    {/if}
    {#if inputError}
      <span class="sidebar__error" role="alert">{inputError}</span>
    {/if}
    {#if selected && !error}
      <IconTextButton
        icon="options"
        title="Widget settings"
        onclick={() => void navigate({ id: "module_detail", params: { moduleId: selected.id } })}
      />
    {/if}
    <IconTextButton icon="back" title="Back" onclick={() => void back()} />
  </div>
</div>

<style lang="scss">
  .hud-editor {
    display: flex;
    gap: 0;
    width: 100%;
    height: 100%;
    min-height: 0;
  }

  .hud-canvas {
    flex: 1;
    min-width: 0;
    min-height: 0;
    pointer-events: none;
  }

  .sidebar {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 18px;
    border-radius: var(--radius-control);
    background: var(--menu-list-background-color);
    min-height: 0;
    width: min(300px, 48%);
    flex: none;
    margin: 18px 22px 18px 16px;
    overflow: hidden;
  }

  .sidebar__heading {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .eyebrow {
    color: var(--accent-color);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0;
  }

  .sidebar__note {
    color: var(--menu-text-dimmed-color);
    font-size: 12px;
  }

  .sidebar__error {
    color: var(--error-color);
    font-size: 12px;
  }

  .sidebar__title,
  .sidebar__section {
    color: var(--menu-text-color);
    font-size: 15px;
    font-weight: 600;
  }

  .sidebar__section {
    margin-top: 6px;
    color: var(--menu-text-dimmed-color);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
  }

  .list-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
    border-radius: var(--radius-control);
    background: var(--menu-list-item-background-color);
    border-left: solid 3px transparent;

    &.selected { border-left-color: var(--accent-color); }

    &__name {
      border: 0;
      background: transparent;
      padding: 0;
      text-align: left;
      color: var(--menu-text-color);
      font-size: 14px;
      cursor: pointer;
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  @media (max-width: 560px), (max-height: 400px) {
    .sidebar {
      gap: 8px;
      padding: 12px;
      margin: 10px 12px 10px 10px;
    }

    .sidebar__title { font-size: 14px; }
    .sidebar__note { font-size: 11px; }
    .sidebar__section { margin-top: 2px; }

    .list { gap: 6px; }
    .list-item { padding: 8px 10px; }
  }
</style>
