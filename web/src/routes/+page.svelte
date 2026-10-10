<script lang="ts">
  import { addDays, BODY_LABEL, todayMw } from '$lib/format';
  import CarArt from '$lib/components/CarArt.svelte';
  import CarCard from '$lib/components/CarCard.svelte';

  let { data } = $props();
  let mode = $state<'buy' | 'rent'>('buy');
  let make = $state('');
  const models = $derived(data.models.filter((m: any) => m.make_slug === make && m.count > 0));
  const today = todayMw();
  const PRICES = [
    ['Under MWK 10M', 'maxPrice=10000000'],
    ['MWK 10M to 15M', 'minPrice=10000000&maxPrice=15000000'],
    ['MWK 15M to 25M', 'minPrice=15000000&maxPrice=25000000'],
    ['MWK 25M to 50M', 'minPrice=25000000&maxPrice=50000000'],
    ['Over MWK 50M', 'minPrice=50000000'],
  ];
  const BODIES = ['suv', 'sedan', 'hatchback', 'pickup', 'minibus', 'wagon', 'van', 'truck'];
</script>

<svelte:head>
  <title>GalimotoYanga: buy or rent cars already in Malawi</title>
  <meta name="description" content="Used cars already in Malawi, duty paid and registered. Buy from dealers and private sellers in Lilongwe, Blantyre and Mzuzu, or hire a car by the day. Reserve with Airtel Money or TNM Mpamba." />
</svelte:head>

<section class="hero">
  <img class="bg" src="/img/hero-sale.jpg" alt="" fetchpriority="high" />
  <div class="wrap hero-inner">
    <div class="pitch">
      <h1>Cars already in Malawi. Duty paid, ready to drive.</h1>
      <p>Buy from car yards and private sellers, or hire a car by the day. Reserve with a refundable deposit by Airtel Money or TNM Mpamba.</p>
      <dl class="stats">
        <div><dt>for sale</dt><dd>{data.stats.for_sale}</dd></div>
        <div><dt>for hire</dt><dd>{data.stats.for_rent}</dd></div>
        <div><dt>dealers</dt><dd>{data.stats.dealers}</dd></div>
      </dl>
    </div>

    <div class="finder">
      <div class="mode" role="tablist" aria-label="What are you looking for?">
        <button role="tab" aria-selected={mode === 'buy'} onclick={() => (mode = 'buy')}>Buy a car</button>
        <button role="tab" aria-selected={mode === 'rent'} onclick={() => (mode = 'rent')}>Rent a car</button>
      </div>
      {#if mode === 'buy'}
        <form method="GET" action="/cars" class="stack">
          <div class="grid2">
            <label class="field">Make
              <select name="make" bind:value={make}>
                <option value="">Any make</option>
                {#each data.makes as m}{#if m.sale_count > 0}<option value={m.slug}>{m.name} ({m.sale_count})</option>{/if}{/each}
              </select>
            </label>
            <label class="field">Model
              <select name="model" disabled={!make}>
                <option value="">Any model</option>
                {#each models as m}<option value={m.slug}>{m.name}</option>{/each}
              </select>
            </label>
            <label class="field">Body type
              <select name="body">
                <option value="">Any</option>
                {#each data.bodyTypes as b}<option value={b.slug}>{b.name}</option>{/each}
              </select>
            </label>
            <label class="field">Max price
              <select name="maxPrice">
                <option value="">No limit</option>
                {#each [8, 10, 15, 20, 30, 50, 80] as m}<option value={m * 1_000_000}>MWK {m} million</option>{/each}
              </select>
            </label>
          </div>
          <button class="btn lg block">Search cars for sale</button>
        </form>
      {:else}
        <form method="GET" action="/rent" class="stack">
          <div class="grid2">
            <label class="field">Pick-up date<input type="date" name="from" min={today} value={addDays(today, 1)} required /></label>
            <label class="field">Return date<input type="date" name="to" min={addDays(today, 1)} value={addDays(today, 3)} required /></label>
            <label class="field">Where
              <select name="district">
                <option value="">Anywhere</option>
                {#each data.districts as d}<option>{d}</option>{/each}
              </select>
            </label>
            <label class="field">Seats
              <select name="minSeats">
                <option value="">Any</option>
                <option value="5">5 or more</option>
                <option value="7">7 or more</option>
                <option value="14">14 or more</option>
              </select>
            </label>
          </div>
          <label class="check"><input type="checkbox" name="withDriver" value="true" /> I want a driver</label>
          <button class="btn lg block">Find cars for hire</button>
        </form>
      {/if}
    </div>
  </div>
</section>

<div class="wrap">
  <section>
    <div class="section-head"><h2>Shop by make</h2><a href="/cars">All cars for sale</a></div>
    <div class="makes">
      {#each data.allMakes.slice(0, 12) as m}
        <a href={`/cars?make=${m.slug}`} class:empty={!m.sale_count}>
          <span class="mk">{m.name}</span><span class="n">{m.sale_count} for sale</span>
        </a>
      {/each}
    </div>
  </section>

  <div class="two">
    <section>
      <div class="section-head"><h2>Shop by body type</h2></div>
      <div class="bodies">
        {#each BODIES as b}
          <a href={`/cars?body=${b}`}><span class="art"><CarArt body={b} color="Silver" label="" /></span>{BODY_LABEL[b]}</a>
        {/each}
      </div>
    </section>
    <section>
      <div class="section-head"><h2>Shop by price</h2></div>
      <div class="prices">
        {#each PRICES as [label, q]}<a href={`/cars?${q}`}>{label}</a>{/each}
      </div>
    </section>
  </div>

  {#if data.recent.length}
    <section>
      <div class="section-head"><h2>You looked at</h2></div>
      <div class="grid">{#each data.recent as v (v.id)}<CarCard {v} fileBase={data.fileBase} />{/each}</div>
    </section>
  {/if}

  <section>
    <div class="section-head"><h2>New arrivals</h2><a href="/cars?sort=newest">See all new cars</a></div>
    <div class="grid">{#each data.fresh as v (v.id)}<CarCard {v} fileBase={data.fileBase} />{/each}</div>
  </section>

  {#if data.dropped.length}
    <section>
      <div class="section-head"><h2>Price down</h2><a href="/cars?priceDown=true">All price drops</a></div>
      <div class="grid">{#each data.dropped as v (v.id)}<CarCard {v} fileBase={data.fileBase} />{/each}</div>
    </section>
  {/if}
</div>

<section class="hire">
  <img class="bg" src="/img/hero-rent.jpg" alt="" loading="lazy" />
  <div class="wrap hire-inner">
    <div class="hire-copy">
      <h2>Hire a car by the day</h2>
      <p>Self-drive or with a driver, for weddings, field trips, safaris and airport runs. Pick your dates, pay by mobile money, and the owner is paid only after the car comes back.</p>
      <a class="btn lg" href="/rent">Browse cars for hire</a>
    </div>
  </div>
</section>

<div class="wrap">
  {#if data.rentals.length}
    <section>
      <div class="section-head"><h2>Cars for hire</h2><a href="/rent">See all</a></div>
      <div class="grid">{#each data.rentals as v (v.id)}<CarCard {v} fileBase={data.fileBase} />{/each}</div>
    </section>
  {/if}

  <section class="how">
    <div class="panel">
      <h2>Buying a car</h2>
      <ol>
        <li><strong>Find it.</strong> Compare cars, photos and prices, and ask the seller questions.</li>
        <li><strong>Reserve it.</strong> Pay a refundable deposit by mobile money. The car is held for you for 3 days.</li>
        <li><strong>See it and buy it.</strong> Inspect and test-drive, then pay the balance to the seller.</li>
        <li><strong>Confirm.</strong> The deposit goes to the seller. If the car is not as described, report a problem and we hold the money.</li>
      </ol>
    </div>
    <div class="panel">
      <h2>Renting a car</h2>
      <ol>
        <li><strong>Pick your dates.</strong> Only cars free for those days are shown.</li>
        <li><strong>Pay to book.</strong> Pay by Airtel Money or TNM Mpamba. Cancel before pick-up for a full refund.</li>
        <li><strong>Drive.</strong> The owner is paid after the car is returned.</li>
      </ol>
    </div>
    <div class="panel sellbox">
      <h2>Selling or hiring out?</h2>
      <p>List your car for free. Car yards and private sellers welcome. You pay a small fee only when a car sells or a rental is completed.</p>
      <a class="btn dark" href="/sell">List your car</a>
    </div>
  </section>
</div>

<style>
  .hero { position: relative; background: var(--asphalt); color: #fff; overflow: hidden; }
  .hero .bg, .hire .bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .hero .bg { opacity: 0.55; object-position: center 60%; }
  .hero::after { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, rgba(25, 28, 32, 0.92) 0%, rgba(25, 28, 32, 0.55) 55%, rgba(25, 28, 32, 0.2) 100%); }
  .hero-inner { position: relative; z-index: 1; display: grid; grid-template-columns: minmax(0, 1fr) 420px; gap: 32px; align-items: center; padding-top: 44px; padding-bottom: 44px; }
  .pitch h1 { font-family: var(--font-cond); font-size: clamp(34px, 5vw, 56px); line-height: 1.02; max-width: 15ch; }
  .pitch p { margin-top: 14px; font-size: 18px; max-width: 46ch; color: #e6e9ec; }
  .stats { display: flex; gap: 28px; margin: 26px 0 0; }
  .stats div { display: flex; flex-direction: column-reverse; }
  .stats dt { color: #c8cdd3; font-size: 14px; }
  .stats dd { margin: 0; font-family: var(--font-cond); font-size: 40px; font-weight: 700; line-height: 1; color: var(--plate); }
  .finder { background: var(--surface); color: var(--ink); border-radius: var(--radius); padding: 0 16px 16px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35); }
  .mode { display: grid; grid-template-columns: 1fr 1fr; margin: 0 -16px 14px; }
  .mode button { font: inherit; font-weight: 700; font-size: 16px; padding: 14px; background: var(--sunk); border: 0; border-bottom: 1px solid var(--line); cursor: pointer; color: var(--muted); }
  .mode button:first-child { border-top-left-radius: var(--radius); }
  .mode button:last-child { border-top-right-radius: var(--radius); }
  .mode button[aria-selected='true'] { background: var(--surface); color: var(--ink); border-bottom-color: transparent; box-shadow: inset 0 3px 0 var(--plate); }
  .makes { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; }
  .makes a { display: flex; flex-direction: column; padding: 12px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); color: var(--ink); text-decoration: none; }
  .makes a:hover { border-color: var(--ink); }
  .makes a.empty { opacity: 0.55; }
  .mk { font-family: var(--font-cond); font-size: 21px; font-weight: 700; }
  .n { font-size: 13px; color: var(--muted); }
  .two { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; }
  .bodies { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
  .bodies a { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 8px; text-align: center; font-weight: 600; color: var(--ink); text-decoration: none; font-size: 15px; }
  .bodies a:hover { border-color: var(--ink); }
  .art { display: block; aspect-ratio: 240 / 110; margin-bottom: 4px; }
  .prices { display: flex; flex-direction: column; gap: 8px; }
  .prices a { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 12px 14px; font-family: var(--font-cond); font-weight: 700; font-size: 19px; color: var(--ink); text-decoration: none; }
  .prices a:hover { border-color: var(--ink); }
  .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  .hire { position: relative; margin-top: 40px; background: var(--asphalt); color: #fff; overflow: hidden; }
  .hire .bg { object-position: center 45%; }
  .hire::after { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, rgba(25, 28, 32, 0.9) 0%, rgba(25, 28, 32, 0.6) 45%, rgba(25, 28, 32, 0) 75%); }
  .hire-inner { position: relative; z-index: 1; padding-top: 56px; padding-bottom: 56px; }
  .hire-copy { max-width: 470px; display: flex; flex-direction: column; gap: 14px; align-items: flex-start; }
  .hire-copy h2 { font-family: var(--font-cond); font-size: 40px; }
  .hire-copy p { font-size: 17px; color: #e6e9ec; }
  .how { display: grid; grid-template-columns: 1fr 1fr 0.8fr; gap: 12px; margin-top: 32px; }
  .how ol { margin: 0; padding-left: 22px; display: flex; flex-direction: column; gap: 8px; }
  .sellbox { background: var(--plate); border-color: #d9ad0f; display: flex; flex-direction: column; gap: 12px; align-items: flex-start; }
  @media (max-width: 1000px) {
    .hero-inner { grid-template-columns: 1fr; }
    .makes { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .two, .how { grid-template-columns: 1fr; }
    .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 520px) {
    .grid, .makes { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .bodies { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .hero-inner { padding-top: 28px; }
  }
</style>
