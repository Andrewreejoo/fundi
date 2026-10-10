<script lang="ts">
  /** Malawi-style yellow number plate. Used for the logo, stock numbers and headline prices. */
  let { text, size = 'md', title }: { text: string; size?: 'sm' | 'md' | 'lg' | 'xl'; title?: string } = $props();
</script>

<span class="plate {size}" {title}>{text}</span>

<style>
  .plate {
    display: inline-block; background: var(--plate); color: var(--plate-ink);
    font-family: var(--font-cond); font-weight: 700; letter-spacing: 1px; line-height: 1;
    border: 2px solid var(--plate-ink); border-radius: 4px; white-space: nowrap;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.5);
  }
  .sm { font-size: 13px; padding: 2px 5px 1px; border-width: 1.5px; letter-spacing: 0.6px; }
  .md { font-size: 17px; padding: 4px 8px 3px; }
  .lg { font-size: 26px; padding: 5px 11px 4px; }
  .xl { font-size: 30px; padding: 4px 12px 3px; letter-spacing: 2px; }
</style>
