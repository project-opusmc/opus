<script lang="ts">
  import SwitchSetting from "./SwitchSetting.svelte";
  import RangeSetting from "./RangeSetting.svelte";
  import Select from "./Select.svelte";
  import Icon from "../Icon.svelte";
  import type { Module, ModuleSetting } from "../../integration/types";

  interface Props {
    module: Module;
    ontoggle: (id: string, enabled: boolean) => void;
    onsetting: (id: string, key: string, value: boolean | number | string) => void;
  }

  let { module, ontoggle, onsetting }: Props = $props();

  let expanded = $state(false);

  function optionLabels(setting: ModuleSetting): string[] {
    return (setting.options ?? []).map((option) => option.label);
  }

  function labelToValue(setting: ModuleSetting, label: string): string {
    return (setting.options ?? []).find((option) => option.label === label)?.value ?? label;
  }

  function valueToLabel(setting: ModuleSetting): string {
    const current = String(setting.value);
    return (
      (setting.options ?? []).find((option) => option.value === current)?.label ??
      current
    );
  }
</script>

<div class="module-row" class:enabled={module.enabled} class:expanded>
  <div class="head">
    <SwitchSetting
      value={module.enabled}
      onchange={(value) => ontoggle(module.id, value)}
    />
    <button class="name" type="button" onclick={() => (expanded = !expanded)}>
      <span class="name-text">{module.name}</span>
      {#if module.settings.length > 0}
        <span class="chevron" class:open={expanded}><Icon name="chevron" size={16} /></span>
      {/if}
    </button>
  </div>

  {#if module.description}
    <p class="description">{module.description}</p>
  {/if}

  {#if expanded && module.settings.length > 0}
    <div class="settings">
      {#each module.settings as setting (setting.key)}
        <div class="setting">
          {#if setting.type === "boolean"}
            <SwitchSetting
              title={setting.label}
              value={setting.value === true}
              onchange={(value) => onsetting(module.id, setting.key, value)}
            />
          {:else if setting.type === "integer" || setting.type === "float"}
            <RangeSetting
              title={setting.label}
              value={typeof setting.value === "number" ? setting.value : 0}
              min={setting.min ?? 0}
              max={setting.max ?? 100}
              step={setting.step ?? (setting.type === "float" ? 0.05 : 1)}
              unit={setting.unit ?? ""}
              onchange={(value) => onsetting(module.id, setting.key, value)}
            />
          {:else if setting.type === "enum"}
            <Select
              title={setting.label}
              value={valueToLabel(setting)}
              options={optionLabels(setting)}
              onchange={(label) =>
                onsetting(module.id, setting.key, labelToValue(setting, label))}
            />
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style lang="scss">
  @use "../../design/mixins.scss" as *;

  .module-row {
    background-color: var(--menu-list-item-background-color);
    border-radius: var(--radius-control);
    padding: 16px 20px;
    border-left: solid 3px transparent;
    transition: border-color 0.2s ease;

    &.enabled { border-left-color: var(--accent-color); }
  }

  .head {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .name {
    background: transparent;
    border: none;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--menu-text-color);
    cursor: pointer;
    flex: 1;
  }

  .name-text { font-size: 17px; font-weight: 600; }

  .chevron {
    display: flex;
    color: var(--menu-text-dimmed-color);
    transition: transform 0.2s ease;
    &.open { transform: rotate(180deg); }
  }

  .description {
    margin: 8px 0 0 42px;
    color: var(--menu-text-dimmed-color);
    font-size: 14px;
  }

  .settings {
    margin-top: 16px;
    padding-top: 14px;
    border-top: solid 1px var(--menu-base-36-color);
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .setting {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
  }
</style>
