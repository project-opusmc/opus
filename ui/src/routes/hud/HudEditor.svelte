<script lang="ts">
  import PageShell from "../../components/PageShell.svelte";
  import Badge from "../../primitives/Badge.svelte";
  import Button from "../../primitives/Button.svelte";
  import ScrollArea from "../../primitives/ScrollArea.svelte";
  import Tooltip from "../../primitives/Tooltip.svelte";

  const hudItems = [
    { id: "fps", name: "FPS Display", x: 16, y: 16, w: 160, h: 32 },
    { id: "armor", name: "Armor Status", x: 16, y: 60, w: 180, h: 28 },
    { id: "keystrokes", name: "Keystrokes", x: 200, y: 16, w: 120, h: 96 },
  ];
</script>

<PageShell
  title="HUD Editor"
  description="Arrange runtime HUD components. Drag, snap and resize in the integrated build."
  badge="OVERLAY"
>
  {#snippet actions()}
    <Button variant="primary" onclick={() => console.info("[opus-ui] apply HUD")}>
      Apply
    </Button>
  {/snippet}

  <div class="hud-editor">
    <ScrollArea>
      <div class="hud-canvas" aria-label="HUD canvas">
        {#each hudItems as item (item.id)}
          <Tooltip content={`${item.name} · ${item.w}×${item.h}`}>
            <div
              class="hud-box"
              style:left={`${item.x}px`}
              style:top={`${item.y}px`}
              style:width={`${item.w}px`}
              style:height={`${item.h}px`}
            >
              <span class="text-metadata">{item.name}</span>
            </div>
          </Tooltip>
        {/each}
      </div>
    </ScrollArea>
    <div class="hud-sidebar">
      <Badge tone="accent">EDITOR PREVIEW</Badge>
      <p class="text-secondary">
        The same components render in runtime and editor modes. Drag, snap and
        resize arrive with the input bridge; the layout contract is unchanged.
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
</style>
