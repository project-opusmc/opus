<script lang="ts">
  import Switch from "../primitives/Switch.svelte";
  import Tooltip from "../primitives/Tooltip.svelte";
  import SettingRow from "./SettingRow.svelte";
  import type { Module } from "../integration/types";

  interface Props {
    module: Module;
    ontoggle: (id: string, enabled: boolean) => void;
    onsetting: (
      moduleId: string,
      key: string,
      value: boolean | number | string,
    ) => void;
  }

  let { module, ontoggle, onsetting }: Props = $props();
</script>

<article class="module-card" class:module-card--disabled={!module.enabled}>
  <header class="module-card__header">
    <div class="module-card__heading">
      <h3 class="module-card__name text-control">{module.name}</h3>
      <Tooltip content={module.description}>
        <span class="module-card__hint" aria-label="About">i</span>
      </Tooltip>
    </div>
    <Switch
      checked={module.enabled}
      label={`Toggle ${module.name}`}
      onchange={(value) => ontoggle(module.id, value)}
    />
  </header>
  {#if module.enabled && module.settings.length > 0}
    <div class="module-card__settings">
      {#each module.settings as setting (setting.key)}
        <SettingRow
          {setting}
          onchange={(key, value) => onsetting(module.id, key, value)}
        />
      {/each}
    </div>
  {/if}
</article>

<style lang="scss">
  .module-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-16);
    padding: var(--space-16);
    border-radius: var(--radius-card);
    border: 1px solid var(--border-subtle);
    background: var(--panel-background);
    transition:
      opacity var(--motion-normal) var(--ease-standard),
      border-color var(--motion-fast) var(--ease-standard);
  }

  .module-card:hover {
    border-color: var(--border-strong);
  }

  .module-card--disabled {
    opacity: 0.6;
  }

  .module-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-16);
  }

  .module-card__heading {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    min-width: 0;
  }

  .module-card__name {
    margin: 0;
    color: var(--text-primary);
  }

  .module-card__hint {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--border-subtle);
    color: var(--text-muted);
    font-size: var(--text-11);
    font-weight: 500;
    cursor: help;
  }

  .module-card__settings {
    display: flex;
    flex-direction: column;
  }
</style>
