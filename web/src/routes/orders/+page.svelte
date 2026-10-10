<script lang="ts">
  import { carTitle, dateLabel, mwk } from '$lib/format';
  import CarPhoto from '$lib/components/CarPhoto.svelte';
  import Plate from '$lib/components/Plate.svelte';
  import StatusPill from '$lib/components/StatusPill.svelte';

  let { data } = $props();
  const q = (as: string, scope: string) => `/orders?as=${as}&scope=${scope}`;
</script>

<svelte:head><title>Orders · Galimoto</title></svelte:head>

<div class="wrap page">
  <h1>{data.as === 'seller' ? 'Orders for your cars' : 'Your reservations and rentals'}</h1>
  <nav class="tabs" aria-label="Order filters">
    {#if data.user?.is_seller}
      <a href={q('buyer', data.scope)} aria-current={data.as === 'buyer' ? 'page' : undefined}>As buyer</a>
      <a href={q('seller', data.scope)} aria-current={data.as === 'seller' ? 'page' : undefined}>As seller</a>
      <span class="gap"></span>
    {/if}
    <a href={q(data.as, 'active')} aria-current={data.scope === 'active' ? 'page' : undefined}>Open</a>
    <a href={q(data.as, 'past')} aria-current={data.scope === 'past' ? 'page' : undefined}>Finished</a>
  </nav>

  <div class="list">
    {#each data.orders as o (o.id)}
      <a class="item" href={`/orders/${o.id}`}>
        <div class="ph"><CarPhoto id={o.photo_id} fileBase={data.fileBase} body={o.body_type} color={o.color} alt={carTitle(o)} /></div>
        <div class="stack" style="--gap:4px; min-width:0">
          <div class="row" style="--gap:8px"><strong>{carTitle(o)}</strong><StatusPill status={o.status} /></div>
          <span class="small muted">
            {o.kind === 'reservation' ? 'Reservation' : `Rental ${dateLabel(o.start_date)} to ${dateLabel(o.end_date)}${o.with_driver ? ', with driver' : ''}`}
            · {data.as === 'seller' ? o.buyer_name : o.seller_name}
          </span>
          <span class="row small" style="--gap:8px"><Plate text={o.ref} size="sm" /> {o.kind === 'reservation' ? 'Deposit' : 'Total'} <span class="price">{mwk(o.amount_mwk)}</span></span>
        </div>
      </a>
    {:else}
      <div class="panel empty stack" style="--gap:10px">
        <strong>No {data.scope === 'active' ? 'open' : 'finished'} orders.</strong>
        {#if data.as === 'buyer'}<span><a href="/cars">Find a car to buy</a> or <a href="/rent">hire a car</a>.</span>{/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .tabs { display: flex; gap: 4px; margin: 12px 0; flex-wrap: wrap; }
  .tabs a { padding: 8px 14px; border-radius: var(--radius); background: var(--surface); border: 1px solid var(--line); color: var(--ink); text-decoration: none; }
  .tabs a[aria-current='page'] { background: var(--asphalt); color: #fff; border-color: var(--asphalt); }
  .gap { width: 12px; }
  .list { display: flex; flex-direction: column; gap: 8px; }
  .item { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 12px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 10px; color: var(--ink); text-decoration: none; }
  .item:hover { border-color: #9aa3ad; text-decoration: none; }
  .ph { border-radius: 4px; overflow: hidden; }
</style>
