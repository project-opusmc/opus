<script lang="ts">
  import { onMount } from "svelte";
  import Badge from "../../primitives/Badge.svelte";
  import Divider from "../../primitives/Divider.svelte";
  import Progress from "../../primitives/Progress.svelte";
  import { api } from "../../integration/api";
  import type { ClientInfo } from "../../integration/types";
  import { navigate } from "../../stores/ui";

  let client: ClientInfo | null = $state(null);

  const menu = [
    {
      label: "Singleplayer",
      action: () => navigate("singleplayer"),
    },
    {
      label: "Multiplayer",
      action: () => navigate("multiplayer"),
    },
    {
      label: "Client Settings",
      action: () => navigate("settings"),
    },
    {
      label: "Accounts",
      action: () => navigate("accounts"),
    },
    {
      label: "HUD Editor",
      action: () => navigate("hud"),
    },
    {
      label: "Quit Game",
      action: () => console.info("[opus-ui] quit requested"),
    },
  ];

  let selected = $state(0);

  onMount(async () => {
    client = await api.getClient();
  });
</script>

<main class="title">
  <header class="title__header">
    <div class="title__brand">
      <span class="title__wordmark text-hero-large">OPUS CLIENT</span>
      <span class="title__pipe">|</span>
      <span class="title__mode text-hero">READY</span>
    </div>
    <Badge>{client?.version ?? "v0.0.1"}</Badge>
  </header>

  <div class="title__body">
    <section class="title__pane title__pane--menu">
      <div class="title__pane-heading text-metadata">MENU</div>
      <Divider />
      <nav class="title__menu">
        {#each menu as item, index (item.label)}
          <button
            type="button"
            class="title__menu-item"
            class:title__menu-item--selected={selected === index}
            onmouseenter={() => (selected = index)}
            onclick={item.action}
          >
            <span class="title__caret" aria-hidden="true">
              {selected === index ? "\u25B8" : ""}
            </span>
            <span class="title__menu-label">{item.label}</span>
          </button>
        {/each}
      </nav>
    </section>

    <section class="title__pane title__pane--status">
      <div class="title__pane-heading text-metadata">STATUS</div>
      <Divider />
      <dl class="title__status">
        <div class="title__status-row">
          <dt class="text-metadata">Client</dt>
          <dd class="text-regular">{client?.version ?? "loading"}</dd>
        </div>
        <div class="title__status-row">
          <dt class="text-metadata">Minecraft</dt>
          <dd class="text-regular">{client?.minecraft ?? "1.8.9"}</dd>
        </div>
        <div class="title__status-row">
          <dt class="text-metadata">Forge</dt>
          <dd class="text-regular">{client?.forge ?? "attaching"}</dd>
        </div>
        <div class="title__status-row">
          <dt class="text-metadata">OptiFine</dt>
          <dd class="text-regular">{client?.optifine ?? "attaching"}</dd>
        </div>
        <div class="title__status-row">
          <dt class="text-metadata">Session</dt>
          <dd class="text-regular">{client?.session ?? "waiting"}</dd>
        </div>
      </dl>
      <div class="title__progress">
        <span class="text-metadata">Runtime</span>
        <Progress value={100} size="sm" />
      </div>
    </section>
  </div>

  <footer class="title__footer">
    <span class="text-metadata">
      ARROWS navigate &nbsp;&nbsp;ENTER select &nbsp;&nbsp;MOUSE supported
    </span>
    <span class="title__footer-right text-metadata">
      {client?.runtime ?? "runtime"} &nbsp;·&nbsp; standalone preview
    </span>
  </footer>
</main>

<style lang="scss">
  .title {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    padding: var(--space-32);
    gap: var(--space-24);
    background: var(--surface-0);
  }

  .title__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-24);
    padding-bottom: var(--space-16);
    border-bottom: 1px solid var(--border-subtle);
  }

  .title__brand {
    display: flex;
    align-items: baseline;
    gap: var(--space-12);
  }

  .title__wordmark {
    color: var(--text-primary);
    letter-spacing: 0.02em;
  }

  .title__pipe {
    color: var(--text-muted);
  }

  .title__mode {
    color: var(--accent);
  }

  .title__body {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
    gap: var(--space-24);
  }

  .title__pane {
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    padding: var(--space-20);
    border-radius: var(--radius-card);
    border: 1px solid var(--border-subtle);
    background: var(--panel-background);
  }

  .title__pane-heading {
    color: var(--text-muted);
    letter-spacing: 0.08em;
  }

  .title__menu {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding-top: var(--space-12);
  }

  .title__menu-item {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    height: var(--control-height-lg);
    padding: 0 var(--space-16);
    border-radius: var(--radius-control);
    color: var(--text-secondary);
    font-size: var(--text-14);
    font-weight: 500;
    text-align: left;
    transition:
      background-color var(--motion-fast) var(--ease-standard),
      color var(--motion-fast) var(--ease-standard);
  }

  .title__menu-item:hover {
    background: var(--panel-hover-background);
    color: var(--text-primary);
  }

  .title__menu-item--selected {
    background: var(--panel-hover-background);
    color: var(--text-primary);
    box-shadow: inset 2px 0 0 var(--accent);
  }

  .title__caret {
    width: 12px;
    color: var(--accent);
  }

  .title__menu-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .title__status {
    display: flex;
    flex-direction: column;
    gap: 0;
    margin: 0;
    padding: var(--space-12) 0 0;
  }

  .title__status-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-16);
    padding: var(--space-8) 0;
  }

  .title__status-row + .title__status-row {
    border-top: 1px solid var(--border-subtle);
  }

  .title__status-row dt {
    color: var(--text-muted);
  }

  .title__status-row dd {
    margin: 0;
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
  }

  .title__progress {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    margin-top: auto;
    padding-top: var(--space-16);
    color: var(--text-muted);
  }

  .title__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-16);
    padding-top: var(--space-16);
    border-top: 1px solid var(--border-subtle);
    color: var(--text-muted);
  }

  .title__footer-right {
    text-align: right;
  }

  @media (max-width: 900px) {
    .title__body {
      grid-template-columns: 1fr;
    }
  }
</style>
