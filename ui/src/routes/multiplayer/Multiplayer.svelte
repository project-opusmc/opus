<script lang="ts">
  import { onMount } from "svelte";
  import OptionBar from "../../menu/optionbar/OptionBar.svelte";
  import RouteState from "../../menu/RouteState.svelte";
  import Divider from "../../menu/optionbar/Divider.svelte";
  import MenuList from "../../menu/list/MenuList.svelte";
  import MenuListItem from "../../menu/list/MenuListItem.svelte";
  import MenuListItemTag from "../../menu/list/MenuListItemTag.svelte";
  import MenuListItemButton from "../../menu/list/MenuListItemButton.svelte";
  import BottomButtonWrapper from "../../menu/buttons/BottomButtonWrapper.svelte";
  import ButtonContainer from "../../menu/buttons/ButtonContainer.svelte";
  import IconTextButton from "../../menu/buttons/IconTextButton.svelte";
  import Search from "../../menu/Search.svelte";
  import SwitchSetting from "../../menu/setting/SwitchSetting.svelte";
  import Modal from "../../menu/modal/Modal.svelte";
  import IconTextInput from "../../menu/setting/IconTextInput.svelte";
  import ButtonSetting from "../../menu/setting/ButtonSetting.svelte";
  import { api, bridge } from "../../integration/api";
  import { isStandalone } from "../../integration/host";
  import { back } from "../../stores/ui";
  import type { Server } from "../../integration/types";

  let servers: Server[] = $state([]);
  let searchQuery = $state("");
  let onlineOnly = $state(false);
  let addVisible = $state(false);
  let directVisible = $state(false);

  let newName = $state("");
  let newAddress = $state("");
  let directAddress = $state("");
  let loading = $state(true);
  let error = $state("");
  let actionError = $state("");

  let rendered = $derived(
    servers.filter(
      (server) =>
        (!isStandalone || !onlineOnly || server.state === "online") &&
        (searchQuery.trim() === "" ||
          server.name.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
          server.address.toLowerCase().includes(searchQuery.trim().toLowerCase())),
    ),
  );

  async function loadServers() {
    loading = true;
    error = "";
    actionError = "";
    try {
      servers = isStandalone ? await api.getServers() : await bridge.getServers();
    } catch (failure) {
      error = failure instanceof Error ? failure.message : "Could not load servers";
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void loadServers();
  });

  async function refresh() {
    await loadServers();
  }

  function pingColor(server: Server) {
    if (!isStandalone) return null;
    if (server.state !== "online" || server.latencyMs == null) return "var(--error-color)";
    if (server.latencyMs <= 50) return "var(--success-color)";
    if (server.latencyMs <= 100) return "var(--warning-color)";
    return "var(--error-color)";
  }

  function pingText(server: Server) {
    if (!isStandalone) return null;
    if (server.state === "online" && server.latencyMs != null) return `${server.latencyMs}ms`;
    return null;
  }

  async function connect(server: Server) {
    actionError = "";
    if (isStandalone) {
      console.info("[opus-ui] join", server.address);
      return;
    }
    try {
      await bridge.connectServer(server.address);
    } catch (failure) {
      actionError = failure instanceof Error ? failure.message : "Could not connect to server";
    }
  }

  async function addServer() {
    if (!newName.trim() || !newAddress.trim()) return;
    actionError = "";
    try {
      if (isStandalone) {
        servers = [...servers, await api.addServer(newName.trim(), newAddress.trim())];
      } else {
        await bridge.addServer(newName.trim(), newAddress.trim());
        await refresh();
      }
    } catch (failure) {
      actionError = failure instanceof Error ? failure.message : "Could not add server";
      return;
    }
    newName = "";
    newAddress = "";
    addVisible = false;
  }

  async function directConnect() {
    if (!directAddress.trim()) return;
    actionError = "";
    try {
      if (isStandalone) {
        console.info("[opus-ui] direct connect", directAddress);
      } else {
        await bridge.connectServer(directAddress.trim());
      }
    } catch (failure) {
      actionError = failure instanceof Error ? failure.message : "Could not connect to server";
      return;
    }
    directAddress = "";
    directVisible = false;
  }

  function remove(server: Server) {
    servers = servers.filter((entry) => entry.id !== server.id);
  }
</script>

<OptionBar>
  <Search bind:value={searchQuery} placeholder="Search servers..." />
  {#if isStandalone}
    <SwitchSetting title="Online only" bind:value={onlineOnly} />
  {/if}
  <Divider />
  <ButtonSetting title="Refresh" secondary onclick={refresh} />
</OptionBar>

<MenuList>
  <RouteState
    loading={loading}
    error={error || actionError}
    retry={() => void loadServers()}
    empty={rendered.length === 0 ? "No servers available." : ""}
  />
  {#if !loading && !error && !actionError}
    {#each rendered as server (server.id)}
      <MenuListItem
        title={server.name}
        imageText={pingText(server)}
        imageTextColor={pingColor(server)}
        ondblclick={() => void connect(server)}
      >
        {#snippet subtitle()}
          <span>{server.address}</span>
        {/snippet}
        {#snippet tag()}
          {#if server.version}
            <MenuListItemTag text={server.version} />
          {/if}
          {#if isStandalone && server.state !== "online"}
            <MenuListItemTag text="Offline" />
          {/if}
        {/snippet}
        {#snippet activeVisible()}
          {#if isStandalone}
            <MenuListItemButton title="Remove" icon="trash" onclick={() => remove(server)} />
            <MenuListItemButton title="Edit" icon="pen" onclick={() => console.info("[opus-ui] edit server", server.address)} />
          {/if}
        {/snippet}
        {#snippet alwaysVisible()}
          <MenuListItemButton title="Join" icon="play" onclick={() => void connect(server)} />
        {/snippet}
      </MenuListItem>
    {/each}
  {/if}
</MenuList>

<BottomButtonWrapper>
  <ButtonContainer>
    <IconTextButton icon="plus" title="Add" onclick={() => (addVisible = true)} />
    <IconTextButton icon="play" title="Direct" onclick={() => (directVisible = true)} />
    <IconTextButton icon="refresh" title="Refresh" onclick={refresh} />
  </ButtonContainer>
  <ButtonContainer>
    <IconTextButton icon="back" title="Back" onclick={() => void back()} />
  </ButtonContainer>
</BottomButtonWrapper>

<Modal title="Add Server" bind:visible={addVisible}>
  <IconTextInput icon="pen" title="Server name" bind:value={newName} />
  <IconTextInput icon="globe" title="Address" bind:value={newAddress} />
  <ButtonSetting title="Save" onclick={addServer} />
</Modal>

<Modal title="Direct Connect" bind:visible={directVisible}>
  <IconTextInput icon="globe" title="play.example.com:25565" bind:value={directAddress} />
  <ButtonSetting title="Connect" onclick={directConnect} />
</Modal>
