<script lang="ts">
  import Slider from "../primitives/Slider.svelte";
  import Select from "../primitives/Select.svelte";
  import Switch from "../primitives/Switch.svelte";
  import TextInput from "../primitives/TextInput.svelte";
  import type { ModuleSetting } from "../integration/types";

  interface Props {
    setting: ModuleSetting;
    onchange: (key: string, value: boolean | number | string) => void;
  }

  let { setting, onchange }: Props = $props();

  let numberValue = $derived(
    typeof setting.value === "number" ? setting.value : 0,
  );
  let stringValue = $derived(
    typeof setting.value === "string" ? setting.value : "",
  );
  let stringBuffer = $state("");
  $effect(() => {
    stringBuffer = stringValue;
  });
</script>

<div class="setting-row">
  <div class="setting-row__label">
    <span class="setting-row__name text-regular">{setting.label}</span>
    {#if setting.type === "key"}
      <kbd class="setting-row__kbd">{stringValue}</kbd>
    {/if}
  </div>
  <div class="setting-row__control">
    {#if setting.type === "boolean"}
      <Switch
        checked={setting.value === true}
        label={setting.label}
        onchange={(value) => onchange(setting.key, value)}
      />
    {:else if setting.type === "integer" || setting.type === "float"}
      <Slider
        label=""
        value={numberValue}
        min={setting.min ?? 0}
        max={setting.max ?? 100}
        step={setting.step ?? 1}
        unit={setting.unit ?? ""}
        onchange={(value) => onchange(setting.key, value)}
      />
    {:else if setting.type === "enum"}
      <Select
        value={stringValue}
        options={setting.options ?? []}
        onchange={(value) => onchange(setting.key, value)}
      />
    {:else if setting.type === "color"}
      <input
        class="setting-row__color"
        type="color"
        value={stringValue}
        oninput={(event) =>
          onchange(setting.key, (event.currentTarget as HTMLInputElement).value)}
      />
    {:else if setting.type === "string"}
      <TextInput
        bind:value={stringBuffer}
        placeholder={setting.label}
        onchange={(value) => onchange(setting.key, value)}
      />
    {:else}
      <Switch
        checked={setting.value === true}
        label={setting.label}
        onchange={(value) => onchange(setting.key, value)}
      />
    {/if}
  </div>
</div>

<style lang="scss">
  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-24);
    padding: var(--space-12) 0;
  }

  .setting-row__label {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    min-width: 0;
  }

  .setting-row__name {
    color: var(--text-primary);
  }

  .setting-row__kbd {
    padding: 2px var(--space-8);
    border-radius: var(--radius-control);
    border: 1px solid var(--border-strong);
    background: var(--surface-2);
    color: var(--text-secondary);
    font-family: var(--font-mono);
    font-size: var(--text-11);
  }

  .setting-row__control {
    flex: none;
    min-width: 180px;
    max-width: 260px;
  }

  .setting-row__color {
    width: 44px;
    height: var(--control-height-md);
    padding: 2px;
    border-radius: var(--radius-control);
    border: 1px solid var(--border-subtle);
    background: var(--surface-2);
    cursor: pointer;
  }
</style>
