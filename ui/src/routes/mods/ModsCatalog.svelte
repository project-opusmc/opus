<script lang="ts">
  import { onMount } from "svelte";
  import OptionBar from "../../menu/optionbar/OptionBar.svelte";
  import RouteState from "../../menu/RouteState.svelte";
  import Search from "../../menu/Search.svelte";
  import MenuList from "../../menu/list/MenuList.svelte";
  import MenuListItem from "../../menu/list/MenuListItem.svelte";
  import MenuListItemTag from "../../menu/list/MenuListItemTag.svelte";
  import MenuListItemButton from "../../menu/list/MenuListItemButton.svelte";
  import BottomButtonWrapper from "../../menu/buttons/BottomButtonWrapper.svelte";
  import ButtonContainer from "../../menu/buttons/ButtonContainer.svelte";
  import IconTextButton from "../../menu/buttons/IconTextButton.svelte";
  import SwitchSetting from "../../menu/setting/SwitchSetting.svelte";
  import { api, bridge } from "../../integration/api";
  import { isStandalone } from "../../integration/host";
  import { back, navigate, navigation } from "../../stores/ui";
  import type { Module } from "../../integration/types";

  let modules: Module[] = $state([]);
  let query = $state("");
  let loading = $state(true);
  let error = $state("");

  let filtered = $derived(
    modules.filter((module) =>
      `${module.name} ${module.description}`.toLowerCase().includes(query.trim().toLowerCase()),
    ),
  );

  async function loadModules() {
    loading = true;
    error = "";
    try {
      modules = isStandalone ? await api.getModules() : await bridge.getModules();
    } catch (failure) {
      error = failure instanceof Error ? failure.message : "Could not load modules";
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void loadModules();
  });

  async function toggle(id: string, enabled: boolean) {
    const previous = modules;
    modules = modules.map((module) => module.id === id ? { ...module, enabled } : module);
    try {
      if (isStandalone) await api.setModuleEnabled(id, enabled);
      else await bridge.setModuleEnabled(id, enabled);
    } catch (failure) {
      modules = previous;
      error = failure instanceof Error ? failure.message : "Could not update module";
    }
  }
</script>

<OptionBar>
  <Search bind:value={query} placeholder="Search modules..." />
</OptionBar>

<MenuList>
  <RouteState
    loading={loading}
    error={error}
    retry={() => void loadModules()}
    empty={filtered.length === 0 ? "No modules match this search." : ""}
  />
  {#if !loading && !error && filtered.length > 0}
    {#each filtered as module (module.id)}
      <MenuListItem title={module.name} ondblclick={() => void navigate({ id: "module_detail", params: { moduleId: module.id } })}>
        {#snippet subtitle()}
          {#if module.description}<span>{module.description}</span>{/if}
        {/snippet}
        {#snippet tag()}<MenuListItemTag text={module.enabled ? "Enabled" : "Disabled"} />{/snippet}
        {#snippet activeVisible()}
          <SwitchSetting value={module.enabled} onchange={(value) => void toggle(module.id, value)} />
        {/snippet}
        {#snippet alwaysVisible()}
          <MenuListItemButton title="Options" icon="options" onclick={() => void navigate({ id: "module_detail", params: { moduleId: module.id } })} />
        {/snippet}
      </MenuListItem>
    {/each}
  {/if}
</MenuList>

<BottomButtonWrapper>
  {#if $navigation.worldContext !== "none"}
    <ButtonContainer>
      <IconTextButton icon="hud" title="Edit HUD" onclick={() => void navigate("hud_editor")} />
    </ButtonContainer>
  {/if}
  <ButtonContainer>
    <IconTextButton icon="back" title="Back" onclick={() => void back()} />
  </ButtonContainer>
</BottomButtonWrapper>
