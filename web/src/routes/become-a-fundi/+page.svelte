<script lang="ts">
  import { enhance } from '$app/forms';
  import { t, catName } from '$lib/i18n';
  import { localPhone } from '$lib/format';
  import Icon from '$lib/components/Icon.svelte';

  let { data, form } = $props();
  const lang = $derived(data.lang ?? 'ny');
  const v = $derived(((form as any)?.values ?? {}) as Record<string, string>);
  let priceType = $state('fixed');
  let busy = $state(false);
</script>

<svelte:head><title>{t(lang, 'nav_become')} · Fundi</title></svelte:head>

<div class="narrow section stack" style="--gap:20px">
  <h1 class="page-title">{t(lang, 'cta_title')}</h1>
  <p class="muted">Free to join. Customers near you find you, and payment is held safely until the job is done. Prefer help? A Fundi field agent can sign you up at your market.</p>

  {#if !data.signedIn}
    <div class="card stack">
      <p>First, sign in with your phone number. It takes one SMS.</p>
      <a class="btn" href={`/login?next=${encodeURIComponent(data.nextUrl)}`}>{t(lang, 'nav_signin')}</a>
    </div>
  {:else}
    {#if form?.error}<p class="alert error" role="alert">{form.error}</p>{/if}
    <form method="POST" class="stack" style="--gap:24px" use:enhance={() => { busy = true; return async ({ update }) => { await update({ reset: false }); busy = false; }; }}>
      <section class="card stack">
        <h2><span class="step">1</span> Mumagwira ntchito yanji? <span class="hint">What work do you do?</span></h2>
        <div class="trades">
          {#each data.categories as c}
            <label class="trade">
              <input type="checkbox" name="trades" value={c.slug} checked={(v.trades ?? '') === c.slug} />
              <Icon name={c.icon} size={30} />
              <span class="bold">{catName(lang, c)}</span>
              {#if lang === 'ny'}<span class="tiny muted">{c.name_en}</span>{/if}
            </label>
          {/each}
        </div>
        <p class="hint">Choose up to 4.</p>
      </section>

      <section class="card stack">
        <h2><span class="step">2</span> Dzina lanu <span class="hint">Your name, as customers will see it</span></h2>
        <label class="field">Name<input name="displayName" required minlength="2" maxlength="60" value={v.displayName ?? data.user?.name ?? ''} autocomplete="name" /></label>
        <label class="field">Years of experience <span class="hint">(optional)</span><input name="years" type="number" min="0" max="60" inputmode="numeric" value={v.years ?? ''} /></label>
        <label class="field">About your work <span class="hint">(optional)</span><textarea name="bio" maxlength="600" placeholder="e.g. Plumber for 9 years. Leaks, toilets, geysers.">{v.bio ?? ''}</textarea></label>
      </section>

      <section class="card stack">
        <h2><span class="step">3</span> Mumagwira kuti? <span class="hint">Where do you work?</span></h2>
        <select name="place" required value={v.place ?? ''}>
          <option value="" disabled>Choose your area</option>
          {#each Object.entries(data.districts) as [d, list]}
            <optgroup label={d}>{#each list as p}<option value={p.id}>{p.name}, {d}</option>{/each}</optgroup>
          {/each}
        </select>
        <label class="field">Landmark near your workshop <span class="hint">(optional)</span><input name="landmark" maxlength="160" value={v.landmark ?? ''} placeholder="e.g. Opposite Area 25 market" /></label>
        <label class="choice"><input type="checkbox" name="homeVisits" checked={v.homeVisits !== undefined ? v.homeVisits === 'on' : true} /> I can visit customers at home</label>
      </section>

      <section class="card stack">
        <h2><span class="step">4</span> Ndalama zanu <span class="hint">Where should we send your money?</span></h2>
        <label class="field">Airtel Money or TNM Mpamba number
          <input name="payoutPhone" type="tel" inputmode="tel" value={v.payoutPhone ?? localPhone(data.user?.phone)} required />
        </label>
      </section>

      <section class="card stack">
        <h2><span class="step">5</span> Ntchito yanu yoyamba <span class="hint">Your first service (you can add more later)</span></h2>
        <label class="field">Service name<input name="serviceTitle" maxlength="80" placeholder="e.g. Leak repair" value={v.serviceTitle ?? ''} /></label>
        <div class="choices">
          <label class="choice"><input type="radio" name="priceType" value="fixed" bind:group={priceType} /> Fixed price</label>
          <label class="choice"><input type="radio" name="priceType" value="from" bind:group={priceType} /> From price</label>
          <label class="choice"><input type="radio" name="priceType" value="quote" bind:group={priceType} /> {t(lang, 'ask_quote')}</label>
        </div>
        {#if priceType !== 'quote'}
          <label class="field">Price (MWK)<input name="price" inputmode="numeric" required placeholder="e.g. 8000" value={v.price ?? ''} /></label>
        {/if}
        <p class="hint">New services are checked by our team. Once your ID is verified, they go live straight away.</p>
      </section>

      <label class="choice consent">
        <input type="checkbox" name="consent" required />
        <span class="small">I agree to the Fundi terms. Fundi may show my name, trade, area and photos to customers. My phone number is shared only with customers who book me.</span>
      </label>

      <button class="btn block" style="min-height:58px;font-size:19px" disabled={busy}>{busy ? '…' : 'Pitirizani · Join Fundi'}</button>
    </form>
  {/if}
</div>

<style>
  h2 { font-size: 20px; display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; }
  .step { display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; background: var(--green); color: #fff; font-size: 15px; }
  .trades { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; }
  .trade { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 14px 8px; min-height: 104px; text-align: center; border: 1.5px solid var(--line-strong); border-radius: var(--radius); background: var(--surface); cursor: pointer; color: var(--ink); }
  .trade input { position: absolute; opacity: 0; pointer-events: none; }
  .trade:has(input:checked) { border: 3px solid var(--green); background: var(--green-tint); color: var(--green); }
  .trade:has(input:focus-visible) { outline: 3px solid #2563eb; }
  .consent { align-items: flex-start; }
</style>
