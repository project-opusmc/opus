<script lang="ts">
  import { onMount } from "svelte";
  import OptionBar from "../../menu/optionbar/OptionBar.svelte";
  import RouteState from "../../menu/RouteState.svelte";
  import MenuList from "../../menu/list/MenuList.svelte";
  import BottomButtonWrapper from "../../menu/buttons/BottomButtonWrapper.svelte";
  import ButtonContainer from "../../menu/buttons/ButtonContainer.svelte";
  import IconTextButton from "../../menu/buttons/IconTextButton.svelte";
  import SwitchSetting from "../../menu/setting/SwitchSetting.svelte";
  import RangeSetting from "../../menu/setting/RangeSetting.svelte";
  import Select from "../../menu/setting/Select.svelte";
  import { api, bridge } from "../../integration/api";
  import { isStandalone } from "../../integration/host";
  import { back, navigation } from "../../stores/ui";
  import type { Module, ModuleSetting } from "../../integration/types";

  let module = $state<Module | null>(null);
  let loading = $state(true);
  let error = $state("");
  let moduleId = $derived($navigation.current.params?.moduleId ?? "");

  async function loadModule() {
    loading = true;
    error = "";
    if (!moduleId) {
      error = "This module route is missing its moduleId.";
      loading = false;
      return;
    }
    try {
      const modules = isStandalone ? await api.getModules() : await bridge.getModules();
      module = modules.find((candidate) => candidate.id === moduleId) ?? null;
      if (!module) error = `Module '${moduleId}' is unavailable.`;
    } catch (failure) {
      error = failure instanceof Error ? failure.message : "Could not load the module";
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void loadModule();
  });

  async function setEnabled(enabled: boolean) {
    if (!module) return;
    try {
      if (isStandalone) await api.setModuleEnabled(module.id, enabled);
      else await bridge.setModuleEnabled(module.id, enabled);
      module = { ...module, enabled };
    } catch (failure) {
      error = failure instanceof Error ? failure.message : "Could not update module";
    }
  }

  async function setSetting(setting: ModuleSetting, value: boolean | number | string) {
    if (!module) return;
    try {
      if (isStandalone) await api.setModuleSetting(module.id, setting.key, value);
      else await bridge.setModuleSetting(module.id, setting.key, value);
      module = {
        ...module,
        settings: module.settings.map((item) => item.key === setting.key ? { ...item, value } : item),
      };
    } catch (failure) {
      error = failure instanceof Error ? failure.message : "Could not update module setting";
    }
  }

  function enumLabels(setting: ModuleSetting) {
    return (setting.options ?? []).map((option) => option.label);
  }

  function enumLabel(setting: ModuleSetting) {
    return (setting.options ?? []).find((option) => option.value === String(setting.value))?.label ?? String(setting.value);
  }
</script>

<OptionBar>
  <div class="heading">
    <span class="title">{module?.name ?? "Module Detail"}</span>
    <span class="note">{module?.description || moduleId}</span>
  </div>
  {#if module}<SwitchSetting value={module.enabled} onchange={(value) => void setEnabled(value)} />{/if}
</OptionBar>

<MenuList>
  <RouteState loading={loading} error={error} retry={() => void loadModule()} />
  {#if !loading && !error && module}
    <div class="settings">
      {#each module.settings as setting (setting.key)}
        <div class="row">
          {#if setting.type === "boolean"}
            <SwitchSetting title={setting.label} value={setting.value === true} onchange={(value) => void setSetting(setting, value)} />
          {:else if setting.type === "integer" || setting.type === "float"}
            <RangeSetting title={setting.label} value={Number(setting.value)} min={setting.min ?? 0} max={setting.max ?? 100} step={setting.step ?? 1} unit={setting.unit ?? ""} onchange={(value) => void setSetting(setting, value)} />
          {:else if setting.type === "enum"}
            <Select title={setting.label} value={enumLabel(setting)} options={enumLabels(setting)} onchange={(label) => {
              const value = (setting.options ?? []).find((option) => option.label === label)?.value ?? label;
              void setSetting(setting, value);
            }} />
          {/if}
        </div>
      {/each}
      {#if module.settings.length === 0}<div class="state">This module has no settings.</div>{/if}
    </div>
  {/if}
</MenuList>

<BottomButtonWrapper>
  <ButtonContainer>
    <IconTextButton icon="back" title="Back" onclick={() => void back()} />
  </ButtonContainer>
</BottomButtonWrapper>

<style lang="scss">
  .heading { display: flex; flex-direction: column; gap: 3px; }
  .title { color: var(--menu-text-color); font-size: 17px; font-weight: 650; }
  .note { color: var(--menu-text-dimmed-color); font-size: 12px; }
  .settings { display: flex; flex-direction: column; gap: 16px; max-width: 760px; }
  .row { padding: 14px 4px; }
  .row + .row { border-top: 1px solid var(--menu-base-36-color); }
</style>
