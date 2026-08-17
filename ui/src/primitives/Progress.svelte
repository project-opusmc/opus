<script lang="ts">
  type Size = "sm" | "md";

  interface Props {
    value: number;
    max?: number;
    size?: Size;
    indeterminate?: boolean;
    class?: string;
  }

  let {
    value,
    max = 100,
    size = "md",
    indeterminate = false,
    class: className = "",
  }: Props = $props();

  let bounded = $derived(Math.max(0, Math.min(value, max)));
  let percent = $derived(max <= 0 ? 0 : Math.round((bounded / max) * 100));
</script>

<div
  class="progress progress--{size} {className}"
  role="progressbar"
  aria-valuemin={0}
  aria-valuemax={max}
  aria-valuenow={indeterminate ? undefined : bounded}
>
  <div
    class="progress__bar"
    class:progress__bar--indeterminate={indeterminate}
    style:width={indeterminate ? undefined : `${percent}%`}
  ></div>
</div>

<style lang="scss">
  .progress {
    position: relative;
    overflow: hidden;
    width: 100%;
    border-radius: var(--radius-pill);
    background: var(--surface-3);
    border: 1px solid var(--border-subtle);
  }

  .progress--sm {
    height: 6px;
  }

  .progress--md {
    height: 10px;
  }

  .progress__bar {
    height: 100%;
    border-radius: var(--radius-pill);
    background: var(--accent);
    transition: width var(--motion-medium) var(--ease-standard);
  }

  .progress__bar--indeterminate {
    width: 34%;
    animation: opus-progress-indeterminate var(--motion-large) var(--ease-standard)
      infinite;
  }

  @keyframes opus-progress-indeterminate {
    0% {
      transform: translateX(-110%);
    }
    100% {
      transform: translateX(310%);
    }
  }
</style>
