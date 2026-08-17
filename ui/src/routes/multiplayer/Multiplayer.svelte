<script lang="ts">
  import { onMount } from "svelte";
  import PageShell from "../../components/PageShell.svelte";
  import ServerEntry from "../../components/ServerEntry.svelte";
  import Button from "../../primitives/Button.svelte";
  import Modal from "../../primitives/Modal.svelte";
  import ScrollArea from "../../primitives/ScrollArea.svelte";
  import SearchInput from "../../primitives/SearchInput.svelte";
  import TextInput from "../../primitives/TextInput.svelte";
  import { api, bridge } from "../../integration/api";
  import { isStandalone } from "../../integration/host";
  import type { Server } from "../../integration/types";

  let servers: Server[] = $state([]);
  let loading = $state(true);
  let selected = $state(0);
  let query = $state("");
  let addOpen = $state(false);
  let newName = $state("");
  let newAddress = $state("");
  let direct = $state("");

  let filtered = $derived(
    query.trim()
      ? servers.filter(
          (server) =>
            server.name.toLowerCase().includes(query.trim().toLowerCase()) ||
            server.address.toLowerCase().includes(query.trim().toLowerCase()),
        )
      : servers,
  );

  onMount(async () => {
    servers = isStandalone ? await api.getServers() : await bridge.getServers();
    loading = false;
  });

  async function addServer() {
    if (!newName.trim() || !newAddress.trim()) {
      return;
    }
    if (isStandalone) {
      const server = await api.addServer(newName.trim(), newAddress.trim());
      servers = [...servers, server];
    } else {
      await bridge.addServer(newName.trim(), newAddress.trim());
      servers = await bridge.getServers();
    }
    newName = "";
    newAddress = "";
    addOpen = false;
  }

  async function directConnect() {
    if (!direct.trim()) {
      return;
    }
    if (isStandalone) {
      const server = await api.addServer(direct.trim(), direct.trim());
      servers = [...servers, server];
    } else {
      await bridge.addServer(direct.trim(), direct.trim());
      servers = await bridge.getServers();
      await bridge.connectServer(direct.trim());
    }
    selected = servers.length - 1;
    direct = "";
  }
</script>

<PageShell
  title="Multiplayer"
  description="Join servers through the Opus client runtime."
  badge="SERVERS"
>
  {#snippet actions()}
    <Button onclick={() => (addOpen = true)}>Add Server</Button>
  {/snippet}

  <div class="multiplayer">
    <div class="multiplayer__toolbar">
      <SearchInput bind:value={query} placeholder="Search servers" />
      <TextInput
        bind:value={direct}
        placeholder="play.example.com:25565"
        hint="Direct connect"
      />
      <Button
        variant="primary"
        disabled={!direct.trim()}
        onclick={directConnect}
      >
        Connect
      </Button>
    </div>

    {#if loading}
      <div class="state text-secondary motion-pulse">Loading servers…</div>
    {:else if filtered.length === 0}
      <div class="state">
        <span class="text-regular">No servers match.</span>
        <span class="text-secondary">Add one or change the search.</span>
      </div>
    {:else}
      <ScrollArea>
        <div class="server-list">
          {#each filtered as server, index (server.id)}
            <ServerEntry
              {server}
              selected={selected === index}
              onselect={() => {
                selected = index;
                if (isStandalone) {
                  console.info("[opus-ui] join", server.address);
                } else {
                  void bridge.connectServer(server.address);
                }
              }}
            />
          {/each}
        </div>
      </ScrollArea>
    {/if}
  </div>
</PageShell>

<Modal
  open={addOpen}
  title="Add Server"
  onclose={() => (addOpen = false)}
>
  <div class="add-form">
    <TextInput
      bind:value={newName}
      label="Server name"
      placeholder="Opus Network"
    />
    <TextInput
      bind:value={newAddress}
      label="Address"
      placeholder="play.example.com:25565"
    />
  </div>
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (addOpen = false)}>Cancel</Button>
    <Button
      variant="primary"
      disabled={!newName.trim() || !newAddress.trim()}
      onclick={addServer}
    >
      Save
    </Button>
  {/snippet}
</Modal>

<style lang="scss">
  .multiplayer {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    gap: var(--space-16);
  }

  .multiplayer__toolbar {
    display: flex;
    align-items: end;
    gap: var(--space-12);
    flex: none;
  }

  .multiplayer__toolbar :global(.search-input) {
    width: 280px;
  }

  .multiplayer__toolbar :global(.text-input) {
    flex: 1;
    max-width: 380px;
  }

  .state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-8);
    height: 100%;
    color: var(--text-muted);
  }

  .server-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  .add-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-16);
  }
</style>
