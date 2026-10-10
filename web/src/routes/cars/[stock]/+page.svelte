<script lang="ts">
  import { enhance } from '$app/forms';
  import { page } from '$app/state';
  import { addDays, BODY_LABEL, cap, carTitle, cc, dateLabel, dateTime, km, localPhone, mwk, timeLeft, todayMw, whatsapp } from '$lib/format';
  import CarArt from '$lib/components/CarArt.svelte';
  import CarCard from '$lib/components/CarCard.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import Plate from '$lib/components/Plate.svelte';

  let { data, form } = $props();
  const c = $derived(data.car);
  const rent = $derived(c.purpose === 'rent');
  const title = $derived(carTitle(c));
  const dropped = $derived(!rent && c.previous_price_mwk > c.price_mwk);
  const s = $derived(data.settings);
  const user = $derived(data.user);
  const fv = $derived(((form as any)?.values ?? {}) as Record<string, string>);

  // Gallery
  let shown = $state(0);
  const photos = $derived(c.photo_ids as string[]);

  // Rental calculator (the server recalculates; this is for the visitor's benefit)
  const today = todayMw();
  let start = $state('');
  let end = $state('');
  let withDriver = $state(false);
  $effect.pre(() => {
    if (!start) start = fv.start || addDays(today, 1);
    if (!end) end = fv.end || addDays(today, 1 + Math.max(c.min_days ?? 1, 2));
    if (!c.self_drive) withDriver = true;
  });
  const days = $derived(Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000));
  const perDay = $derived(Number(c.daily_rate_mwk ?? 0) + (withDriver ? Number(c.driver_rate_mwk ?? 0) : 0));
  const clash = $derived((c.booked as any[]).some((b) => start < b.end_date && end > b.start_date));
  const rentProblem = $derived(
    !start || !end ? 'Choose your dates'
    : start < today ? 'Pick-up cannot be in the past'
    : days < 1 ? 'Return must be after pick-up'
    : days < c.min_days ? `Minimum ${c.min_days} days`
    : clash ? 'Those dates are already booked'
    : '',
  );

  const shareText = $derived(`${title} on Galimoto: ${page.url.origin}/cars/${c.stock_no}`);
  const askText = $derived(`Hello, I saw your ${title} (${c.stock_no}) on Galimoto. Is it still available?`);
  let busy = $state(false);
  const sub = () => { busy = true; return async ({ update }: any) => { await update({ reset: false }); busy = false; }; };
</script>

<svelte:head>
  <title>{title} {rent ? 'for hire' : 'for sale'} · {c.stock_no} · Galimoto</title>
  <meta name="description" content={`${title} ${c.variant ?? ''}, ${km(c.mileage_km)}, ${c.transmission}, ${c.fuel}. ${rent ? `${mwk(c.daily_rate_mwk)} per day` : mwk(c.price_mwk)} in ${c.area}, ${c.district}.`} />
</svelte:head>

<div class="wrap page">
  <nav class="crumbs small" aria-label="Breadcrumb">
    <a href={rent ? '/rent' : '/cars'}>{rent ? 'Cars for hire' : 'Cars for sale'}</a> /
    <a href={`${rent ? '/rent' : '/cars'}?make=${c.make_slug}`}>{c.make}</a> /
    <a href={`${rent ? '/rent' : '/cars'}?make=${c.make_slug}&model=${c.model_slug}`}>{c.model}</a>
  </nav>

  {#if c.is_owner}
    <div class="alert info row between">
      <span>This is your listing. Status: <strong>{c.status}</strong>{#if c.reject_reason}. Not approved: {c.reject_reason}{/if}</span>
      <a class="btn sm dark" href={`/seller/cars/${c.id}`}>Edit listing</a>
    </div>
  {/if}

  <header class="titlebar">
    <div>
      <h1>{title} <span class="variant">{c.variant ?? ''}</span></h1>
      <div class="row small muted" style="--gap:8px">
        <Plate text={c.stock_no} size="sm" />
        {#if c.status === 'reserved'}<span class="tag held">Reserved</span>{/if}
        {#if c.status === 'sold'}<span class="tag quiet">Sold</span>{/if}
        {#if dropped}<span class="tag drop">Price down</span>{/if}
        {#if c.is_new}<span class="tag new">New</span>{/if}
        <span><Icon name="pin" size={14} /> {c.area}, {c.district}</span>
        <span>{c.views} views</span>
      </div>
    </div>
    <div class="row" style="--gap:6px">
      <form method="POST" action="/favorites?/toggle">
        <input type="hidden" name="id" value={c.id} /><input type="hidden" name="next" value={page.url.pathname} />
        <button class="btn plain sm"><Icon name={c.is_favorite ? 'heart-fill' : 'heart'} size={17} /> {c.is_favorite ? 'Saved' : 'Save'}</button>
      </form>
      <form method="POST" action="/compare?/toggle">
        <input type="hidden" name="id" value={c.id} /><input type="hidden" name="next" value={page.url.pathname} />
        <button class="btn plain sm" aria-pressed={data.comparing}><Icon name="compare" size={17} /> {data.comparing ? 'In comparison' : 'Compare'}</button>
      </form>
      <a class="btn plain sm" href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener"><Icon name="share" size={17} /> Share</a>
    </div>
  </header>

  <div class="top">
    <section class="gallery" aria-label="Photos">
      <div class="main">
        {#if photos.length}
          <img src={`${data.fileBase}/files/${photos[shown]}`} alt={`${title}, photo ${shown + 1} of ${photos.length}`} />
          {#if photos.length > 1}
            <button class="nav prev" aria-label="Previous photo" onclick={() => (shown = (shown - 1 + photos.length) % photos.length)}><Icon name="back" /></button>
            <button class="nav next" aria-label="Next photo" onclick={() => (shown = (shown + 1) % photos.length)}><Icon name="next" /></button>
            <span class="count">{shown + 1} / {photos.length}</span>
          {/if}
        {:else}
          <CarArt body={c.body_type} color={c.color} label={`${title}: no photos yet`} />
          <span class="nophoto">The seller has not added photos yet. Ask for some below.</span>
        {/if}
      </div>
      {#if photos.length > 1}
        <div class="thumbs">
          {#each photos as id, i}
            <button class:on={i === shown} onclick={() => (shown = i)} aria-label={`Show photo ${i + 1}`}>
              <img src={`${data.fileBase}/files/${id}`} alt="" loading="lazy" />
            </button>
          {/each}
        </div>
      {/if}
    </section>

    <aside class="buybox">
      {#if form?.error && (form as any).form !== 'inquire'}<p class="alert error" role="alert">{form.error}</p>{/if}

      {#if rent}
        <div class="panel stack" style="--gap:10px">
          <div>
            <span class="price big">{mwk(c.daily_rate_mwk)}</span><span class="muted"> per day</span>
            <p class="small muted">
              {#if c.self_drive && c.driver_rate_mwk != null}Self-drive, or with a driver for {Number(c.driver_rate_mwk) ? `${mwk(c.driver_rate_mwk)} more per day` : 'no extra charge'}.
              {:else if c.self_drive}Self-drive only.
              {:else}Comes with a driver{Number(c.driver_rate_mwk) ? ` (${mwk(c.driver_rate_mwk)} per day)` : ' (included)'}.{/if}
              {#if c.min_days > 1} Minimum {c.min_days} days.{/if}
            </p>
          </div>
          {#if c.status === 'live' && !c.is_owner}
            <form method="POST" action="?/rent" class="stack" style="--gap:10px" use:enhance={sub}>
              <input type="hidden" name="id" value={c.id} />
              <div class="grid2">
                <label class="field">Pick-up<input type="date" name="start" min={today} bind:value={start} required /></label>
                <label class="field">Return<input type="date" name="end" min={addDays(start || today, 1)} bind:value={end} required /></label>
              </div>
              {#if c.self_drive && c.driver_rate_mwk != null}
                <label class="check"><input type="checkbox" name="withDriver" bind:checked={withDriver} /> Add a driver</label>
              {:else if !c.self_drive}
                <input type="hidden" name="withDriver" value="on" />
              {/if}
              <label class="field">Note for the owner <span class="hint">(optional: pick-up place, trip)</span>
                <input name="note" maxlength="500" value={fv.note ?? ''} placeholder="e.g. Pick up at Chileka airport" />
              </label>
              <div class="sum">
                {#if !rentProblem}
                  <div class="row between"><span>{mwk(perDay)} × {days} {days === 1 ? 'day' : 'days'}</span><strong class="price">{mwk(perDay * days)}</strong></div>
                {:else}<span class="muted">{rentProblem}</span>{/if}
              </div>
              <button class="btn lg block" disabled={!!rentProblem || busy}>{user ? 'Book and pay' : 'Sign in to book'}</button>
              <p class="tiny muted">You pay by Airtel Money or TNM Mpamba. Cancel before pick-up for a full refund. The owner is paid after the car is returned.</p>
            </form>
            {#if c.booked.length}
              <div class="small">
                <strong>Already booked</strong>
                <ul class="booked">{#each c.booked as b}<li>{dateLabel(b.start_date)} to {dateLabel(b.end_date)}</li>{/each}</ul>
              </div>
            {/if}
          {:else if !c.is_owner}
            <p class="alert info">This car is not taking bookings right now.</p>
          {/if}
        </div>
      {:else}
        <div class="panel stack" style="--gap:10px">
          <div>
            <div class="small muted">Price{c.negotiable ? ' (negotiable)' : ''}</div>
            <span class="price big">{mwk(c.price_mwk)}</span>
            {#if dropped}<div class="price was">{mwk(c.previous_price_mwk)}</div>{/if}
          </div>
          {#if c.status === 'live' && !c.is_owner}
            <div class="deposit">
              <Icon name="shield" size={22} />
              <div class="small">
                <strong>Reserve it for {Math.round(s.reservationHoldHours / 24)} days with a refundable {mwk(data.deposit)} deposit.</strong>
                Galimoto holds the deposit. View and test-drive the car, then pay the balance of {mwk(Number(c.price_mwk) - data.deposit)} to the seller.
                If you don't buy, the deposit comes back to you.
              </div>
            </div>
            <form method="POST" action="?/reserve" use:enhance={sub}>
              <input type="hidden" name="id" value={c.id} />
              <button class="btn lg block" disabled={busy}>{user ? `Reserve with ${mwk(data.deposit)}` : 'Sign in to reserve'}</button>
            </form>
          {:else if c.status === 'reserved'}
            <p class="alert info small">Reserved by another buyer{#if c.reservation?.expires_at && timeLeft(c.reservation.expires_at)} for the next {timeLeft(c.reservation.expires_at)}{/if}. Save it to see if it comes back on sale.</p>
          {:else if c.status === 'sold'}
            <p class="alert info small">This car has been sold. <a href={`/cars?make=${c.make_slug}&model=${c.model_slug}`}>See similar {c.model}s</a>.</p>
          {/if}
        </div>
      {/if}

      <div class="panel seller stack" style="--gap:8px">
        <div class="row between">
          <div>
            <div class="tiny muted">{c.seller_kind === 'dealer' ? 'Dealer' : 'Private seller'}</div>
            <a class="sname" href={`/dealers/${c.seller_id}`}>{c.seller_name}</a>
          </div>
          {#if c.seller_verified}<span class="tag verified">Verified seller</span>{/if}
        </div>
        <div class="small muted"><Icon name="pin" size={14} /> {c.seller_address ? `${c.seller_address}, ` : ''}{c.seller_area}, {c.seller_district}</div>
        <div class="small muted">{c.seller_live_count} cars listed, on Galimoto since {new Date(c.seller_since).getFullYear()}</div>
        {#if c.seller_phone && !c.is_owner}
          <div class="grid2">
            <a class="btn dark" href={`tel:${c.seller_phone}`}><Icon name="phone" size={18} /> {localPhone(c.seller_phone)}</a>
            {#if c.seller_whatsapp}<a class="btn plain" href={whatsapp(c.seller_phone, askText)} target="_blank" rel="noopener"><Icon name="whatsapp" size={18} /> WhatsApp</a>{/if}
          </div>
        {:else if !user}
          <a class="btn plain block" href={`/login?next=${encodeURIComponent(page.url.pathname)}`}><Icon name="phone" size={18} /> Sign in to see the phone number</a>
        {/if}
      </div>

      {#if !c.is_owner && c.status !== 'sold'}
        <form method="POST" action="?/inquire" class="panel stack" style="--gap:8px" use:enhance={sub}>
          <h3>Ask the seller</h3>
          {#if form?.error && (form as any).form === 'inquire'}<p class="alert error small" role="alert">{form.error}</p>{/if}
          <input type="hidden" name="id" value={c.id} />
          <label class="sr-only" for="ask">Your question</label>
          <textarea id="ask" name="body" maxlength="2000" required>{rent ? 'Hello, is this car free on my dates? ' : 'Hello, is this car still available? Can I come and see it? '}</textarea>
          <button class="btn plain block" disabled={busy}><Icon name="chat" size={18} /> {user ? 'Send message' : 'Sign in to send'}</button>
        </form>
      {/if}
    </aside>
  </div>

  <div class="lower">
    <section class="panel">
      <h2>Specifications</h2>
      <dl class="spec">
        <div><dt>Stock number</dt><dd>{c.stock_no}</dd></div>
        <div><dt>Make and model</dt><dd>{c.make} {c.model}</dd></div>
        <div><dt>Grade</dt><dd>{c.variant ?? '–'}</dd></div>
        <div><dt>Year</dt><dd>{c.year}</dd></div>
        <div><dt>Mileage</dt><dd>{c.mileage_km != null ? km(c.mileage_km) : '–'}</dd></div>
        <div><dt>Engine</dt><dd>{c.engine_cc ? cc(c.engine_cc) : '–'}</dd></div>
        <div><dt>Transmission</dt><dd>{cap(c.transmission)}</dd></div>
        <div><dt>Fuel</dt><dd>{cap(c.fuel)}</dd></div>
        <div><dt>Drive</dt><dd>{c.drive.toUpperCase()}</dd></div>
        <div><dt>Steering</dt><dd>{c.steering === 'right' ? 'Right-hand drive' : 'Left-hand drive'}</dd></div>
        <div><dt>Body type</dt><dd>{BODY_LABEL[c.body_type]}</dd></div>
        <div><dt>Seats</dt><dd>{c.seats ?? '–'}</dd></div>
        <div><dt>Doors</dt><dd>{c.doors ?? '–'}</dd></div>
        <div><dt>Colour</dt><dd>{c.color ?? '–'}</dd></div>
        <div><dt>Condition</dt><dd>{cap(c.condition.replace('_', ' '))}</dd></div>
        <div><dt>Registered in Malawi</dt><dd>{c.registered ? `Yes${c.plate ? `, ${c.plate}` : ''}` : 'No'}</dd></div>
        <div><dt>Duty (MRA)</dt><dd>{c.duty_paid ? 'Paid' : 'Not paid'}</dd></div>
        <div><dt>Certificate of fitness</dt><dd>{c.cof_expiry ? `Valid to ${dateLabel(c.cof_expiry)}` : 'Ask the seller'}</dd></div>
        <div><dt>Location</dt><dd>{c.area}, {c.district}</dd></div>
        <div><dt>Listed</dt><dd>{dateTime(c.published_at)}</dd></div>
      </dl>
    </section>

    <section class="panel">
      <h2>Features</h2>
      <ul class="features">
        {#each s.features as f}
          <li class:on={c.features.includes(f.slug)}><Icon name={c.features.includes(f.slug) ? 'check' : 'x'} size={15} />{f.name}</li>
        {/each}
      </ul>
      {#if c.description}
        <h2 class="desc-h">Seller's description</h2>
        <p class="desc">{c.description}</p>
      {/if}
    </section>
  </div>

  {#if c.similar.length}
    <section>
      <div class="section-head"><h2>Similar cars</h2></div>
      <div class="grid">{#each c.similar as v (v.id)}<CarCard {v} fileBase={data.fileBase} />{/each}</div>
    </section>
  {/if}
</div>

<style>
  .crumbs { margin-bottom: 10px; color: var(--muted); }
  .titlebar { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
  .titlebar h1 { font-family: var(--font-cond); font-size: clamp(28px, 4vw, 38px); }
  .variant { font-weight: 600; color: var(--muted); font-size: 0.7em; }
  .top { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 20px; align-items: start; }
  .gallery .main { position: relative; aspect-ratio: 4 / 3; background: #1d2024; border-radius: var(--radius); overflow: hidden; }
  .gallery .main img { width: 100%; height: 100%; object-fit: contain; }
  .gallery .main :global(svg) { height: 100%; }
  .nav { position: absolute; top: 50%; transform: translateY(-50%); width: 44px; height: 44px; border-radius: 50%; border: 0; background: rgba(255, 255, 255, 0.9); cursor: pointer; display: grid; place-items: center; }
  .prev { left: 10px; }
  .next { right: 10px; }
  .count { position: absolute; right: 10px; bottom: 10px; background: rgba(20, 22, 26, 0.75); color: #fff; font-size: 13px; padding: 3px 8px; border-radius: 3px; }
  .nophoto { position: absolute; left: 12px; bottom: 12px; background: rgba(255, 255, 255, 0.92); padding: 4px 10px; border-radius: 3px; font-size: 14px; }
  .thumbs { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px; margin-top: 6px; }
  .thumbs button { padding: 0; border: 2px solid transparent; border-radius: 4px; overflow: hidden; cursor: pointer; aspect-ratio: 4 / 3; background: #ddd; }
  .thumbs button.on { border-color: var(--plate); }
  .thumbs img { width: 100%; height: 100%; object-fit: cover; }
  .buybox { display: flex; flex-direction: column; gap: 12px; }
  .big { font-size: 36px; line-height: 1.05; }
  .deposit { display: flex; gap: 10px; padding: 10px; background: var(--go-tint); border-radius: var(--radius); color: var(--go-dark); }
  .deposit :global(svg) { flex-shrink: 0; }
  .sum { padding: 10px 12px; background: var(--sunk); border-radius: var(--radius); min-height: 44px; display: flex; flex-direction: column; justify-content: center; }
  .sum .price { font-size: 24px; }
  .booked { margin: 4px 0 0; padding-left: 18px; color: var(--muted); }
  .sname { font-weight: 700; font-size: 19px; color: var(--ink); }
  .lower { display: grid; grid-template-columns: 1.1fr 1fr; gap: 16px; margin-top: 20px; align-items: start; }
  .spec { display: grid; grid-template-columns: 1fr 1fr; margin: 0; border: 1px solid var(--line); border-radius: 4px; }
  .spec div { display: grid; grid-template-columns: 46% 54%; border-bottom: 1px solid var(--line); }
  .spec div:nth-child(odd) { border-right: 1px solid var(--line); }
  .spec div:nth-last-child(-n + 2) { border-bottom: 0; }
  .spec dt { background: var(--sunk); padding: 7px 8px; font-size: 13px; color: var(--muted); }
  .spec dd { margin: 0; padding: 7px 8px; font-size: 14px; font-weight: 600; }
  .features { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 12px; }
  .features li { display: flex; align-items: center; gap: 6px; font-size: 14px; color: #a2a8af; }
  .features li.on { color: var(--ink); font-weight: 600; }
  .features li.on :global(svg) { color: var(--go); }
  .desc-h { margin-top: 18px; margin-bottom: 6px; }
  .desc { white-space: pre-line; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
  @media (max-width: 980px) {
    .top, .lower { grid-template-columns: 1fr; }
  }
  @media (max-width: 560px) {
    .spec { grid-template-columns: 1fr; }
    .spec div:nth-child(odd) { border-right: 0; }
    .spec div:nth-last-child(2) { border-bottom: 1px solid var(--line); }
    .thumbs { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  }
</style>
