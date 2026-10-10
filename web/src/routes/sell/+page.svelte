<script lang="ts">
  import { enhance } from '$app/forms';
  import { page } from '$app/state';
  import { localPhone, mwk } from '$lib/format';
  import Icon from '$lib/components/Icon.svelte';

  let { data, form } = $props();
  const s = $derived(data.settings);
  const values = $derived((form as any)?.values ?? {});
  const byDistrict = $derived(data.places.reduce((acc: Record<string, any[]>, p: any) => ((acc[p.district] ??= []).push(p), acc), {}));
  let kind = $state('private');
  let busy = $state(false);
</script>

<svelte:head><title>Sell or hire out your car · Galimoto</title></svelte:head>

<div class="wrap page sell">
  <section class="intro stack" style="--gap:14px">
    <h1>Sell your car, or earn from it on hire</h1>
    <p class="lead">List a car that is already in Malawi. Buyers across the country find it by make, price and district, then reserve it with a deposit before they travel to see it.</p>
    <ul class="points stack" style="--gap:10px">
      <li><Icon name="shield" /> <span><strong>Serious buyers only.</strong> A buyer pays a deposit of {s.depositPercent}% (between {mwk(s.depositMinMwk)} and {mwk(s.depositMaxMwk)}) to hold your car for {s.reservationHoldHours / 24} days. If they don't show up, nothing is lost: the car goes back on sale.</span></li>
      <li><Icon name="key" /> <span><strong>Hire out by the day.</strong> Renters book dates and pay up front by mobile money. Booked dates are blocked automatically, so you never double-book.</span></li>
      <li><Icon name="phone" /> <span><strong>Paid to your wallet.</strong> Deposits and hire fees go to your Airtel Money or TNM Mpamba number once the deal is done.</span></li>
    </ul>
    <div class="fees panel stack" style="--gap:6px">
      <strong>What it costs</strong>
      <span class="small">Listing is free. When a car sells through a reservation, Galimoto keeps {s.saleFeePercent}% of the price, taken from the deposit. On rentals we keep {s.rentalCommissionPercent}% of each booking.</span>
    </div>
  </section>

  <section class="panel stack formcard">
    {#if !data.user}
      <h2>Start selling</h2>
      <p>Sign in with your phone number first. It takes a minute and needs no password.</p>
      <a class="btn lg block" href={`/login?next=${encodeURIComponent(page.url.pathname)}`}>Sign in to continue</a>
    {:else}
      <h2>Your seller details</h2>
      {#if form?.error}<p class="alert error" role="alert">{form.error}</p>{/if}
      <form method="POST" class="stack" use:enhance={() => { busy = true; return async ({ update }) => { await update({ reset: false }); busy = false; }; }}>
        <fieldset class="grid2">
          <legend class="sr-only">Seller type</legend>
          <label class="choice"><input type="radio" name="kind" value="private" bind:group={kind} /> <span><strong>Private seller</strong><br /><span class="hint">Selling my own car</span></span></label>
          <label class="choice"><input type="radio" name="kind" value="dealer" bind:group={kind} /> <span><strong>Dealer or car hire</strong><br /><span class="hint">A yard or a business</span></span></label>
        </fieldset>
        <label class="field">{kind === 'dealer' ? 'Business name' : 'Your name'}
          <input name="name" required minlength="2" maxlength="80" value={values.name ?? data.user.name ?? ''} placeholder={kind === 'dealer' ? 'e.g. Area 47 Car Yard' : 'e.g. Grace Banda'} />
        </label>
        <label class="field">Where are you?
          <select name="placeId" required value={values.placeId ?? ''}>
            <option value="" disabled>Choose your area</option>
            {#each Object.entries(byDistrict) as [d, list]}<optgroup label={d}>{#each list as p}<option value={p.id}>{p.name}, {d}</option>{/each}</optgroup>{/each}
          </select>
        </label>
        <label class="field">Street or landmark <span class="hint">(optional)</span><input name="address" maxlength="160" value={values.address ?? ''} placeholder="e.g. Opposite Game, Area 47" /></label>
        <label class="field">Mobile money number for payouts
          <input name="payoutPhone" type="tel" inputmode="tel" value={values.payoutPhone ?? localPhone(data.user.phone)} />
          <span class="hint">Airtel (099…) or TNM (088…)</span>
        </label>
        {#if kind === 'dealer'}
          <label class="field">About your business <span class="hint">(optional)</span><textarea name="about" maxlength="800">{values.about ?? ''}</textarea></label>
        {/if}
        <label class="check"><input type="checkbox" name="whatsapp" checked /> Buyers can message me on WhatsApp</label>
        <button class="btn lg block" disabled={busy}>{busy ? 'Saving…' : 'Continue to list a car'}</button>
        <p class="tiny muted">By continuing you agree to the <a href="/terms">terms</a>. Our team checks new sellers; once you're verified, your listings go live straight away.</p>
      </form>
    {/if}
  </section>
</div>

<style>
  .sell { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr); gap: 32px; align-items: start; }
  h1 { font-family: var(--font-cond); font-size: clamp(30px, 4vw, 44px); line-height: 1.05; }
  .lead { font-size: 17px; max-width: 56ch; }
  .points { list-style: none; padding: 0; margin: 0; }
  .points li { display: grid; grid-template-columns: 24px 1fr; gap: 10px; max-width: 60ch; }
  .points :global(svg) { color: var(--go); margin-top: 2px; }
  .fees { background: var(--hold-tint); border-color: #ecd9a4; }
  .formcard { position: sticky; top: 16px; }
  fieldset { border: 0; padding: 0; margin: 0; }
  .choice { display: flex; gap: 10px; align-items: flex-start; padding: 12px; border: 1px solid var(--line-strong); border-radius: var(--radius); cursor: pointer; }
  .choice:has(input:checked) { border-color: var(--go); background: var(--go-tint); }
  .choice input { margin-top: 4px; accent-color: var(--go); }
  @media (max-width: 860px) { .sell { grid-template-columns: 1fr; } .formcard { position: static; } }
</style>
