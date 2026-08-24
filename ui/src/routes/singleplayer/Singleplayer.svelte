<script lang="ts">
  import { onMount } from "svelte";
  import OptionBar from "../../menu/optionbar/OptionBar.svelte";
  import RouteState from "../../menu/RouteState.svelte";
  import MenuList from "../../menu/list/MenuList.svelte";
  import MenuListItem from "../../menu/list/MenuListItem.svelte";
  import MenuListItemTag from "../../menu/list/MenuListItemTag.svelte";
  import MenuListItemButton from "../../menu/list/MenuListItemButton.svelte";
  import BottomButtonWrapper from "../../menu/buttons/BottomButtonWrapper.svelte";
  import ButtonContainer from "../../menu/buttons/ButtonContainer.svelte";
  import IconTextButton from "../../menu/buttons/IconTextButton.svelte";
  import Search from "../../menu/Search.svelte";
  import MultiSelect from "../../menu/setting/MultiSelect.svelte";
  import { api, bridge } from "../../integration/api";
  import { isStandalone } from "../../integration/host";
  import { back } from "../../stores/ui";
  import type { World } from "../../integration/types";

  let worlds: World[] = $state([]);
  let searchQuery = $state("");
  let modes = $state(["Survival", "Creative", "Adventure", "Hardcore", "Spectator"]);
  let loading = $state(true);
  let error = $state("");
  let actionError = $state("");

  let rendered = $derived(
    worlds.filter(
      (world) =>
        (!isStandalone || modes.length === 0 || (world.mode !== undefined && modes.includes(world.mode))) &&
        (searchQuery.trim() === "" ||
          world.name.toLowerCase().includes(searchQuery.trim().toLowerCase())),
    ),
  );

  async function loadWorlds() {
    loading = true;
    error = "";
    try {
      worlds = isStandalone ? await api.getWorlds() : await bridge.getWorlds();
    } catch (failure) {
      error = failure instanceof Error ? failure.message : "Could not load worlds";
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void loadWorlds();
  });

  async function open(world: World) {
    actionError = "";
    if (isStandalone) {
      console.info("[opus-ui] load world", world.name);
      return;
    }
    try {
      await bridge.loadWorld(world.fileName);
    } catch (failure) {
      actionError = failure instanceof Error ? failure.message : "Could not load world";
    }
  }

  function remove(world: World) {
    worlds = worlds.filter((entry) => entry.id !== world.id);
  }
</script>

<OptionBar>
  <Search bind:value={searchQuery} placeholder="Search worlds..." />
  {#if isStandalone}
    <MultiSelect
      title="Game Mode"
      options={["Survival", "Creative", "Adventure", "Hardcore", "Spectator"]}
      bind:values={modes}
    />
  {/if}
</OptionBar>

<MenuList>
  <RouteState
    loading={loading}
    error={error || actionError}
    retry={() => void loadWorlds()}
    empty={rendered.length === 0 ? "No worlds available." : ""}
  />
  {#if !loading && !error && !actionError}
    {#each rendered as world (world.id)}
      <MenuListItem title={world.name} ondblclick={() => void open(world)}>
        {#snippet subtitle()}
          <span>{world.fileName}{world.size ? ` · ${world.size}` : ""}</span>
        {/snippet}
        {#snippet tag()}
          {#if world.mode}
            <MenuListItemTag text={world.mode} />
          {/if}
          {#if world.lastPlayed}
            <MenuListItemTag text={world.lastPlayed} />
          {/if}
        {/snippet}
        {#snippet activeVisible()}
          {#if isStandalone}
            <MenuListItemButton title="Delete" icon="trash" onclick={() => remove(world)} />
            <MenuListItemButton title="Edit" icon="pen" onclick={() => console.info("[opus-ui] edit world", world.name)} />
          {/if}
        {/snippet}
        {#snippet alwaysVisible()}
          <MenuListItemButton title="Play" icon="play" onclick={() => void open(world)} />
        {/snippet}
      </MenuListItem>
    {/each}
  {/if}
</MenuList>

<BottomButtonWrapper>
  {#if isStandalone}
    <ButtonContainer>
      <IconTextButton icon="plus" title="Create" onclick={() => console.info("[opus-ui] create world")} />
    </ButtonContainer>
  {/if}
  <ButtonContainer>
    <IconTextButton icon="back" title="Back" onclick={() => void back()} />
  </ButtonContainer>
</BottomButtonWrapper>
