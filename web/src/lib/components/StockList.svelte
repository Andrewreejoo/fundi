<script lang="ts">
  import { page } from '$app/state';
  import { addDays, BODY_LABEL, mwk, todayMw } from '$lib/format';
  import CarRow from './CarRow.svelte';
  import Icon from './Icon.svelte';

  let { data }: { data: any } = $props();
  const rent = $derived(data.purpose === 'rent');
  const f = $derived(data.filters);
  const r = $derived(data.result);
  const base = $derived(rent ? '/rent' : '/cars');
  let make = $state('');
  $effect.pre(() => { make = f.make; });
  const models = $derived(data.allModels.filter((m: any) => m.make_slug === make));
  const today = todayMw();
  const SALE_PRICES = [5, 8, 10, 12, 15, 20, 25, 30, 40, 50, 80, 100].map((m) => m * 1_000_000);
  const RENT_PRICES = [40, 60, 80, 100, 120, 150, 200, 300].map((k) => k * 1_000);
  const prices = $derived(rent ? RENT_PRICES : SALE_PRICES);
  const years = Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - i);

  /** URL with one parameter changed (or removed), page reset. */
  function withParam(key: string, value: string | null) {
    const u = new URL(page.url);
    u.searchParams.delete('page');
    if (value === null) u.searchParams.delete(key);
    else u.searchParams.set(key, value);
    return u.pathname + u.search;
  }
  function withoutBody(b: string) {
    const u = new URL(page.url);
    const rest = u.searchParams.getAll('body').flatMap((x) => x.split(',')).filter((x) => x && x !== b);
    u.searchParams.delete('body');
    u.searchParams.delete('page');
    for (const x of rest) u.searchParams.append('body', x);
    return u.pathname + u.search;
  }
  const chips = $derived.by(() => {
    const out: [string, string][] = [];
    const mk = data.makes.find((m: any) => m.slug === f.make);
    if (f.make) out.push([mk?.name ?? f.make, withParam('make', null)]);
    if (f.model) out.push([data.allModels.find((m: any) => m.slug === f.model)?.name ?? f.model, withParam('model', null)]);
    for (const b of f.body) out.push([BODY_LABEL[b] ?? b, withoutBody(b)]);
    if (f.minPrice) out.push([`From ${mwk(+f.minPrice)}`, withParam('minPrice', null)]);
    if (f.maxPrice) out.push([`Up to ${mwk(+f.maxPrice)}`, withParam('maxPrice', null)]);
    if (f.minYear) out.push([`${f.minYear} or newer`, withParam('minYear', null)]);
    if (f.maxYear) out.push([`${f.maxYear} or older`, withParam('maxYear', null)]);
    if (f.maxMileage) out.push([`Under ${Number(f.maxMileage).toLocaleString()} km`, withParam('maxMileage', null)]);
    if (f.transmission) out.push([f.transmission === 'automatic' ? 'Automatic' : 'Manual', withParam('transmission', null)]);
    if (f.fuel) out.push([f.fuel[0].toUpperCase() + f.fuel.slice(1), withParam('fuel', null)]);
    if (f.drive) out.push(['4WD', withParam('drive', null)]);
    if (f.district) out.push([f.district, withParam('district', null)]);
    if (f.sellerKind) out.push([f.sellerKind === 'dealer' ? 'Dealers' : 'Private sellers', withParam('sellerKind', null)]);
    if (f.priceDown) out.push(['Price down', withParam('priceDown', null)]);
    if (f.withDriver) out.push(['With driver', withParam('withDriver', null)]);
    if (f.minSeats) out.push([`${f.minSeats}+ seats`, withParam('minSeats', null)]);
    if (f.q) out.push([`"${f.q}"`, withParam('q', null)]);
    return out;
  });
  let filtersOpen = $state(false);
</script>

<div class="wrap page">
  <div class="layout">
    <aside class="side" class:open={filtersOpen} aria-label="Filters">
      <form method="GET" action={base} class="filters">
        <div class="side-head"><h2>Search</h2><a href={base} class="small">Clear all</a></div>
        {#if f.q}<input type="hidden" name="q" value={f.q} />{/if}
        {#if f.sort}<input type="hidden" name="sort" value={f.sort} />{/if}

        {#if rent}
          <fieldset>
            <legend>Dates</legend>
            <label class="field">Pick-up<input type="date" name="from" min={today} value={f.from} /></label>
            <label class="field">Return<input type="date" name="to" min={addDays(today, 1)} value={f.to} /></label>
            <span class="hint">Shows only cars free for these dates.</span>
          </fieldset>
        {/if}

        <fieldset>
          <legend>Make and model</legend>
          <select name="make" bind:value={make} aria-label="Make">
            <option value="">Any make</option>
            {#each data.makes as m}<option value={m.slug}>{m.name} ({rent ? m.rent_count : m.sale_count})</option>{/each}
          </select>
          <select name="model" aria-label="Model" disabled={!make} value={f.model}>
            <option value="">Any model</option>
            {#each models as m}<option value={m.slug}>{m.name}</option>{/each}
          </select>
        </fieldset>

        <fieldset>
          <legend>Body type</legend>
          <div class="checks">
            {#each data.bodyTypes as b}
              <label class="check"><input type="checkbox" name="body" value={b.slug} checked={f.body.includes(b.slug)} />{b.name}</label>
            {/each}
          </div>
        </fieldset>

        <fieldset>
          <legend>{rent ? 'Price per day' : 'Price'}</legend>
          <div class="pair">
            <select name="minPrice" aria-label="Minimum price" value={f.minPrice}>
              <option value="">Min</option>
              {#each prices as p}<option value={p}>{mwk(p)}</option>{/each}
            </select>
            <select name="maxPrice" aria-label="Maximum price" value={f.maxPrice}>
              <option value="">Max</option>
              {#each prices as p}<option value={p}>{mwk(p)}</option>{/each}
            </select>
          </div>
        </fieldset>

        <fieldset>
          <legend>Year</legend>
          <div class="pair">
            <select name="minYear" aria-label="From year" value={f.minYear}><option value="">From</option>{#each years as y}<option>{y}</option>{/each}</select>
            <select name="maxYear" aria-label="To year" value={f.maxYear}><option value="">To</option>{#each years as y}<option>{y}</option>{/each}</select>
          </div>
        </fieldset>

        {#if !rent}
          <fieldset>
            <legend>Mileage</legend>
            <select name="maxMileage" aria-label="Maximum mileage" value={f.maxMileage}>
              <option value="">Any mileage</option>
              {#each [50000, 80000, 100000, 150000, 200000] as m}<option value={m}>Under {m.toLocaleString()} km</option>{/each}
            </select>
          </fieldset>
        {/if}

        <fieldset>
          <legend>Car details</legend>
          <select name="transmission" aria-label="Transmission" value={f.transmission}>
            <option value="">Any transmission</option><option value="automatic">Automatic</option><option value="manual">Manual</option>
          </select>
          <select name="fuel" aria-label="Fuel" value={f.fuel}>
            <option value="">Any fuel</option><option value="petrol">Petrol</option><option value="diesel">Diesel</option><option value="hybrid">Hybrid</option>
          </select>
          {#if rent}
            <select name="minSeats" aria-label="Seats" value={f.minSeats}>
              <option value="">Any seats</option><option value="5">5 or more</option><option value="7">7 or more</option><option value="14">14 or more</option>
            </select>
            <label class="check"><input type="checkbox" name="withDriver" value="true" checked={f.withDriver === 'true'} />Driver available</label>
          {/if}
          <label class="check"><input type="checkbox" name="drive" value="4wd" checked={f.drive === '4wd'} />4WD only</label>
          {#if !rent}<label class="check"><input type="checkbox" name="priceDown" value="true" checked={f.priceDown === 'true'} />Price down only</label>{/if}
        </fieldset>

        <fieldset>
          <legend>Location and seller</legend>
          <select name="district" aria-label="District" value={f.district}>
            <option value="">All of Malawi</option>
            {#each data.districts as d}<option>{d}</option>{/each}
          </select>
          <select name="sellerKind" aria-label="Seller type" value={f.sellerKind}>
            <option value="">Dealers and private</option><option value="dealer">Dealers only</option><option value="private">Private sellers only</option>
          </select>
        </fieldset>

        <button class="btn block">Show cars</button>
      </form>
    </aside>

    <section class="results" aria-live="polite">
      <div class="head">
        <div>
          <h1>{rent ? 'Cars for hire' : 'Cars for sale'}{#if rent && f.from && f.to}, {f.from} to {f.to}{/if}</h1>
          <p class="muted">{r.total} {r.total === 1 ? 'car' : 'cars'} found{#if r.pages > 1}, page {r.page} of {r.pages}{/if}</p>
        </div>
        <form method="GET" action={base} class="sort">
          {#each [...page.url.searchParams] as [k, v]}{#if k !== 'sort' && k !== 'page'}<input type="hidden" name={k} value={v} />{/if}{/each}
          <label for="sort" class="small">Sort by</label>
          <select id="sort" name="sort" value={f.sort || 'newest'} onchange={(e) => (e.currentTarget as HTMLSelectElement).form?.requestSubmit()}>
            <option value="newest">Newest listed</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="year_desc">Year: newest first</option>
            {#if !rent}<option value="mileage_asc">Mileage: lowest first</option>{/if}
            <option value="popular">Most viewed</option>
          </select>
          <noscript><button class="btn sm plain">Sort</button></noscript>
        </form>
      </div>

      <button class="btn plain block filter-toggle" onclick={() => (filtersOpen = !filtersOpen)} aria-expanded={filtersOpen}>
        <Icon name="filter" /> {filtersOpen ? 'Hide filters' : 'Filters'}{#if chips.length} ({chips.length}){/if}
      </button>

      {#if chips.length}
        <div class="chips">
          {#each chips as [label, href]}<a {href} class="chip">{label} <Icon name="x" size={14} /></a>{/each}
        </div>
      {/if}

      {#if r.facets?.makes?.length > 1 && !f.make}
        <nav class="facets" aria-label="Narrow by make">
          {#each r.facets.makes.slice(0, 10) as m}<a href={withParam('make', m.slug)}>{m.name} <span>{m.count}</span></a>{/each}
        </nav>
      {/if}

      {#if data.error}<p class="alert error">{data.error}</p>{/if}

      {#if data.compare.length}
        <div class="alert info row between small">
          <span>{data.compare.length} {data.compare.length === 1 ? 'car' : 'cars'} in your comparison list (up to 4).</span>
          <a class="btn sm dark" href="/compare">Compare now</a>
        </div>
      {/if}

      <div class="list">
        {#each r.results as v (v.id)}
          <CarRow {v} fileBase={data.fileBase} comparing={data.compare.includes(v.id)} deposit={v.deposit} />
        {:else}
          <div class="panel empty stack" style="--gap:10px">
            <strong>No cars match these filters.</strong>
            <span>Remove a filter above{#if rent}, try other dates{/if}, or <a href={base}>see all {rent ? 'cars for hire' : 'cars for sale'}</a>.</span>
          </div>
        {/each}
      </div>

      {#if r.pages > 1}
        <nav class="pager" aria-label="Pages">
          {#if r.page > 1}<a class="btn plain sm" href={withParam('page', String(r.page - 1))}><Icon name="back" size={16} /> Previous</a>{/if}
          {#each Array.from({ length: r.pages }, (_, i) => i + 1) as p}
            {#if p === 1 || p === r.pages || Math.abs(p - r.page) <= 2}
              <a class="num" href={withParam('page', String(p))} aria-current={p === r.page ? 'page' : undefined}>{p}</a>
            {/if}
          {/each}
          {#if r.page < r.pages}<a class="btn plain sm" href={withParam('page', String(r.page + 1))}>Next <Icon name="next" size={16} /></a>{/if}
        </nav>
      {/if}
    </section>
  </div>
</div>

<style>
  .layout { display: grid; grid-template-columns: 270px minmax(0, 1fr); gap: 20px; align-items: start; }
  .side { position: sticky; top: 12px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); }
  .filters { display: flex; flex-direction: column; }
  .side-head { display: flex; justify-content: space-between; align-items: baseline; padding: 14px 14px 6px; }
  .side-head h2 { font-family: var(--font-cond); font-size: 22px; }
  fieldset { border: 0; border-top: 1px solid var(--line); margin: 0; padding: 10px 14px 12px; display: flex; flex-direction: column; gap: 8px; }
  legend { font-weight: 700; font-size: 14px; padding: 8px 0 0; float: left; width: 100%; }
  .checks { display: grid; grid-template-columns: 1fr 1fr; gap: 0 6px; }
  .checks .check { font-size: 14px; min-height: 30px; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .filters select, .filters input[type='date'] { min-height: 38px; font-size: 15px; padding: 5px 8px; }
  .filters > .btn { margin: 6px 14px 14px; width: auto; }
  .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
  .head h1 { font-family: var(--font-cond); font-size: 32px; }
  .sort { display: flex; align-items: center; gap: 8px; }
  .sort select { width: auto; min-height: 38px; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
  .chip { display: inline-flex; align-items: center; gap: 4px; background: var(--asphalt); color: #fff; border-radius: 3px; padding: 4px 8px; font-size: 14px; text-decoration: none; }
  .chip:hover { background: #000; text-decoration: none; }
  .facets { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
  .facets a { background: var(--surface); border: 1px solid var(--line); border-radius: 3px; padding: 4px 9px; font-size: 14px; color: var(--ink); text-decoration: none; }
  .facets a span { color: var(--muted); }
  .facets a:hover { border-color: var(--ink); }
  .list { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
  .pager { display: flex; justify-content: center; align-items: center; gap: 6px; margin-top: 20px; flex-wrap: wrap; }
  .num { min-width: 36px; height: 36px; display: grid; place-items: center; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); color: var(--ink); }
  .num[aria-current='page'] { background: var(--asphalt); color: #fff; border-color: var(--asphalt); }
  .filter-toggle { display: none; margin-bottom: 10px; }
  @media (max-width: 900px) {
    .layout { grid-template-columns: 1fr; }
    .side { display: none; position: static; }
    .side.open { display: block; }
    .filter-toggle { display: inline-flex; }
  }
</style>
