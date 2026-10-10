<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { onDestroy } from 'svelte';
  import { t, catName, type Key } from '$lib/i18n';
  import { dateLabel, dateTime, localPhone, mwk, timeLeft } from '$lib/format';
  import Icon from '$lib/components/Icon.svelte';
  import StatusPill from '$lib/components/StatusPill.svelte';

  let { data, form } = $props();
  const lang = $derived(data.lang ?? 'ny');
  const b = $derived(data.booking);
  const can = (a: string) => b.actions.includes(a);
  const pendingPayment = $derived(b.payments.find((p: any) => p.direction === 'collect' && p.status === 'pending'));
  const lastCollect = $derived([...b.payments].reverse().find((p: any) => p.direction === 'collect'));
  const otherPhone = $derived(b.role === 'customer' ? b.provider_phone : b.customer_phone);
  const otherName = $derived(b.role === 'customer' ? b.provider_name : b.customer_name);
  const busyLabel = $state({ v: '' });

  // While a mobile money prompt is waiting on the customer's phone, re-check every 4 seconds.
  let timer: ReturnType<typeof setInterval> | undefined;
  $effect(() => {
    if (pendingPayment && !timer) timer = setInterval(() => invalidateAll(), 4000);
    if (!pendingPayment && timer) { clearInterval(timer); timer = undefined; }
  });
  onDestroy(() => timer && clearInterval(timer));

  const go = (label: string) => () => {
    busyLabel.v = label;
    return async ({ update }: any) => { await update({ reset: false }); busyLabel.v = ''; };
  };
  let showDispute = $state(false);
  let showQuote = $state(false);
  let rating = $state(5);
</script>

<svelte:head><title>{b.ref} · Fundi</title></svelte:head>

<div class="narrow section stack" style="--gap:16px">
  <div class="row between">
    <a href={b.role === 'provider' ? '/provider' : '/bookings'} class="row muted small" style="--gap:4px"><Icon name="back" size={18} /> {t(lang, 'back')}</a>
    <span class="muted small">{b.ref}</span>
  </div>

  {#if data.isNew}<p class="alert ok" role="status">Booking sent. We will SMS you when {b.provider_name.split(' ')[0]} replies.</p>{/if}
  {#if form?.error}<p class="alert error" role="alert">{form.error}</p>{/if}

  <header class="card stack" style="--gap:8px">
    <div class="row between">
      <h1 class="page-title">{b.listing_title ?? catName(lang, b)}</h1>
      <StatusPill status={b.status} {lang} />
    </div>
    <p class="muted">
      {b.role === 'customer' ? b.provider_name : b.customer_name}
      {#if b.scheduled_for} · {dateLabel(b.scheduled_for)}{/if}{#if b.time_slot} · {t(lang, b.time_slot as Key)}{/if}
    </p>
    {#if b.landmark}<p class="row small" style="--gap:6px"><Icon name="pin" size={18} /> {b.landmark}</p>{/if}
    {#if b.description}<p class="desc">{b.description}</p>{/if}
    {#if otherPhone}
      <p class="row small" style="--gap:6px">
        <Icon name="call" size={18} />
        {#if otherPhone.includes('xxx')}<span class="muted">{localPhone(otherPhone)} · {t(lang, 'phone_hidden')}</span>
        {:else}<a href={`tel:${otherPhone}`}>{otherName.split(' ')[0]}: {localPhone(otherPhone)}</a>{/if}
      </p>
    {/if}
  </header>

  <!-- Money summary -->
  {#if b.price_mwk}
    <section class="card stack" style="--gap:6px">
      <div class="row between"><span>{b.type === 'quote' ? 'Quoted price' : 'Price'}</span><strong>{mwk(b.price_mwk)}</strong></div>
      {#if b.quote_note}<p class="small muted">“{b.quote_note}”</p>{/if}
      {#if b.escrow && b.role === 'customer' && b.protection_fee_mwk}
        <div class="row between muted small"><span>Protection fee</span><span>{mwk(b.protection_fee_mwk)}</span></div>
        <div class="row between bold"><span>Total</span><span>{mwk(b.total_mwk)}</span></div>
      {/if}
      {#if b.role === 'provider' && b.escrow && b.commission_mwk}
        <div class="row between muted small"><span>Fundi commission</span><span>−{mwk(b.commission_mwk)}</span></div>
        <div class="row between bold"><span>You receive</span><span>{mwk(b.provider_net_mwk)}</span></div>
      {/if}
      {#if b.escrow}
        <p class="row small held" style="--gap:6px"><Icon name="shield" size={18} />
          {#if ['paid', 'in_progress', 'completed', 'disputed'].includes(b.status)}Money is held safely by Fundi.{:else if b.status === 'confirmed'}Payment released to the fundi.{:else}Paid into escrow, released when the job is confirmed.{/if}
        </p>
      {:else}
        <p class="small muted">{t(lang, 'pay_direct')}.</p>
      {/if}
    </section>
  {/if}

  <!-- Next step for the viewer -->
  {#if pendingPayment}
    <section class="card stack wait" aria-live="polite">
      <strong>{t(lang, 'waiting_payment')}</strong>
      <p class="small">Check your phone for the {pendingPayment.operator === 'airtel' ? 'Airtel Money' : 'TNM Mpamba'} prompt and enter your PIN. This page updates by itself.</p>
    </section>
  {:else if can('pay')}
    <form method="POST" action="?/pay" class="card stack" use:enhance={go('pay')}>
      <h2>{t(lang, 'pay_now')} {mwk(b.total_mwk)}</h2>
      {#if lastCollect?.status === 'failed'}<p class="alert error small">Last attempt failed{lastCollect.failure_reason ? `: ${lastCollect.failure_reason}` : ''}. Try again or use another number.</p>{/if}
      <label class="field">{t(lang, 'pay_with')} (Airtel Money or TNM Mpamba number)
        <input name="phone" type="tel" inputmode="tel" value={localPhone(data.user?.phone)} required />
      </label>
      {#if b.expires_at}<p class="small muted">Pay within {timeLeft(b.expires_at) ?? 'a few minutes'} to keep this booking.</p>{/if}
      <button class="btn block" disabled={!!busyLabel.v}>{busyLabel.v === 'pay' ? '…' : `${t(lang, 'pay_now')} ${mwk(b.total_mwk)}`}</button>
      <p class="hint">{t(lang, 'pin_prompt')}</p>
    </form>
  {/if}

  {#if can('accept_quote')}
    <form method="POST" action="?/acceptQuote" class="card stack" use:enhance={go('aq')}>
      <h2>Accept {mwk(b.price_mwk)}?</h2>
      {#if b.expires_at}<p class="small muted">Quote valid for {timeLeft(b.expires_at)}.</p>{/if}
      <button class="btn block" disabled={!!busyLabel.v}>Accept quote</button>
    </form>
  {/if}

  {#if can('accept_or_quote')}
    <section class="card stack urgent-card">
      <div class="row between"><h2>New request</h2>{#if b.expires_at}<span class="pill warn">Reply in {timeLeft(b.expires_at)}</span>{/if}</div>
      {#if b.type === 'instant'}
        <form method="POST" action="?/accept" use:enhance={go('accept')}><button class="btn block" disabled={!!busyLabel.v}>Inde · Accept for {mwk(b.price_mwk)}</button></form>
      {:else if !showQuote}
        <button class="btn block" onclick={() => (showQuote = true)}>Send a price</button>
      {/if}
      {#if showQuote && b.type === 'quote'}
        <form method="POST" action="?/quote" class="stack" use:enhance={go('quote')}>
          <label class="field">Your price (MWK)<input name="price" inputmode="numeric" required placeholder="e.g. 25000" /></label>
          <label class="field">Note for the customer <span class="hint">(optional)</span><input name="note" maxlength="400" placeholder="e.g. Includes the new valve" /></label>
          <button class="btn block" disabled={!!busyLabel.v}>Send price</button>
        </form>
      {/if}
      <form method="POST" action="?/decline" use:enhance={go('decline')}><button class="btn ghost block" disabled={!!busyLabel.v}>Ayi · Decline</button></form>
    </section>
  {/if}

  {#if can('start') || can('complete')}
    <section class="card stack">
      {#if can('start')}<form method="POST" action="?/start" use:enhance={go('start')}><button class="btn secondary block" disabled={!!busyLabel.v}>Start job</button></form>{/if}
      {#if can('complete')}<form method="POST" action="?/complete" use:enhance={go('complete')}><button class="btn urgent block" disabled={!!busyLabel.v}>Ndamaliza · Mark job done</button></form>{/if}
    </section>
  {/if}

  {#if can('confirm')}
    <form method="POST" action="?/confirm" class="card stack" use:enhance={go('confirm')}>
      <h2>Is the job done?</h2>
      <p class="small">{b.escrow ? 'Confirming releases the payment to the fundi.' : 'Confirm so you can rate the fundi.'}
        {#if b.auto_confirm_at} If you do nothing, it confirms automatically in {timeLeft(b.auto_confirm_at)}.{/if}</p>
      <button class="btn block" disabled={!!busyLabel.v}>Inde · Yes, confirm</button>
    </form>
  {/if}

  {#if can('review')}
    <form method="POST" action="?/review" class="card stack" use:enhance={go('review')}>
      <h2>Rate {b.provider_name.split(' ')[0]}</h2>
      <fieldset class="stars">
        <legend class="sr-only">Rating</legend>
        {#each [1, 2, 3, 4, 5] as n}
          <label class:on={n <= rating}><input type="radio" name="rating" value={n} bind:group={rating} class="sr-only" /><span aria-hidden="true">★</span><span class="sr-only">{n} stars</span></label>
        {/each}
      </fieldset>
      <label class="field">Comment <span class="hint">(optional)</span><textarea name="text" maxlength="1000"></textarea></label>
      <button class="btn block" disabled={!!busyLabel.v}>Send rating</button>
    </form>
  {/if}

  {#if b.review}
    <section class="card stack" style="--gap:4px">
      <strong>Your rating: {'★'.repeat(b.review.rating)}{'☆'.repeat(5 - b.review.rating)}</strong>
      {#if b.review.text}<p class="small">{b.review.text}</p>{/if}
    </section>
  {/if}

  {#if b.dispute}
    <section class="card stack alert info" style="--gap:6px">
      <strong>Problem reported</strong>
      <p class="small">{b.dispute.reason}</p>
      {#if b.dispute.status === 'open'}<p class="small">Fundi support will call both of you by {dateTime(b.dispute.sla_due_at)}.</p>
      {:else}<p class="small">Resolved: {b.dispute.resolution}{b.dispute.resolution === 'split' ? ` (${b.dispute.provider_share_percent}% to the fundi)` : ''}. {b.dispute.admin_note ?? ''}</p>{/if}
    </section>
  {/if}

  {#if can('dispute')}
    {#if showDispute}
      <form method="POST" action="?/dispute" class="card stack" use:enhance={go('dispute')}>
        <label class="field">What went wrong?<textarea name="reason" minlength="5" maxlength="1000" required></textarea></label>
        <p class="hint">{b.escrow ? 'The money stays held until Fundi support decides.' : ''} Support calls both sides within 72 hours.</p>
        <button class="btn danger block" disabled={!!busyLabel.v}>Report problem</button>
      </form>
    {:else}
      <button class="btn ghost block" onclick={() => (showDispute = true)}><Icon name="alert" size={18} /> Report a problem</button>
    {/if}
  {/if}

  {#if can('cancel')}
    <form method="POST" action="?/cancel" use:enhance={go('cancel')}
      onsubmit={(e) => { if (!confirm('Cancel this booking?')) e.preventDefault(); }}>
      <button class="btn ghost block" disabled={!!busyLabel.v}>{t(lang, 'cancel')} booking</button>
    </form>
  {/if}

  <section class="stack" style="--gap:8px">
    <h2 class="small muted">History</h2>
    <ol class="timeline">
      {#each b.events as e}
        <li><strong>{t(lang, `st_${e.to_status}` as Key)}</strong> <span class="muted">· {dateTime(e.at)}</span>{#if e.note}<br /><span class="muted">{e.note}</span>{/if}</li>
      {/each}
    </ol>
    {#if b.payments.length}
      <ul class="pays small">
        {#each b.payments as p}
          <li class="row between"><span>{p.direction === 'collect' ? 'Payment' : p.direction === 'payout' ? 'Payout' : 'Refund'} · {p.operator === 'airtel' ? 'Airtel Money' : 'TNM Mpamba'}</span><span>{mwk(p.amount_mwk)} · {p.status}</span></li>
        {/each}
      </ul>
    {/if}
  </section>
</div>

<style>
  .desc { background: var(--sunk); padding: 10px 12px; border-radius: 10px; }
  .held { color: var(--gold-ink); }
  .wait { border: 2px solid var(--green); background: var(--green-tint); }
  .urgent-card { border: 2px solid var(--orange); }
  .stars { display: flex; gap: 6px; border: 0; padding: 0; margin: 0; font-size: 36px; }
  .stars label { cursor: pointer; color: var(--line-strong); min-width: 44px; text-align: center; }
  .stars label.on { color: #b7791f; }
  .stars label:focus-within { outline: 3px solid #2563eb; border-radius: 8px; }
  .pays { list-style: none; padding: 0; margin: 0; display: grid; gap: 4px; }
</style>
