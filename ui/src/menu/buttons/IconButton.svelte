<script lang="ts">
  import Icon from "../Icon.svelte";

  interface Props {
    title: string;
    icon: string;
    onclick?: () => void;
  }

  let { title, icon, onclick }: Props = $props();
</script>

<button class="icon-button" type="button" title={title} aria-label={title} onclick={() => onclick?.()}>
  <span class="icon">
    <Icon name={icon} size={22} />
  </span>
</button>

<style lang="scss">
  @use "../../design/mixins.scss" as *;

  .icon-button {
    position: relative;
    background: transparent;
    border: none;
  }

  .icon {
    height: 44px;
    width: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--menu-title-button-icon-color);
    transition: color 0.2s ease;
  }

  .icon-button {
    @include hover {
      .icon { color: var(--menu-title-button-icon-hover-color); }
    }
  }
</style>
