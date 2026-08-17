<script lang="ts">
  import { onMount } from "svelte";
  import PageShell from "../../components/PageShell.svelte";
  import Badge from "../../primitives/Badge.svelte";
  import Button from "../../primitives/Button.svelte";
  import ScrollArea from "../../primitives/ScrollArea.svelte";
  import { bridge } from "../../integration/api";
  import { isStandalone } from "../../integration/host";
  import type { HudModule } from "../../integration/types";

  const mockItems: HudModule[] = [
    { id: "fps", name: "FPS Display", enabled: true, offsetX: 16, offsetY: 16, scale: 100, anchor: "top-left" },
    { id: "armor", name: "Armor Status", enabled: true, offsetX: 16, offsetY: 60, scale: 100, anchor: "top-left" },
    { id: "keystrokes", name: "Keystrokes", enabled: false, offsetX: 200, offsetY: 16, scale: 100, anchor: "top-left" },
  ];

  let items: HudModule[] = $state([]);
  let selectedId = $state("");
  let canvasWidth = $state(900);

  onMount(async () => {
    if (isStandalone) {
      items = mockItems;
    } else {
      items = await bridge.getHudModules();
    }
    if (items.length > 0) {
      selectedId = items[0].id;
    }
  });

  function selected(): HudModule | undefined {
    return items.find((item) => item.id === selectedId);
  }

  function boxStyle(item: HudModule) {
    const width = Math.round(140 * item.scale / 100);
    const height = Math.round(28 * item.scale / 100);
    const left = item.anchor.includes("right")
      ? canvasWidth - item.offsetX - width
      : item.offsetX;
    const top = item.anchor.includes("bottom")
      ? 480 - item.offsetY - height
      : item.offsetY;
    return `left:${Math.max(0, left)}px;top:${Math.max(0, top)}px;width:${width}px;height:${height}px;`;
  }

  async function placeSelected(x: number, y: number) {
    if (!selectedId) {
      return;
    }
    if (isStandalone) {
      items = items.map((item) =>
        item.id === selectedId ? { ...item, offsetX: x, offsetY: y } : item,
      );
      return;
    }
    await bridge.moveHudModule(selectedId, x, y);
    items = await bridge.getHudModules();
  }
</script>

<PageShell
  title="HUD Editor"
  description="Arrange runtime HUD components. Click a module then click the canvas to place it."
  badge="OVERLAY"
>
  {#snippet actions()}
    <Badge tone={isStandalone ? "neutral" : "accent"}>
      {isStandalone ? "PREVIEW" : "LIVE"}
    </Badge>
  {/snippet}

  <div class="hud-editor">
    <ScrollArea>
      <div
        class="hud-canvas"
        class:hud-canvas--active={!!selectedId}
        aria-label="HUD canvas"
        role="button"
        tabindex="0"
        bind:clientWidth={canvasWidth}
        onclick={(event) => {
          const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
          void placeSelected(
            Math.round(event.clientX - rect.left),
            Math.round(event.clientY - rect.top),
          );
        }}
        onkeydown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            void placeSelected(Math.round(canvasWidth / 2), 240);
          }
        }}
      >
        {#each items as item (item.id)}
          <div
            class="hud-box"
            class:hud-box--selected={item.id === selectedId}
            style={boxStyle(item)}
            role="button"
            tabindex="0"
            onclick={(event) => {
              event.stopPropagation();
              selectedId = item.id;
            }}
            onkeydown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                selectedId = item.id;
              }
            }}
          >
            <span class="text-metadata">{item.name}</span>
          </div>
        {/each}
      </div>
    </ScrollArea>
    <div class="hud-sidebar">
      <span class="text-control">MODULES</span>
      <ScrollArea>
        <div class="hud-module-list">
          {#each items as item (item.id)}
            <button
              type="button"
              class="hud-module"
              class:hud-module--selected={item.id === selectedId}
              onclick={() => (selectedId = item.id)}
            >
              <span class="text-regular">{item.name}</span>
              <Badge tone={item.enabled ? "success" : "neutral"}>
                {item.enabled ? "on" : "off"}
              </Badge>
            </button>
          {/each}
        </div>
      </ScrollArea>
      <p class="text-secondary">
        {selected() ? `${selected()?.name} · ${selected()?.anchor} · scale ${selected()?.scale}%` : "Select a module first."}
      </p>
    </div>
  </div>
</PageShell>

<style lang="scss">
  .hud-editor {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 240px;
    gap: var(--space-16);
    height: 100%;
    min-height: 0;
  }

  .hud-canvas {
    position: relative;
    height: 480px;
    border-radius: var(--radius-card);
    border: 1px solid var(--border-strong);
    background:
      linear-gradient(var(--border-subtle) 1px, transparent 1px),
      linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px),
      var(--surface-1);
    background-size: 24px 24px;
    cursor: crosshair;
  }

  .hud-canvas--active {
    cursor: copy;
  }

  .hud-box {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-control);
    border: 1px solid var(--accent);
    background: var(--surface-2);
    color: var(--text-secondary);
    cursor: grab;
    transition: border-color var(--motion-fast) var(--ease-standard);
  }

  .hud-box:hover {
    border-color: var(--text-secondary);
  }

  .hud-box--selected {
    border-color: var(--text-primary);
    background: var(--surface-3);
  }

  .hud-sidebar {
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    padding: var(--space-16);
    border-radius: var(--radius-card);
    border: 1px solid var(--border-subtle);
    background: var(--panel-background);
  }

  .hud-sidebar p {
    margin: 0;
    color: var(--text-muted);
  }

  .hud-module-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .hud-module {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-8);
    width: 100%;
    padding: var(--space-8) var(--space-12);
    border-radius: var(--radius-control);
    border: 1px solid var(--border-subtle);
    background: var(--panel-background);
    transition:
      background-color var(--motion-fast) var(--ease-standard),
      border-color var(--motion-fast) var(--ease-standard);
  }

  .hud-module:hover {
    background: var(--panel-hover-background);
  }

  .hud-module--selected {
    border-color: var(--accent);
  }
</style>
