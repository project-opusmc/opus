<script lang="ts">
  // Original Opus wordmark: a rounded "O" badge next to the word OPUS with a
  // small accent client tag. Deliberately NOT the LiquidBounce logo (that mark
  // is trademarked); this is our own branding drawn from scratch.
  interface Props { compact?: boolean; }
  let { compact = false }: Props = $props();
</script>

<div class="opus-logo" class:compact>
  <span class="mark" aria-hidden="true">
    <svg viewBox="0 0 48 48" width="100%" height="100%">
      <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" stroke-width="6" />
      <circle cx="24" cy="24" r="6.5" fill="currentColor" />
    </svg>
  </span>
  <span class="text">
    <span class="word">OPUS</span>
    <span class="tag">CLIENT</span>
  </span>
</div>

<style lang="scss">
  .opus-logo {
    display: flex;
    align-items: center;
    gap: 18px;
    color: var(--menu-text-color);
  }

  .mark {
    width: 62px;
    height: 62px;
    color: var(--accent-color);
    display: block;
  }

  .text {
    display: flex;
    flex-direction: column;
    line-height: 1;
  }

  .word {
    font-size: 44px;
    font-weight: 700;
    letter-spacing: 0.14em;
    color: var(--menu-text-color);
  }

  .tag {
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.42em;
    margin-top: 6px;
    color: var(--accent-color);
  }

  .compact {
    gap: 12px;

    .mark { width: 40px; height: 40px; }
    .word { font-size: 28px; }
    .tag { font-size: 11px; letter-spacing: 0.36em; margin-top: 4px; }
  }

  @media (max-height: 600px) {
    .opus-logo { gap: 12px; }
    .mark { width: 42px; height: 42px; }
    .word { font-size: 28px; }
    .tag { font-size: 10px; letter-spacing: 0.32em; margin-top: 3px; }
  }
</style>
