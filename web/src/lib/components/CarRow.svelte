<script lang="ts">
  import { page } from '$app/state';
  import { BODY_LABEL, carTitle, cc, km, mwk } from '$lib/format';
  import CarPhoto from './CarPhoto.svelte';
  import Icon from './Icon.svelte';
  import Plate from './Plate.svelte';

  /** BE FORWARD-style stock list row: photo, spec grid, price column, save and compare. */
  let { v, fileBase, comparing = false, deposit }: { v: any; fileBase: string; comparing?: boolean; deposit?: number } = $props();
  const rent = $derived(v.purpose === 'rent');
  const dropped = $derived(!rent && v.previous_price_mwk > v.price_mwk);
  const here = $derived(page.url.pathname + page.url.search);
</script>

<article class="row-card" class:held={v.status !== 'live'}>
  <a class="media" href={`/cars/${v.stock_no}`} tabindex="-1" aria-hidden="true">
    <CarPhoto id={v.photo_id} {fileBase} body={v.body_type} color={v.color} alt={carTitle(v)} />
    {#if v.photo_count > 1}<span class="count">{v.photo_count} photos</span>{/if}
  </a>

  <div class="info">
    <div class="titleline">
      <h3><a href={`/cars/${v.stock_no}`}>{carTitle(v)}</a></h3>
      {#if v.status === 'reserved'}<span class="tag held">Reserved</span>{/if}
      {#if dropped}<span class="tag drop">Price down</span>{/if}
      {#if v.is_new && !dropped}<span class="tag new">New</span>{/if}
      {#if v.featured}<span class="tag quiet">Featured</span>{/if}
    </div>
    <div class="sub">{v.variant ?? ''} <Plate text={v.stock_no} size="sm" /></div>
    <dl class="specs">
      <div><dt>Year</dt><dd>{v.year}</dd></div>
      <div><dt>Mileage</dt><dd>{v.mileage_km != null ? km(v.mileage_km) : '–'}</dd></div>
      <div><dt>Engine</dt><dd>{v.engine_cc ? cc(v.engine_cc) : '–'}</dd></div>
      <div><dt>Transmission</dt><dd>{v.transmission === 'automatic' ? 'Automatic' : 'Manual'}</dd></div>
      <div><dt>Fuel</dt><dd>{v.fuel[0].toUpperCase() + v.fuel.slice(1)}</dd></div>
      <div><dt>{rent ? 'Seats' : 'Drive'}</dt><dd>{rent ? v.seats ?? '–' : v.drive.toUpperCase()} · {BODY_LABEL[v.body_type]}</dd></div>
    </dl>
    <div class="where">
      <Icon name="pin" size={15} /> {v.area}, {v.district}
      <span class="sep">|</span>
      {v.seller_kind === 'dealer' ? 'Dealer' : 'Private seller'}: {v.seller_name}
      {#if v.seller_verified}<span class="tag verified">Verified</span>{/if}
    </div>
  </div>

  <div class="buy">
    {#if rent}
      <div class="label">From</div>
      <div class="price big">{mwk(v.daily_rate_mwk)}<span class="per"> /day</span></div>
      <div class="note">
        {#if v.self_drive && v.driver_rate_mwk != null}Self-drive or with driver
        {:else if v.self_drive}Self-drive only
        {:else}With driver{/if}
        {#if v.min_days > 1} · min {v.min_days} days{/if}
      </div>
    {:else}
      <div class="label">Price</div>
      <div class="price big">{mwk(v.price_mwk)}</div>
      {#if dropped}<div class="price was">{mwk(v.previous_price_mwk)}</div>{/if}
      {#if deposit && v.status === 'live'}<div class="note">Reserve with {mwk(deposit)} deposit</div>{/if}
    {/if}
    <a class="btn block" href={`/cars/${v.stock_no}`}>{rent ? 'Check dates' : 'View car'}</a>
    <div class="tools">
      <form method="POST" action="/favorites?/toggle">
        <input type="hidden" name="id" value={v.id} /><input type="hidden" name="next" value={here} />
        <button class="linkbtn" aria-label="Save to favourites"><Icon name={v.is_favorite ? 'heart-fill' : 'heart'} size={17} /> Save</button>
      </form>
      <form method="POST" action="/compare?/toggle">
        <input type="hidden" name="id" value={v.id} /><input type="hidden" name="next" value={here} />
        <button class="linkbtn" aria-pressed={comparing}><Icon name="compare" size={17} /> {comparing ? 'Comparing' : 'Compare'}</button>
      </form>
    </div>
  </div>
</article>

<style>
  .row-card { display: grid; grid-template-columns: 250px minmax(0, 1fr) 220px; gap: 16px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 12px; }
  .row-card.held { background: #fbfbfa; }
  .media { position: relative; display: block; border-radius: 4px; overflow: hidden; }
  .count { position: absolute; right: 6px; bottom: 6px; background: rgba(20, 22, 26, 0.75); color: #fff; font-size: 12px; padding: 2px 6px; border-radius: 3px; }
  .info { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .titleline { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; }
  h3 { font-size: 19px; }
  h3 a { color: var(--ink); }
  .sub { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 14px; }
  .specs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 4px 0 0; border: 1px solid var(--line); border-radius: 4px; }
  .specs div { padding: 5px 8px; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); }
  .specs div:nth-child(3n) { border-right: 0; }
  .specs div:nth-child(n + 4) { border-bottom: 0; }
  dt { font-size: 12px; color: var(--muted); }
  dd { margin: 0; font-size: 14px; font-weight: 600; }
  .where { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; font-size: 13px; color: var(--muted); margin-top: auto; }
  .sep { color: var(--line-strong); }
  .buy { display: flex; flex-direction: column; gap: 4px; border-left: 1px solid var(--line); padding-left: 16px; }
  .label { font-size: 13px; color: var(--muted); }
  .big { font-size: 26px; line-height: 1.1; }
  .per { font-size: 15px; color: var(--muted); font-weight: 600; }
  .note { font-size: 13px; color: var(--muted); margin-bottom: 6px; }
  .buy .btn { margin-top: auto; }
  .tools { display: flex; justify-content: space-between; margin-top: 4px; }
  .linkbtn { background: none; border: 0; padding: 4px 0; font: inherit; font-size: 14px; color: #1d5fa8; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; min-height: 32px; }
  .linkbtn:hover { text-decoration: underline; }
  @media (max-width: 900px) {
    .row-card { grid-template-columns: 180px minmax(0, 1fr); }
    .buy { grid-column: 1 / -1; border-left: 0; padding-left: 0; border-top: 1px solid var(--line); padding-top: 10px; display: grid; grid-template-columns: 1fr auto; align-items: center; }
    .buy .label, .buy .note, .buy .was { grid-column: 1; }
    .buy .btn { grid-column: 2; grid-row: 1 / span 3; margin: 0; }
    .tools { grid-column: 1 / -1; justify-content: flex-start; gap: 18px; }
  }
  @media (max-width: 560px) {
    .row-card { grid-template-columns: 1fr; }
    .specs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .specs div:nth-child(3n) { border-right: 1px solid var(--line); }
    .specs div:nth-child(2n) { border-right: 0; }
    .specs div:nth-child(n + 4) { border-bottom: 1px solid var(--line); }
    .specs div:nth-child(n + 5) { border-bottom: 0; }
  }
</style>
