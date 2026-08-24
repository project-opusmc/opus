<script lang="ts">
  // Original, single-weight line/solid icon set drawn inline with currentColor.
  // We deliberately do not vendor LiquidBounce's GPL SVG assets; these are our
  // own simple glyphs so the menu never depends on externally served images.
  interface Props {
    name: string;
    size?: number;
    class?: string;
  }

  let { name, size = 22, class: className = "" }: Props = $props();

  // Each entry is the inner markup of a 24x24 viewBox using currentColor.
  const paths: Record<string, string> = {
    singleplayer:
      '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.4 3.8 5.6 3.8 9s-1.3 6.6-3.8 9c-2.5-2.4-3.8-5.6-3.8-9S9.5 5.4 12 3Z"/>',
    multiplayer:
      '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/>',
    options:
      '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M4.2 7l2.6 1.5M17.2 15.5l2.6 1.5M4.2 17l2.6-1.5M17.2 8.5l2.6-1.5"/>',
    client:
      '<path d="M12 2.6l2.7 5.9 6.4.7-4.8 4.3 1.3 6.3L12 16.9 6.4 20l1.3-6.3L2.9 9.4l6.4-.7Z"/>',
    modules:
      '<rect x="3.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.2"/>',
    hud:
      '<rect x="3.5" y="3.5" width="17" height="17" rx="1.6"/><path d="M3.5 9h17M9 9v11.5"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    exit: '<path d="M12 3v9M7.5 6.5a8 8 0 1 0 9 0"/>',
    play: '<path d="M8 5.5l11 6.5-11 6.5Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    refresh:
      '<path d="M20 11a8 8 0 1 0-.6 4M20 5v5h-5"/>',
    trash:
      '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l.8 12.5h9.4L18 7"/>',
    pen: '<path d="M14.5 4.5l5 5M4 20l1-4L16.5 4.5a1.6 1.6 0 0 1 2.3 0l0.7.7a1.6 1.6 0 0 1 0 2.3L8 19l-4 1Z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    chevron: '<path d="M6 9l6 6 6-6"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    user:
      '<circle cx="12" cy="8" r="4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
    random:
      '<path d="M4 7h3.5l9 10H20M4 17h3.5l9-10H20M17 4l3 3-3 3M17 14l3 3-3 3"/>',
    github:
      '<path d="M12 2.2a9.8 9.8 0 0 0-3.1 19.1c.5.1.7-.2.7-.5v-1.8c-2.7.6-3.3-1.3-3.3-1.3-.5-1.1-1.1-1.4-1.1-1.4-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.3-1.1.6-1.3-2.2-.2-4.5-1.1-4.5-4.9 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.6 0 0 .8-.3 2.7 1a9.3 9.3 0 0 1 4.9 0c1.9-1.3 2.7-1 2.7-1 .5 1.3.2 2.3.1 2.6.6.7 1 1.6 1 2.7 0 3.8-2.3 4.7-4.5 4.9.3.3.7 1 .7 2v2.9c0 .3.2.6.7.5A9.8 9.8 0 0 0 12 2.2Z"/>',
    globe:
      '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.4 3.8 5.6 3.8 9s-1.3 6.6-3.8 9c-2.5-2.4-3.8-5.6-3.8-9S9.5 5.4 12 3Z"/>',
  };

  let markup = $derived(paths[name] ?? "");
</script>

<svg
  class="opus-icon {className}"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.7"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {@html markup}
</svg>

<style lang="scss">
  .opus-icon {
    display: block;
    flex: none;
  }

  // Filled glyphs read better as solids; fill them from currentColor.
  .opus-icon.is-solid {
    fill: currentColor;
    stroke: none;
  }
</style>
