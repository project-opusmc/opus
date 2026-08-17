<script lang="ts">
  import { onMount } from "svelte";
  import PageShell from "../../components/PageShell.svelte";
  import Badge from "../../primitives/Badge.svelte";
  import Button from "../../primitives/Button.svelte";
  import ScrollArea from "../../primitives/ScrollArea.svelte";
  import { api } from "../../integration/api";
  import type { World } from "../../integration/types";

  let worlds: World[] = $state([]);
  let loading = $state(true);
  let selected = $state(0);

  onMount(async () => {
    worlds = await api.getWorlds();
    loading = false;
  });
</script>

<PageShell
  title="Singleplayer"
  description="Load a world through the Opus client runtime."
  badge="WORLDS"
>
  {#snippet actions()}
    <Button onclick={() => console.info("[opus-ui] create world")}>
      Create World
    </Button>
  {/snippet}

  {#if loading}
    <div class="state text-secondary motion-pulse">Loading worlds…</div>
  {:else if worlds.length === 0}
    <div class="state">
      <span class="text-regular">No worlds yet.</span>
      <span class="text-secondary">Create one to start playing.</span>
    </div>
  {:else}
    <ScrollArea>
      <div class="world-list">
        {#each worlds as world, index (world.id)}
          <button
            type="button"
            class="world-entry"
            class:world-entry--selected={selected === index}
            onmouseenter={() => (selected = index)}
            onclick={() => console.info("[opus-ui] load world", world.name)}
          >
            <div class="world-entry__icon" aria-hidden="true"></div>
            <div class="world-entry__main">
              <span class="world-entry__name text-control">{world.name}</span>
              <span class="world-entry__meta text-metadata">
                {world.fileName} · {world.size}
              </span>
            </div>
            <div class="world-entry__side">
              <Badge tone="neutral">{world.mode}</Badge>
              {#if world.lastPlayed}
                <span class="world-entry__time text-metadata">
                  {world.lastPlayed}
                </span>
              {/if}
            </div>
          </button>
        {/each}
      </div>
    </ScrollArea>
  {/if}
</PageShell>

<style lang="scss">
  .state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-8);
    height: 100%;
    color: var(--text-muted);
  }

  .world-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  .world-entry {
    display: flex;
    align-items: center;
    gap: var(--space-16);
    width: 100%;
    padding: var(--space-12) var(--space-16);
    border-radius: var(--radius-card);
    border: 1px solid var(--border-subtle);
    background: var(--panel-background);
    text-align: left;
    transition:
      background-color var(--motion-fast) var(--ease-standard),
      border-color var(--motion-fast) var(--ease-standard);
  }

  .world-entry:hover {
    background: var(--panel-hover-background);
    border-color: var(--border-strong);
  }

  .world-entry--selected {
    border-color: var(--accent);
  }

  .world-entry__icon {
    width: 44px;
    height: 44px;
    flex: none;
    border-radius: var(--radius-card);
    border: 1px solid var(--border-subtle);
    background: linear-gradient(135deg, var(--surface-3), var(--surface-2));
  }

  .world-entry__main {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    min-width: 0;
    flex: 1;
  }

  .world-entry__name {
    color: var(--text-primary);
  }

  .world-entry__meta {
    color: var(--text-muted);
  }

  .world-entry__side {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    flex: none;
  }

  .world-entry__time {
    color: var(--text-muted);
  }
</style>
