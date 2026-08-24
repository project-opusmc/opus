<script lang="ts">
  import Icon from "../Icon.svelte";

  interface Props { title: string; icon: string; onclick?: () => void; }
  let { title, icon, onclick }: Props = $props();
</script>

<button
  class="menu-list-item-button"
  type="button"
  title={title}
  aria-label={title}
  onclick={(event) => {
    event.stopPropagation();
    onclick?.();
  }}
>
  <Icon name={icon} size={22} />
</button>

<style lang="scss">
  .menu-list-item-button {
    background-color: transparent;
    border: none;
    cursor: pointer;
    position: relative;
    margin-left: 14px;
    color: var(--menu-text-color);
    display: flex;
    align-items: center;
    transition: color 0.2s ease;

    &:hover { color: var(--accent-color); }
  }
</style>
