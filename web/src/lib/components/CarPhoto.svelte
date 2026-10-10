<script lang="ts">
  import CarArt from './CarArt.svelte';
  let { id, fileBase, body, color, alt, eager = false }:
    { id: string | null | undefined; fileBase: string; body: string; color?: string | null; alt: string; eager?: boolean } = $props();
</script>

<div class="ph">
  {#if id}
    <img src={`${fileBase}/files/${id}`} {alt} loading={eager ? 'eager' : 'lazy'} decoding="async" />
  {:else}
    <CarArt {body} {color} label={`${alt}: photo coming soon`} />
  {/if}
</div>

<style>
  .ph { aspect-ratio: 4 / 3; background: #e9ecef; overflow: hidden; }
  .ph img { width: 100%; height: 100%; object-fit: cover; }
  .ph :global(svg) { height: 100%; }
</style>
