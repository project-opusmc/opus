<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "../Icon.svelte";

  interface Props {
    icon: string;
    title?: string;
    type?: "text" | "password";
    value?: string;
    children?: Snippet;
  }

  let { icon, title = "", type = "text", value = $bindable(""), children }: Props =
    $props();
</script>

<div class="icon-text-input">
  <div class="icon"><Icon name={icon} size={22} /></div>
  {#if type === "password"}
    <input class="input" type="password" placeholder={title} bind:value autocomplete="off" />
  {:else}
    <input class="input" type="text" placeholder={title} bind:value spellcheck="false" autocomplete="off" />
  {/if}
  <div class="button-container">
    {@render children?.()}
  </div>
</div>

<style lang="scss">
  .icon-text-input {
    display: grid;
    grid-template-columns: max-content 1fr max-content;
  }

  .icon {
    height: 52px;
    width: 52px;
    color: var(--menu-text-color);
    background-color: var(--menu-input-icon-background-color);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-control) 0 0 var(--radius-control);
  }

  .input {
    color: var(--menu-text-color);
    font-family: var(--font-family);
    font-size: 16px;
    background-color: var(--menu-input-background-color);
    border: none;
    padding: 0 18px;
    border-radius: 0 var(--radius-control) var(--radius-control) 0;
    border-left: solid 2px var(--menu-input-divider-color);
    width: 100%;

    &::placeholder { color: color-mix(in srgb, var(--menu-text-color) 45%, transparent); }
  }

  .button-container { display: flex; align-items: center; }
</style>
