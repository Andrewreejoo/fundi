<script lang="ts">
  import { t, catName } from '$lib/i18n';
  import { mwk } from '$lib/format';
  import Icon from '$lib/components/Icon.svelte';

  let { data, form } = $props();
  const lang = $derived(data.lang ?? 'ny');
  const p = $derived(data.provider);
  const s = $derived(data.settings);
  const v = $derived(((form as any)?.values ?? {}) as Record<string, string>);

  let listing = $state('');
  let escrow = $state(true);
  $effect.pre(() => {
    if (!listing) listing = v.listing || data.listingId || p.listings[0]?.id || 'quote';
  });

  const chosen = $derived(p.listings.find((l: any) => l.id === listing));
  const isFixed = $derived(chosen?.price_type === 'fixed');
  const fee = $derived(isFixed && escrow ? Math.max(s.protectionFeeMinMwk, Math.round((chosen.price_mwk * s.protectionFeePercent) / 100)) : 0);
  $effect(() => {
    // Escrow defaults on for larger jobs and quotes; customers may switch it off for small fixed-price jobs.
    escrow = !isFixed || chosen.price_mwk >= s.escrowDefaultMinMwk;
  });

  const tomorrow = $derived(new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  let date = $state('');
  $effect.pre(() => { if (!date) date = v.date || data.today; });
</script>

<svelte:head><title>{t(lang, 'book')} {p.display_name} · Fundi</title></svelte:head>

<div class="narrow section">
  <form method="POST" class="stack" style="--gap:20px">
    <div class="row" style="--gap:10px">
      <a href={`/fundi/${p.id}`} class="icon-btn" aria-label={t(lang, 'back')}><Icon name="back" /></a>
      <h1 class="page-title">{t(lang, 'book')} · {p.display_name}</h1>
    </div>

    {#if form?.error}<p class="alert error" role="alert">{form.error}</p>{/if}

    <fieldset class="stack">
      <legend class="bold">{t(lang, 'services')}</legend>
      {#each p.listings as l (l.id)}
        <label class="choice">
          <input type="radio" name="listing" value={l.id} bind:group={listing} />
          <span class="grow">{l.title}</span>
          <span>{l.price_type === 'quote' ? t(lang, 'ask_quote') : `${l.price_type === 'from' ? t(lang, 'from_price') + ' ' : ''}${mwk(l.price_mwk)}`}</span>
        </label>
      {/each}
      <label class="choice">
        <input type="radio" name="listing" value="quote" bind:group={listing} />
        <span class="grow">{t(lang, 'something_else')}</span><span>{t(lang, 'ask_quote')}</span>
      </label>
      {#if listing === 'quote'}
        <label class="field">Trade
          <select name="category" required>
            {#each p.trades as c}<option value={c.id}>{catName(lang, c)}</option>{/each}
          </select>
        </label>
      {/if}
      {#if !isFixed}<p class="hint">{p.display_name.split(' ')[0]} will send you a price within {s.quoteReplyHours} hours. You pay only if you accept it.</p>{/if}
    </fieldset>

    <label class="field">{t(lang, 'describe_job')} {#if isFixed}<span class="hint">(optional)</span>{/if}
      <textarea name="description" maxlength="1000" required={!isFixed} placeholder="e.g. The kitchen tap leaks under the sink">{v.description ?? ''}</textarea>
    </label>

    <fieldset class="stack">
      <legend class="bold">{t(lang, 'when')}</legend>
      <div class="choices">
        <label class="choice"><input type="radio" name="date" value={data.today} bind:group={date} />{t(lang, 'today')}</label>
        <label class="choice"><input type="radio" name="date" value={tomorrow} bind:group={date} />{t(lang, 'tomorrow')}</label>
        <label class="choice"><input type="date" name="date_pick" min={data.today} onchange={(e) => (date = (e.target as HTMLInputElement).value)} aria-label="Another date" /></label>
      </div>
      <div class="choices">
        <label class="choice"><input type="radio" name="slot" value="morning" checked={v.slot === 'morning'} />{t(lang, 'morning')}</label>
        <label class="choice"><input type="radio" name="slot" value="afternoon" checked={!v.slot || v.slot === 'afternoon'} />{t(lang, 'afternoon')}</label>
        <label class="choice"><input type="radio" name="slot" value="evening" checked={v.slot === 'evening'} />{t(lang, 'evening')}</label>
      </div>
      {#if date !== data.today && date !== tomorrow}<input type="hidden" name="date" value={date} />{/if}
    </fieldset>

    <fieldset class="stack">
      <legend class="bold">{t(lang, 'where')}</legend>
      <select name="place" required value={String(v.place ?? data.saved.placeId ?? '')}>
        <option value="" disabled>Choose your area</option>
        {#each Object.entries(data.districts) as [d, list]}
          <optgroup label={d}>{#each list as pl}<option value={pl.id}>{pl.name}, {d}</option>{/each}</optgroup>
        {/each}
      </select>
      <label class="field">{t(lang, 'landmark')}
        <input name="landmark" maxlength="160" placeholder="e.g. Behind Area 25 market, blue gate" value={v.landmark ?? ''} />
      </label>
    </fieldset>

    <label class="escrow" class:on={escrow}>
      <input type="checkbox" name="escrow" bind:checked={escrow} disabled={!isFixed} />
      {#if !isFixed}<input type="hidden" name="escrow" value="on" />{/if}
      <span class="ic"><Icon name="shield" size={26} /></span>
      <span class="stack" style="--gap:2px">
        <strong>{t(lang, 'escrow_title')}</strong>
        <span class="small">{t(lang, 'escrow_body')} Protection fee {s.protectionFeePercent}% (min {mwk(s.protectionFeeMinMwk)}).</span>
      </span>
    </label>

    {#if isFixed}
      <div class="stack sum" style="--gap:4px">
        <div class="row between"><span>Job</span><span>{mwk(chosen.price_mwk)}</span></div>
        {#if escrow}<div class="row between muted"><span>Protection fee</span><span>{mwk(fee)}</span></div>{/if}
        <div class="row between bold total"><span>Total</span><span>{mwk(chosen.price_mwk + fee)}</span></div>
        {#if !escrow}<p class="hint">{t(lang, 'pay_direct')}.</p>{/if}
      </div>
    {/if}

    <button class="btn block" style="min-height:56px; font-size:18px">{t(lang, 'send_request')}</button>
    <p class="hint" style="text-align:center">
      {isFixed ? `${p.display_name.split(' ')[0]} has ${s.instantReplyHours} hours to accept. You pay after they accept.` : 'No payment until you accept a price.'}
    </p>
  </form>
</div>

<style>
  fieldset { border: 0; padding: 0; margin: 0; }
  legend { margin-bottom: 8px; font-size: 16px; }
  .grow { flex: 1; }
  .icon-btn { width: 44px; height: 44px; border-radius: 22px; background: var(--sunk); display: grid; place-items: center; color: var(--ink); }
  .escrow { display: flex; gap: 12px; align-items: flex-start; padding: 14px; border-radius: var(--radius); border: 1.5px solid var(--line-strong); background: var(--surface); cursor: pointer; }
  .escrow.on { background: #fff6e6; border-color: #f0d9a8; color: #5c4000; }
  .escrow input[type='checkbox'] { width: 22px; height: 22px; accent-color: var(--green); margin-top: 3px; }
  .escrow .ic { color: var(--gold-ink); }
  .total { font-size: 18px; }
  .choice input[type='date'] { border: 0; min-height: 0; padding: 0; background: transparent; }
</style>
