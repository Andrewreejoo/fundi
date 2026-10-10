<script lang="ts">
  import CarCard from '$lib/components/CarCard.svelte';
  let { data } = $props();
</script>

<svelte:head><title>Saved cars · Galimoto</title></svelte:head>

<div class="wrap page">
  <h1>Saved cars</h1>
  {#if data.cars.length}
    <p class="muted">{data.cars.length} saved. Reserved and sold cars stay here so you can see what happened to them.</p>
    <div class="grid">{#each data.cars as v (v.id)}<CarCard {v} fileBase={data.fileBase} />{/each}</div>
  {:else}
    <div class="panel empty stack" style="--gap:10px; margin-top:16px">
      <strong>No saved cars yet.</strong>
      <span>Tap Save on any car to keep it here.</span>
      <a class="btn" href="/cars" style="align-self:center">Browse cars for sale</a>
    </div>
  {/if}
</div>

<style>
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; margin-top: 14px; }
</style>
