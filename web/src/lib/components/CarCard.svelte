<script lang="ts">
  import { carTitle, km, mwk } from '$lib/format';
  import CarPhoto from './CarPhoto.svelte';
  import Plate from './Plate.svelte';

  /** Compact grid card used on the home page, favourites and "similar cars". */
  let { v, fileBase }: { v: any; fileBase: string } = $props();
  const rent = $derived(v.purpose === 'rent');
  const dropped = $derived(!rent && v.previous_price_mwk > v.price_mwk);
</script>

<a class="card" href={`/cars/${v.stock_no}`}>
  <div class="media">
    <CarPhoto id={v.photo_id} {fileBase} body={v.body_type} color={v.color} alt={carTitle(v)} />
    <div class="flags">
      {#if v.status === 'reserved'}<span class="tag held">Reserved</span>
      {:else if v.status === 'sold'}<span class="tag quiet">Sold</span>
      {:else if dropped}<span class="tag drop">Price down</span>
      {:else if v.is_new}<span class="tag new">New</span>{/if}
    </div>
  </div>
  <div class="body">
    <div class="title">{carTitle(v)}</div>
    <div class="specs">
      {#if v.mileage_km != null}<span>{km(v.mileage_km)}</span>{/if}
      <span>{v.transmission === 'automatic' ? 'Auto' : 'Manual'}</span>
      <span>{v.area}, {v.district}</span>
    </div>
    <div class="money">
      {#if rent}
        <span class="price">{mwk(v.daily_rate_mwk)}</span><span class="per">/day</span>
      {:else}
        <span class="price">{mwk(v.price_mwk)}</span>
        {#if dropped}<span class="price was small">{mwk(v.previous_price_mwk)}</span>{/if}
      {/if}
    </div>
    <div class="foot"><Plate text={v.stock_no} size="sm" /> <span class="seller">{v.seller_name}{#if v.seller_verified} ✓{/if}</span></div>
  </div>
</a>

<style>
  .card { display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; color: var(--ink); text-decoration: none; }
  .card:hover { border-color: #9aa3ad; text-decoration: none; }
  .card:hover .title { text-decoration: underline; }
  .media { position: relative; }
  .flags { position: absolute; top: 8px; left: 8px; display: flex; gap: 4px; }
  .body { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 4px; }
  .title { font-weight: 700; font-size: 16px; }
  .specs { display: flex; flex-wrap: wrap; gap: 4px 10px; font-size: 13px; color: var(--muted); }
  .money { display: flex; align-items: baseline; gap: 8px; margin-top: 2px; }
  .money .price { font-size: 22px; }
  .per { color: var(--muted); font-size: 14px; }
  .foot { display: flex; align-items: center; gap: 8px; margin-top: 4px; font-size: 13px; color: var(--muted); min-width: 0; }
  .seller { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
