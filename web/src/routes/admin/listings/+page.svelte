<script lang="ts">
  import { enhance } from '$app/forms';
  import { carTitle, dateTime, km, localPhone, mwk } from '$lib/format';
  import CarPhoto from '$lib/components/CarPhoto.svelte';
  import Plate from '$lib/components/Plate.svelte';
  let { data, form } = $props();
  const TABS = [['pending', 'To check'], ['live', 'Live'], ['rejected', 'Sent back'], ['paused', 'Paused'], ['sold', 'Sold']];
</script>

<svelte:head><title>Listings · Admin · GalimotoYanga</title></svelte:head>

<div class="row between"><h1>Listings</h1>
  <nav class="filters" aria-label="Status">{#each TABS as [k, l]}<a href={`?status=${k}`} aria-current={data.status === k ? 'page' : undefined}>{l}</a>{/each}</nav>
</div>
{#if form?.error}<p class="alert error">{form.error}</p>{/if}

{#each data.list as c (c.id)}
  <article class="panel item">
    <div class="photos">
      {#each (c.photo_ids ?? []).slice(0, 4) as id}<img src={`${data.fileBase}/files/${id}`} alt="" loading="lazy" />{:else}<CarPhoto id={null} fileBase={data.fileBase} body={c.body_type} color={c.color} alt="" />{/each}
    </div>
    <div class="stack" style="--gap:5px">
      <div class="row" style="--gap:8px"><a href={`/cars/${c.stock_no}`}><strong>{carTitle(c)}</strong></a> <Plate text={c.stock_no} size="sm" /> {#if c.featured}<span class="tag new">Featured</span>{/if}</div>
      <span class="small">{c.purpose === 'sale' ? mwk(c.price_mwk) : `${mwk(c.daily_rate_mwk)}/day`} · {c.mileage_km != null ? km(c.mileage_km) : 'no mileage'} · {c.area}, {c.district} · plate {c.plate ?? 'not given'}</span>
      <span class="small muted">{c.seller_name} ({c.seller_kind}{c.seller_verified ? ', verified' : ''}) {localPhone(c.seller_phone)} · listed {dateTime(c.created_at)}</span>
      {#if c.description}<p class="small desc">{c.description}</p>{/if}
      {#if c.reject_reason}<p class="small" style="color:var(--drop)">Sent back: {c.reject_reason}</p>{/if}
    </div>
    <div class="acts stack" style="--gap:6px">
      {#if ['pending', 'rejected', 'paused'].includes(c.status)}
        <form method="POST" action="?/approve" use:enhance><input type="hidden" name="id" value={c.id} /><button class="btn sm block">Approve</button></form>
      {/if}
      {#if ['pending', 'live'].includes(c.status)}
        <form method="POST" action="?/reject" class="stack" style="--gap:4px" use:enhance>
          <input type="hidden" name="id" value={c.id} />
          <input name="reason" required minlength="3" maxlength="300" placeholder="Reason for the seller" aria-label="Reason" />
          <button class="btn plain sm block">Send back</button>
        </form>
      {/if}
      {#if c.status === 'live'}
        <form method="POST" action="?/feature" use:enhance><input type="hidden" name="id" value={c.id} /><input type="hidden" name="on" value={String(!c.featured)} /><button class="btn plain sm block">{c.featured ? 'Unfeature' : 'Feature on home'}</button></form>
      {/if}
    </div>
  </article>
{:else}
  <p class="panel muted">Nothing here.</p>
{/each}

<style>
  .item { display: grid; grid-template-columns: 220px minmax(0, 1fr) 190px; gap: 14px; align-items: start; }
  .photos { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; }
  .photos img { width: 100%; aspect-ratio: 4/3; object-fit: cover; border-radius: 3px; }
  .desc { white-space: pre-line; max-height: 7.5em; overflow: auto; background: var(--sunk); padding: 6px 8px; border-radius: 4px; }
  @media (max-width: 900px) { .item { grid-template-columns: 1fr; } }
</style>
