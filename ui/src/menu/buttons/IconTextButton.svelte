<script lang="ts">
  import Icon from "../Icon.svelte";

  interface Props {
    title: string;
    icon: string;
    disabled?: boolean;
    onclick?: () => void;
  }

  let { title, icon, disabled = false, onclick }: Props = $props();
</script>

<button class="icon-text-button" {disabled} type="button" onclick={() => onclick?.()}>
  <span class="icon">
    <Icon name={icon} size={22} />
  </span>
  <span class="title">{title}</span>
</button>

<style lang="scss">
  @use "../../design/mixins.scss" as *;

.icon-text-button {
    display: flex;
    border: none;
    border-radius: var(--radius-control);
    align-items: center;
    overflow: hidden;
    max-width: 100%;
    background: linear-gradient(
      to left,
      var(--menu-icon-text-button-background-color) 50%,
      var(--menu-icon-text-button-accent-color) 50%
    );
    background-size: 200% 100%;
    background-position: right bottom;
    will-change: background-position;
    transition: opacity 0.2s ease, background-position 0.2s ease-out;

    @include hover {
      background-position: left bottom;
      cursor: pointer;
    }

    &[disabled] {
      opacity: 0.6;
      pointer-events: none;
    }
  }

  .icon {
    height: 44px;
    width: 44px;
    color: var(--menu-title-button-icon-color);
    background-color: var(--menu-icon-text-button-icon-background-color);
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
  }

  .title {
    font-size: 15px;
    font-weight: 500;
    color: var(--menu-text-color);
    padding: 0 20px;
    white-space: nowrap;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @media (max-height: 600px) {
    .icon { height: 36px; width: 36px; }
    .title { font-size: 13px; padding: 0 12px; }
  }
</style>
