<script lang="ts">
  import { enhance } from '$app/forms';
  import { carTitle, dateLabel, km, localPhone, mwk } from '$lib/format';
  import CarPhoto from '$lib/components/CarPhoto.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import Plate from '$lib/components/Plate.svelte';
  import StatusPill from '$lib/components/StatusPill.svelte';

  let { data, form } = $props();
  const s = $derived(data.seller);
  const st = $derived(s.stats);
  const LISTING: Record<string, { label: string; tone: string; note?: string }> = {
    pending: { label: 'Being checked', tone: 'held', note: 'Our team checks new listings, usually within a few hours.' },
    live: { label: 'Live', tone: 'good' },
    reserved: { label: 'Reserved', tone: 'held' },
    sold: { label: 'Sold', tone: 'quiet' },
    paused: { label: 'Paused', tone: 'quiet', note: 'Hidden from buyers until you resume it.' },
    rejected: { label: 'Needs changes', tone: 'bad' },
  };
  const FILTERS = [['', 'All'], ['live', 'Live'], ['pending', 'Being checked'], ['reserved', 'Reserved'], ['paused', 'Paused'], ['sold', 'Sold']];
  let editing = $state(false);
  const sure = (msg: string) => (e: SubmitEvent) => { if (!confirm(msg)) e.preventDefault(); };
</script>

<svelte:head><title>Seller dashboard · GalimotoYanga</title></svelte:head>

<div class="wrap page stack" style="--gap:18px">
  <header class="row between wrap-row">
    <div class="stack" style="--gap:4px">
      <h1>{s.name}</h1>
      <span class="row small muted" style="--gap:8px">
        {s.kind === 'dealer' ? 'Dealer' : 'Private seller'} · {s.area}, {s.district}
        {#if s.verified}<span class="tag verified"><Icon name="shield" size={13} /> Verified</span>{:else}<span class="tag held">Not yet verified</span>{/if}
      </span>
    </div>
    <div class="row" style="--gap:8px">
      <a class="btn plain" href={`/dealers/${s.id}`}>View my page</a>
      <a class="btn" href="/seller/cars/new">+ List a car</a>
    </div>
  </header>

  {#if !s.verified}
    <p class="alert info small">New listings wait for a quick check by our team before buyers can see them. Once your account is verified, they go live straight away.</p>
  {/if}
  {#if form?.error}<p class="alert error" role="alert">{form.error}</p>{/if}

  <section class="stats">
    <a href="/seller?status=live" class="stat"><b>{s.live_count}</b><span>Live cars</span></a>
    <a href="/seller?status=pending" class="stat"><b>{st.pending_listings}</b><span>Being checked</span></a>
    <div class="stat"><b>{Number(st.total_views).toLocaleString()}</b><span>Views</span></div>
    <a href="/messages" class="stat"><b>{st.inquiries}</b><span>Enquiries</span></a>
    <a href="/orders?as=seller" class="stat"><b>{st.open_orders}</b><span>Open orders</span></a>
    <div class="stat money"><b>{mwk(st.held_mwk)}</b><span>Held for you</span></div>
    <div class="stat money"><b>{mwk(st.paid_out_mwk)}</b><span>Paid to {localPhone(s.payout_msisdn)}</span></div>
  </section>

  {#if data.orders.length}
    <section class="panel stack" style="--gap:8px">
      <h2>Needs your attention</h2>
      {#each data.orders as o (o.id)}
        <a class="order" href={`/orders/${o.id}`}>
          <Plate text={o.ref} size="sm" />
          <span class="grow"><strong>{carTitle(o)}</strong> <span class="muted small">{o.kind === 'reservation' ? 'reserved by' : `${dateLabel(o.start_date)} to ${dateLabel(o.end_date)},`} {o.buyer_name}</span></span>
          <StatusPill status={o.status} />
          <span class="price">{mwk(o.amount_mwk)}</span>
        </a>
      {/each}
    </section>
  {/if}

  <section class="stack" style="--gap:10px">
    <div class="row between wrap-row">
      <h2>Your cars</h2>
      <nav class="filters" aria-label="Filter listings">
        {#each FILTERS as [k, label]}<a href={k ? `/seller?status=${k}` : '/seller'} aria-current={data.status === k ? 'page' : undefined}>{label}</a>{/each}
      </nav>
    </div>

    {#each data.cars as c (c.id)}
      {@const L = LISTING[c.status] ?? { label: c.status, tone: 'quiet' }}
      <article class="panel car">
        <a href={`/cars/${c.stock_no}`} class="ph"><CarPhoto id={c.photo_id} fileBase={data.fileBase} body={c.body_type} color={c.color} alt={carTitle(c)} /></a>
        <div class="stack" style="--gap:5px; min-width:0">
          <div class="row" style="--gap:8px">
            <a href={`/cars/${c.stock_no}`}><strong>{carTitle(c)}</strong></a>
            <span class="tag {L.tone}">{L.label}</span>
            <span class="tag quiet">{c.purpose === 'sale' ? 'For sale' : 'For hire'}</span>
          </div>
          <span class="small muted"><Plate text={c.stock_no} size="sm" /> {c.variant ?? ''} {c.mileage_km != null ? `· ${km(c.mileage_km)}` : ''} · {c.area}</span>
          <span class="price">{c.purpose === 'sale' ? mwk(c.price_mwk) : `${mwk(c.daily_rate_mwk)} / day`}
            {#if c.previous_price_mwk}<span class="was">{mwk(c.previous_price_mwk)}</span>{/if}</span>
          <span class="tiny muted">{c.views} views · {c.favorites} saved · {c.inquiries} enquiries · {c.photo_count} photos</span>
          {#if c.status === 'rejected' && c.reject_reason}<p class="alert error small">Our team asked for changes: {c.reject_reason}. Edit the listing and save to send it back for checking.</p>
          {:else if L.note}<span class="tiny muted">{L.note}</span>{/if}
          {#if c.photo_count === 0}<span class="tiny" style="color:var(--drop)">Add photos: cars with photos get far more enquiries.</span>{/if}
        </div>
        <div class="acts">
          <a class="btn plain sm" href={`/seller/cars/${c.id}`}>Edit</a>
          {#if c.status === 'live'}
            <form method="POST" action="?/status" use:enhance><input type="hidden" name="id" value={c.id} /><button class="btn plain sm" name="action" value="pause">Pause</button></form>
          {/if}
          {#if c.status === 'paused'}
            <form method="POST" action="?/status" use:enhance><input type="hidden" name="id" value={c.id} /><button class="btn plain sm" name="action" value="resume">Resume</button></form>
          {/if}
          {#if c.purpose === 'sale' && ['live', 'paused'].includes(c.status)}
            <form method="POST" action="?/status" use:enhance onsubmit={sure('Mark this car as sold? It will stay visible with a Sold badge.')}><input type="hidden" name="id" value={c.id} /><button class="btn plain sm" name="action" value="sold">Sold elsewhere</button></form>
          {/if}
        </div>
      </article>
    {:else}
      <div class="panel empty stack" style="--gap:10px">
        <strong>{data.status ? 'No cars with this status.' : 'You have not listed a car yet.'}</strong>
        <a class="btn" href="/seller/cars/new">List your first car</a>
      </div>
    {/each}
  </section>

  <section class="panel stack">
    <div class="row between"><h2>Seller details</h2><button class="btn plain sm" onclick={() => (editing = !editing)}>{editing ? 'Close' : 'Edit'}</button></div>
    {#if form?.saved === 'profile'}<p class="alert ok small">Saved.</p>{/if}
    {#if editing}
      <form method="POST" action="?/profile" class="stack" use:enhance={() => async ({ update }) => { await update({ reset: false }); editing = false; }}>
        <div class="grid2">
          <label class="field">Name<input name="name" required minlength="2" maxlength="80" value={s.name} /></label>
          <label class="field">Mobile money for payouts<input name="payoutPhone" type="tel" value={localPhone(s.payout_msisdn)} /></label>
          <label class="field">Street or landmark<input name="address" maxlength="160" value={s.address ?? ''} /></label>
        </div>
        <label class="field">About<textarea name="about" maxlength="800">{s.about ?? ''}</textarea></label>
        <label class="check"><input type="checkbox" name="whatsapp" checked={s.whatsapp} /> Buyers can message me on WhatsApp</label>
        <button class="btn">Save details</button>
      </form>
    {:else}
      <dl class="small">
        <dt>Payouts to</dt><dd>{localPhone(s.payout_msisdn)} ({s.payout_operator === 'airtel' ? 'Airtel Money' : 'TNM Mpamba'})</dd>
        <dt>Address</dt><dd>{s.address ? `${s.address}, ` : ''}{s.area}, {s.district}</dd>
        <dt>WhatsApp</dt><dd>{s.whatsapp ? 'On' : 'Off'}</dd>
      </dl>
    {/if}
  </section>
</div>

<style>
  h1 { font-family: var(--font-cond); font-size: 32px; }
  .wrap-row { flex-wrap: wrap; gap: 10px; }
  .stats { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; }
  .stat { display: flex; flex-direction: column; gap: 2px; padding: 12px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); color: var(--ink); text-decoration: none; }
  a.stat:hover { border-color: var(--ink); }
  .stat b { font-family: var(--font-cond); font-size: 26px; line-height: 1; }
  .stat.money b { font-size: 19px; }
  .stat span { font-size: 13px; color: var(--muted); }
  .order { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-top: 1px solid var(--line); color: var(--ink); text-decoration: none; flex-wrap: wrap; }
  .grow { flex: 1; min-width: 180px; }
  .filters { display: flex; gap: 4px; flex-wrap: wrap; }
  .filters a { padding: 5px 10px; border-radius: 999px; border: 1px solid var(--line-strong); color: var(--ink); text-decoration: none; font-size: 14px; background: var(--surface); }
  .filters a[aria-current='page'] { background: var(--asphalt); color: #fff; border-color: var(--asphalt); }
  .car { display: grid; grid-template-columns: 150px minmax(0, 1fr) auto; gap: 14px; align-items: start; }
  .ph { border-radius: 4px; overflow: hidden; }
  .acts { display: flex; flex-direction: column; gap: 6px; align-items: stretch; }
  .acts form { display: contents; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 0; }
  dt { color: var(--muted); }
  dd { margin: 0; }
  @media (max-width: 960px) { .stats { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
  @media (max-width: 640px) {
    .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .car { grid-template-columns: 110px minmax(0, 1fr); }
    .acts { grid-column: 1 / -1; flex-direction: row; flex-wrap: wrap; }
  }
</style>
