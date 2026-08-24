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
  import Modal from "../../menu/modal/Modal.svelte";
  import IconTextInput from "../../menu/setting/IconTextInput.svelte";
  import ButtonSetting from "../../menu/setting/ButtonSetting.svelte";
  import Icon from "../../menu/Icon.svelte";
  import { api, bridge } from "../../integration/api";
  import { isStandalone } from "../../integration/host";
  import { back } from "../../stores/ui";
  import type { Account, AccountKind } from "../../integration/types";

  // AltManager, decluttered: one list of identities, one "active" marker, and a
  // single Add modal (Microsoft vs Offline). No duplicated per-row status
  // labels — the type is a single tag, the active identity gets the accent.
  let accounts: Account[] = $state([]);
  let searchQuery = $state("");
  let addVisible = $state(false);
  let newKind = $state<AccountKind>("official");
  let newUsername = $state("");
  let loading = $state(true);
  let error = $state("");

  let rendered = $derived(
    accounts.filter(
      (account) =>
        searchQuery.trim() === "" ||
        account.username.toLowerCase().includes(searchQuery.trim().toLowerCase()),
    ),
  );

  async function loadAccounts() {
    loading = true;
    error = "";
    try {
      if (isStandalone) {
        accounts = await api.getAccounts();
        return;
      }
      const hello = await bridge.hello();
      accounts = hello.session
        ? [{ id: "current", username: hello.session, kind: hello.accountKind, active: true }]
        : [];
    } catch (failure) {
      accounts = [];
      error = failure instanceof Error ? failure.message : "Could not read account session";
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void loadAccounts();
  });

  function use(id: string) {
    accounts = accounts.map((account) => ({
      ...account,
      active: account.id === id,
    }));
  }

  function remove(id: string) {
    accounts = accounts.filter((account) => account.id !== id);
  }

  function add() {
    if (newKind === "unofficial") {
      if (!newUsername.trim()) return;
      accounts = [
        ...accounts,
        { id: `acc-${Date.now()}`, username: newUsername.trim(), kind: "unofficial" },
      ];
    }
    // Microsoft sign-in is owned by the launcher; the modal only starts it.
    newUsername = "";
    addVisible = false;
  }
</script>

<OptionBar>
  <Search bind:value={searchQuery} placeholder="Search accounts..." />
</OptionBar>

<MenuList>
  <RouteState
    loading={loading}
    error={error}
    retry={() => void loadAccounts()}
    empty={rendered.length === 0 ? "No account session is available." : ""}
  />
  {#if !loading && !error}
    {#each rendered as account (account.id)}
      <MenuListItem title={account.username}>
        {#snippet subtitle()}
          <span>{account.kind === "official" ? "Microsoft account" : "Offline identity"}</span>
        {/snippet}
        {#snippet tag()}
          {#if account.active}
            <MenuListItemTag text="Active" />
          {/if}
          <MenuListItemTag text={account.kind === "official" ? "Microsoft" : "Offline"} />
        {/snippet}
        {#snippet activeVisible()}
          {#if isStandalone}
            <MenuListItemButton title="Remove" icon="trash" onclick={() => remove(account.id)} />
          {/if}
        {/snippet}
        {#snippet alwaysVisible()}
          {#if isStandalone && !account.active}
            <MenuListItemButton title="Use" icon="play" onclick={() => use(account.id)} />
          {/if}
        {/snippet}
      </MenuListItem>
    {/each}
  {/if}
</MenuList>

<BottomButtonWrapper>
  {#if isStandalone}<ButtonContainer>
    <IconTextButton icon="plus" title="Add" onclick={() => (addVisible = true)} />
    <IconTextButton icon="random" title="Random" onclick={() => {
      accounts = [
        ...accounts,
        { id: `acc-${Date.now()}`, username: `Player${Math.floor(Math.random() * 9999)}`, kind: "unofficial" },
      ];
    }} />
  </ButtonContainer>{/if}
  <ButtonContainer>
    <IconTextButton icon="back" title="Back" onclick={() => void back()} />
  </ButtonContainer>
</BottomButtonWrapper>

{#if isStandalone}<Modal title="Add Account" bind:visible={addVisible}>
  <div class="kinds">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="kind" class:active={newKind === "official"} onclick={() => (newKind = "official")}>
      <Icon name="user" size={26} />
      <span class="kind-title">Microsoft</span>
      <span class="kind-note">Official session</span>
    </div>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="kind" class:active={newKind === "unofficial"} onclick={() => (newKind = "unofficial")}>
      <Icon name="globe" size={26} />
      <span class="kind-title">Offline</span>
      <span class="kind-note">Username only</span>
    </div>
  </div>

  {#if newKind === "unofficial"}
    <IconTextInput icon="user" title="Username" bind:value={newUsername} />
  {/if}

  <ButtonSetting onclick={add}>
    {newKind === "official" ? "Sign in with Microsoft" : "Add offline account"}
  </ButtonSetting>
</Modal>{/if}

<style lang="scss">
  .kinds {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .kind {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 22px 16px;
    border-radius: var(--radius-control);
    background: var(--menu-base-36-color);
    color: var(--menu-text-color);
    border: solid 2px transparent;
    cursor: pointer;
    transition: border-color 0.2s ease;

    &.active { border-color: var(--accent-color); }
  }

  .kind-title { font-size: 17px; font-weight: 600; }
  .kind-note { font-size: 13px; color: var(--menu-text-dimmed-color); }
</style>
