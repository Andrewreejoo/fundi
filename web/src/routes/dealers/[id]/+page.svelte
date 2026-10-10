<script lang="ts">
  import CarCard from '$lib/components/CarCard.svelte';
  import Icon from '$lib/components/Icon.svelte';
  let { data } = $props();
  const s = $derived(data.seller);
</script>

<svelte:head><title>{s.name} · Galimoto</title></svelte:head>

<div class="wrap page">
  <header class="panel head">
    <div class="stack" style="--gap:4px">
      <span class="tiny muted">{s.kind === 'dealer' ? 'Dealer' : 'Private seller'}</span>
      <h1>{s.name}</h1>
      <span class="muted small"><Icon name="pin" size={14} /> {s.address ? `${s.address}, ` : ''}{s.area}, {s.district}</span>
      {#if s.about}<p>{s.about}</p>{/if}
    </div>
    <div class="stack" style="--gap:6px; align-items:flex-end">
      {#if s.verified}<span class="tag verified">Verified seller</span>{/if}
      <span class="small muted">{s.live_count} cars listed, {s.sold_count} sold</span>
      <span class="small muted">On Galimoto since {new Date(s.created_at).getFullYear()}</span>
    </div>
  </header>

  {#if data.sale.length}
    <div class="section-head"><h2>For sale</h2></div>
    <div class="grid">{#each data.sale as v (v.id)}<CarCard {v} fileBase={data.fileBase} />{/each}</div>
  {/if}
  {#if data.rent.length}
    <div class="section-head"><h2>For hire</h2></div>
    <div class="grid">{#each data.rent as v (v.id)}<CarCard {v} fileBase={data.fileBase} />{/each}</div>
  {/if}
  {#if !data.sale.length && !data.rent.length}<p class="panel empty">No cars listed right now.</p>{/if}
</div>

<style>
  .head { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  .head h1 { font-family: var(--font-cond); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; }
</style>
