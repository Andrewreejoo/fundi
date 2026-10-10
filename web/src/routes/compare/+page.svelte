<script lang="ts">
  import { BODY_LABEL, cap, carTitle, cc, km, mwk } from '$lib/format';
  import CarPhoto from '$lib/components/CarPhoto.svelte';
  import Plate from '$lib/components/Plate.svelte';

  let { data } = $props();
  const rows: [string, (v: any) => string][] = [
    ['Price', (v) => (v.purpose === 'rent' ? `${mwk(v.daily_rate_mwk)} per day` : mwk(v.price_mwk))],
    ['Year', (v) => String(v.year)],
    ['Mileage', (v) => (v.mileage_km != null ? km(v.mileage_km) : '–')],
    ['Engine', (v) => (v.engine_cc ? cc(v.engine_cc) : '–')],
    ['Transmission', (v) => cap(v.transmission)],
    ['Fuel', (v) => cap(v.fuel)],
    ['Drive', (v) => v.drive.toUpperCase()],
    ['Body', (v) => BODY_LABEL[v.body_type]],
    ['Seats', (v) => String(v.seats ?? '–')],
    ['Colour', (v) => v.color ?? '–'],
    ['Condition', (v) => cap(v.condition.replace('_', ' '))],
    ['Location', (v) => `${v.area}, ${v.district}`],
    ['Seller', (v) => `${v.seller_name}${v.seller_verified ? ' (verified)' : ''}`],
  ];
</script>

<svelte:head><title>Compare cars · Galimoto</title></svelte:head>

<div class="wrap page">
  <div class="row between">
    <h1>Compare cars</h1>
    {#if data.cars.length}<form method="POST" action="?/clear"><button class="btn plain sm">Clear list</button></form>{/if}
  </div>

  {#if !data.cars.length}
    <div class="panel empty stack" style="--gap:10px; margin-top:16px">
      <strong>Nothing to compare yet.</strong>
      <span>Tap Compare on up to 4 cars, then come back here to see them side by side.</span>
      <a class="btn" href="/cars" style="align-self:center">Browse cars for sale</a>
    </div>
  {:else}
    <div class="scroll-x panel" style="margin-top:14px; padding:0">
      <table class="cmp">
        <thead>
          <tr>
            <th></th>
            {#each data.cars as v (v.id)}
              <th>
                <a href={`/cars/${v.stock_no}`}><CarPhoto id={v.photo_ids[0]} fileBase={data.fileBase} body={v.body_type} color={v.color} alt={carTitle(v)} /></a>
                <a class="t" href={`/cars/${v.stock_no}`}>{carTitle(v)}</a>
                <Plate text={v.stock_no} size="sm" />
                <form method="POST" action="?/toggle"><input type="hidden" name="id" value={v.id} /><input type="hidden" name="next" value="/compare" /><button class="linkbtn">Remove</button></form>
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each rows as [label, fn]}
            <tr><th scope="row">{label}</th>{#each data.cars as v (v.id)}<td class:price={label === 'Price'}>{fn(v)}</td>{/each}</tr>
          {/each}
          {#each data.features as f}
            <tr class="feat"><th scope="row">{f.name}</th>{#each data.cars as v (v.id)}<td>{v.features.includes(f.slug) ? 'Yes' : '–'}</td>{/each}</tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .cmp { border-collapse: collapse; width: 100%; min-width: 640px; font-size: 15px; }
  .cmp th, .cmp td { padding: 8px 10px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
  .cmp thead th { width: 23%; font-weight: 400; }
  .cmp thead th:first-child { width: 160px; }
  .cmp tbody th { color: var(--muted); font-weight: 600; font-size: 14px; background: var(--sunk); }
  .t { display: block; font-weight: 700; color: var(--ink); margin: 6px 0 4px; }
  td.price { font-family: var(--font-cond); font-weight: 700; font-size: 20px; }
  .feat td { color: var(--muted); }
  .linkbtn { background: none; border: 0; padding: 4px 0; color: #1d5fa8; cursor: pointer; font: inherit; font-size: 14px; }
</style>
