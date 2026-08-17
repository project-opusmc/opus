<script lang="ts">
  import { onMount } from "svelte";
  import PageShell from "../../components/PageShell.svelte";
  import AccountEntry from "../../components/AccountEntry.svelte";
  import Badge from "../../primitives/Badge.svelte";
  import Button from "../../primitives/Button.svelte";
  import Modal from "../../primitives/Modal.svelte";
  import ScrollArea from "../../primitives/ScrollArea.svelte";
  import Select from "../../primitives/Select.svelte";
  import TextInput from "../../primitives/TextInput.svelte";
  import { api } from "../../integration/api";
  import type { Account, AccountKind } from "../../integration/types";

  let accounts: Account[] = $state([]);
  let loading = $state(true);
  let selected = $state(0);
  let addOpen = $state(false);
  let newKind = $state<AccountKind>("official");
  let newUsername = $state("");

  onMount(async () => {
    accounts = await api.getAccounts();
    loading = false;
  });

  function addAccount() {
    if (!newUsername.trim()) {
      return;
    }
    const account: Account = {
      id: `acc-${Date.now()}`,
      label: newKind === "official" ? "Official" : "Unofficial",
      username: newUsername.trim(),
      kind: newKind,
      note: newKind === "official" ? "Microsoft account" : "Offline identity",
    };
    accounts = [...accounts, account];
    newUsername = "";
    addOpen = false;
  }

  function removeAccount(id: string) {
    accounts = accounts.filter((account) => account.id !== id);
    selected = Math.max(0, selected - 1);
  }
</script>

<PageShell
  title="Accounts"
  description="Manage Microsoft and unofficial identities used at launch."
  badge={String(accounts.length)}
>
  {#snippet actions()}
    <Button onclick={() => (addOpen = true)}>Add Account</Button>
  {/snippet}

  {#if loading}
    <div class="state text-secondary motion-pulse">Loading accounts…</div>
  {:else if accounts.length === 0}
    <div class="state">
      <span class="text-regular">No accounts yet.</span>
      <span class="text-secondary">Add one to launch a session.</span>
    </div>
  {:else}
    <ScrollArea>
      <div class="account-list">
        {#each accounts as account, index (account.id)}
          <AccountEntry
            {account}
            selected={selected === index}
            onselect={() => (selected = index)}
            onremove={() => removeAccount(account.id)}
          />
        {/each}
      </div>
    </ScrollArea>
  {/if}
</PageShell>

<Modal
  open={addOpen}
  title="Add Account"
  onclose={() => (addOpen = false)}
>
  <div class="add-form">
    <Select
      label="Account type"
      value={newKind}
      options={[
        { value: "official", label: "Official · Microsoft" },
        { value: "unofficial", label: "Unofficial · Offline" },
        { value: "demo", label: "Demo profile" },
      ]}
      onchange={(value) => (newKind = value as AccountKind)}
    />
    <TextInput
      bind:value={newUsername}
      label="Username"
      placeholder="playername"
    />
    <Badge tone="neutral">
      {newKind === "official"
        ? "Sign-in happens through the Opus launcher."
        : "This identity is stored locally."}
    </Badge>
  </div>
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (addOpen = false)}>Cancel</Button>
    <Button
      variant="primary"
      disabled={!newUsername.trim()}
      onclick={addAccount}
    >
      Add
    </Button>
  {/snippet}
</Modal>

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

  .account-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    max-width: 720px;
  }

  .add-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-16);
  }
</style>
