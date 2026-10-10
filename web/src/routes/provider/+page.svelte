<script lang="ts">
  import { enhance } from '$app/forms';
  import { t, catName } from '$lib/i18n';
  import { localPhone, mwk, timeLeft } from '$lib/format';
  import Badge from '$lib/components/Badge.svelte';
  import BookingRow from '$lib/components/BookingRow.svelte';
  import Icon from '$lib/components/Icon.svelte';

  let { data, form } = $props();
  const lang = $derived(data.lang ?? 'ny');
  const me = $derived(data.me);
  const requests = $derived(data.active.filter((b: any) => b.status === 'requested'));
  const ongoing = $derived(data.active.filter((b: any) => b.status !== 'requested'));
  let priceType = $state('fixed');
  let showAdd = $state(false);
  let showSettings = $state(false);
  let busy = $state(false);
  const sub = () => { busy = true; return async ({ update }: any) => { await update(); busy = false; }; };
</script>

<svelte:head><title>{t(lang, 'nav_provider')} · Fundi</title></svelte:head>

<div class="narrow section stack" style="--gap:18px">
  <div class="row between">
    <h1 class="page-title">Moni, {me.display_name.split(' ')[0]}</h1>
    <form method="POST" action="?/availability" use:enhance={sub}>
      <input type="hidden" name="available" value={me.available_today ? 'false' : 'true'} />
      <button class="toggle" class:on={me.available_today} aria-pressed={me.available_today} disabled={busy}>
        <span class="dot"></span>{me.available_today ? 'Ndilipo lero · Available' : 'Not available today'}
      </button>
    </form>
  </div>

  {#if data.welcome}<p class="alert ok" role="status">Takulandirani! You are listed on Fundi. Verify your ID below to rank higher and get the verified tick.</p>{/if}
  {#if form?.error}<p class="alert error" role="alert">{form.error}</p>{/if}
  {#if form?.saved}<p class="alert ok" role="status">Saved.</p>{/if}
  {#if me.status === 'paused'}<p class="alert info">Your profile is paused and hidden from search.</p>{/if}

  <section class="earn">
    <div><span>Paid this week</span><strong>{mwk(me.earnings.paid_7d)}</strong><span>to {me.payout_operator === 'airtel' ? 'Airtel Money' : 'TNM Mpamba'}</span></div>
    <div><span>Held safely (escrow)</span><strong>{mwk(me.earnings.held_in_escrow)}</strong><span>released when customers confirm</span></div>
  </section>

  <section class="stack">
    <h2>Ntchito zatsopano · New requests</h2>
    {#each requests as b (b.id)}
      <a class="card req" href={`/bookings/${b.id}`}>
        <div class="row between"><strong>{b.listing_title ?? catName(lang, b)}</strong>{#if timeLeft(b.expires_at)}<span class="pill warn">Reply in {timeLeft(b.expires_at)}</span>{/if}</div>
        <span class="small muted">{b.customer_name} · {b.landmark ?? ''}</span>
        <span class="small">{b.type === 'quote' ? 'Wants a price' : mwk(b.price_mwk)}</span>
      </a>
    {:else}
      <p class="muted card">No new requests right now. Keep "Available" on so customers see you first.</p>
    {/each}
  </section>

  {#if ongoing.length}
    <section class="stack">
      <h2>Ntchito zikupitirira · Ongoing</h2>
      {#each ongoing as b (b.id)}<BookingRow {b} {lang} as="provider" />{/each}
    </section>
  {/if}

  <section class="card stack">
    <div class="row between"><h2>Verification</h2><Badge level={me.verification_level} {lang} /></div>
    {#if me.verification_level !== 'basic'}
      <p class="small">Your ID is verified. Finish 10 jobs with a 4.5+ rating to earn the Fundi Trusted badge.</p>
    {:else if me.verification?.status === 'pending'}
      <p class="small">We are checking your ID. This usually takes less than 24 hours.</p>
    {:else}
      {#if me.verification?.status === 'rejected'}<p class="alert error small">Last check failed: {me.verification.reason}</p>{/if}
      <p class="small">Verified fundis get a tick, rank higher, and can take larger escrow jobs. Photos are kept private and deleted after the check.</p>
      <form method="POST" action="?/verify" enctype="multipart/form-data" class="stack" use:enhance={sub}>
        <label class="field">Photo of your national ID<input type="file" name="idPhoto" accept="image/*" capture="environment" required /></label>
        <label class="field">A selfie, face clearly visible<input type="file" name="selfie" accept="image/*" capture="user" required /></label>
        <button class="btn" disabled={busy}>{busy ? 'Uploading…' : 'Send for checking'}</button>
      </form>
    {/if}
  </section>

  <section class="stack">
    <div class="row between"><h2>{t(lang, 'services')}</h2><button class="btn small secondary" onclick={() => (showAdd = !showAdd)}>+ Add service</button></div>
    {#if showAdd}
      <form method="POST" action="?/addListing" enctype="multipart/form-data" class="card stack" use:enhance={() => { busy = true; return async ({ update, result }) => { await update(); busy = false; if (result.type === 'success') showAdd = false; }; }}>
        <label class="field">Trade
          <select name="category" required>{#each me.trades as c}<option value={c.id}>{catName(lang, c)}</option>{/each}</select>
        </label>
        <label class="field">Service name<input name="title" required minlength="3" maxlength="80" placeholder="e.g. Toilet fitting" /></label>
        <label class="field">Details <span class="hint">(optional)</span><textarea name="description" maxlength="600"></textarea></label>
        <div class="choices">
          <label class="choice"><input type="radio" name="priceType" value="fixed" bind:group={priceType} /> Fixed price</label>
          <label class="choice"><input type="radio" name="priceType" value="from" bind:group={priceType} /> From price</label>
          <label class="choice"><input type="radio" name="priceType" value="quote" bind:group={priceType} /> Quote</label>
        </div>
        {#if priceType !== 'quote'}<label class="field">Price (MWK)<input name="price" inputmode="numeric" required /></label>{/if}
        <label class="field">Photo of your work <span class="hint">(optional)</span><input type="file" name="photo" accept="image/*" /></label>
        <button class="btn" disabled={busy}>{t(lang, 'save')}</button>
      </form>
    {/if}
    {#each me.listings as l (l.id)}
      <article class="card stack" style="--gap:8px">
        <div class="row between">
          <strong>{l.title}</strong>
          <span class="pill {l.status === 'live' ? 'good' : l.status === 'rejected' ? 'bad' : l.status === 'pending' ? 'warn' : 'neutral'}">{l.status === 'pending' ? 'Being checked' : l.status}</span>
        </div>
        <span class="small">{l.price_type === 'quote' ? t(lang, 'ask_quote') : `${l.price_type === 'from' ? 'From ' : ''}${mwk(l.price_mwk)}`}</span>
        {#if l.reject_reason}<p class="small alert error">{l.reject_reason}</p>{/if}
        {#if l.photo_ids.length}
          <div class="thumbs">{#each l.photo_ids as id}<img src={`${data.fileBase}/files/${id}`} alt="" loading="lazy" />{/each}</div>
        {/if}
        <div class="row" style="--gap:8px">
          {#if l.status === 'live' || l.status === 'paused'}
            <form method="POST" action="?/listingStatus" use:enhance={sub}>
              <input type="hidden" name="id" value={l.id} /><input type="hidden" name="status" value={l.status === 'live' ? 'paused' : 'live'} />
              <button class="btn small ghost" disabled={busy}>{l.status === 'live' ? 'Pause' : 'Show again'}</button>
            </form>
          {/if}
          {#if l.photo_ids.length < 6}
            <form method="POST" action="?/addPhoto" enctype="multipart/form-data" class="row" style="--gap:6px" use:enhance={sub}>
              <input type="hidden" name="id" value={l.id} /><input type="hidden" name="existing" value={l.photo_ids.join(',')} />
              <label class="btn small ghost"><Icon name="more" size={16} /> Add photo<input type="file" name="photo" accept="image/*" class="sr-only" onchange={(e) => (e.currentTarget as HTMLInputElement).form?.requestSubmit()} /></label>
            </form>
          {/if}
        </div>
      </article>
    {:else}
      <p class="muted card">Add your first service so customers can book you.</p>
    {/each}
  </section>

  {#if data.past.length}
    <section class="stack">
      <h2>Past jobs</h2>
      {#each data.past as b (b.id)}<BookingRow {b} {lang} as="provider" />{/each}
    </section>
  {/if}

  <section class="card stack">
    <button class="row between linkish" onclick={() => (showSettings = !showSettings)} aria-expanded={showSettings}>
      <h2>Settings</h2><span class="muted small">{showSettings ? 'Hide' : 'Show'}</span>
    </button>
    {#if showSettings}
      <form method="POST" action="?/settings" class="stack" use:enhance={sub}>
        <label class="field">Payout number (Airtel Money or TNM Mpamba)<input name="payoutPhone" type="tel" value={localPhone(me.payout_msisdn)} /></label>
        <label class="field">How far will you travel? (km)<input name="radius" type="number" min="1" max="100" value={me.service_radius_km} /></label>
        <label class="field">Working hours<input name="workHours" maxlength="80" value={me.work_hours ?? ''} placeholder="Mon-Sat 7:00-18:00" /></label>
        <label class="field">About your work<textarea name="bio" maxlength="600">{me.bio ?? ''}</textarea></label>
        <label class="choice"><input type="checkbox" name="homeVisits" checked={me.home_visits} /> I visit customers at home</label>
        <button class="btn" disabled={busy}>{t(lang, 'save')}</button>
      </form>
    {/if}
  </section>
</div>

<style>
  .toggle { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 14px; border-radius: 22px; border: 1.5px solid var(--line-strong); background: var(--surface); font: inherit; font-weight: 700; font-size: 14px; color: var(--muted); cursor: pointer; }
  .toggle.on { border-color: var(--green); color: var(--green); background: var(--green-tint); }
  .toggle .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--line-strong); }
  .toggle.on .dot { background: var(--green); }
  .earn { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: var(--green); color: #fff; border-radius: 18px; padding: 18px; }
  .earn div { display: flex; flex-direction: column; gap: 2px; }
  .earn span { font-size: 13px; color: #cfe3d6; }
  .earn strong { font-size: 24px; }
  .req { display: flex; flex-direction: column; gap: 6px; border: 2px solid var(--orange); color: var(--ink); text-decoration: none; }
  .thumbs { display: flex; gap: 6px; flex-wrap: wrap; }
  .thumbs img { width: 64px; height: 64px; object-fit: cover; border-radius: 8px; }
  .linkish { background: none; border: 0; padding: 0; font: inherit; cursor: pointer; width: 100%; color: inherit; }
  label.btn { cursor: pointer; }
  @media (max-width: 420px) { .earn { grid-template-columns: 1fr; } }
</style>
