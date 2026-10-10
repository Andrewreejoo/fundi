<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { onDestroy } from 'svelte';
  import { carTitle, dateLabel, dateTime, localPhone, mwk, STATUS_LABEL, timeLeft, whatsapp } from '$lib/format';
  import CarPhoto from '$lib/components/CarPhoto.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import Plate from '$lib/components/Plate.svelte';
  import StatusPill from '$lib/components/StatusPill.svelte';

  let { data, form } = $props();
  const o = $derived(data.order);
  const can = (a: string) => o.actions.includes(a);
  const res = $derived(o.kind === 'reservation');
  const pending = $derived(o.payments.find((p: any) => p.direction === 'collect' && p.status === 'pending'));
  const lastCollect = $derived([...o.payments].reverse().find((p: any) => p.direction === 'collect'));
  const other = $derived(o.role === 'buyer' ? { name: o.seller_name, phone: o.seller_phone } : { name: o.buyer_name, phone: o.buyer_phone });
  const masked = $derived(other.phone?.includes('xxx'));

  // While the wallet PIN prompt is on the buyer's phone, re-check every 4 seconds.
  let timer: ReturnType<typeof setInterval> | undefined;
  $effect(() => {
    if (pending && !timer) timer = setInterval(() => invalidateAll(), 4000);
    if (!pending && timer) { clearInterval(timer); timer = undefined; }
  });
  onDestroy(() => timer && clearInterval(timer));

  let busy = $state('');
  const go = (label: string) => () => { busy = label; return async ({ update }: any) => { await update({ reset: false }); busy = ''; }; };
  let showDispute = $state(false);
  const confirmFirst = (msg: string) => (e: SubmitEvent) => { if (!confirm(msg)) e.preventDefault(); };
</script>

<svelte:head><title>Order {o.ref} · GalimotoYanga</title></svelte:head>

<div class="narrow page stack" style="--gap:14px">
  <div class="row between small">
    <a href={o.role === 'seller' ? '/orders?as=seller' : '/orders'}><Icon name="back" size={15} /> All orders</a>
    <span class="row" style="--gap:6px">Order <Plate text={o.ref} size="sm" /></span>
  </div>

  {#if form?.error}<p class="alert error" role="alert">{form.error}</p>{/if}

  <header class="panel head">
    <a href={`/cars/${o.stock_no}`} class="ph"><CarPhoto id={o.photo_id} fileBase={data.fileBase} body={o.body_type} color={o.color} alt={carTitle(o)} /></a>
    <div class="stack" style="--gap:6px">
      <div class="row" style="--gap:8px"><h1>{carTitle(o)}</h1><StatusPill status={o.status} /></div>
      <span class="muted">{o.variant ?? ''} <Plate text={o.stock_no} size="sm" /></span>
      <span>{res ? 'Reservation with refundable deposit' : `Rental: ${dateLabel(o.start_date)} to ${dateLabel(o.end_date)}, ${o.days} ${o.days === 1 ? 'day' : 'days'}${o.with_driver ? ', with driver' : ''}`}</span>
      <span class="small muted"><Icon name="pin" size={14} /> {o.seller_address ? `${o.seller_address}, ` : ''}{o.seller_area}, {o.seller_district}</span>
    </div>
  </header>

  <!-- Money -->
  <section class="panel money">
    {#if res}
      <div class="row between"><span>Car price</span><span class="price">{mwk(o.price_mwk)}</span></div>
      <div class="row between"><span>Deposit paid through GalimotoYanga</span><span class="price">{mwk(o.amount_mwk)}</span></div>
      <div class="row between strong"><span>{o.role === 'seller' ? 'Buyer pays you at handover' : 'Balance to pay the seller when you buy'}</span><span class="price">{mwk(o.balance_due_mwk)}</span></div>
    {:else}
      <div class="row between"><span>{mwk(o.daily_rate_mwk)} per day{o.with_driver ? ` + ${mwk(o.driver_rate_mwk)} driver` : ''} × {o.days}</span><span class="price">{mwk(o.amount_mwk)}</span></div>
    {/if}
    {#if o.role === 'seller'}
      <div class="row between muted small"><span>GalimotoYanga fee</span><span>−{mwk(o.fee_mwk)}</span></div>
      <div class="row between strong"><span>You receive from GalimotoYanga</span><span class="price">{mwk(o.seller_net_mwk)}</span></div>
    {/if}
    <p class="small held">
      <Icon name="shield" size={16} />
      {#if ['reserved', 'confirmed', 'handed_over', 'returned', 'disputed'].includes(o.status)}The money is held by GalimotoYanga until the {res ? 'sale' : 'rental'} is complete.
      {:else if o.status === 'completed'}Paid out to the seller.
      {:else if o.status === 'refunded'}Refunded to the buyer.
      {:else if o.status === 'pending_payment'}Nothing is charged until you approve the payment on your phone.
      {:else}No money was taken.{/if}
    </p>
  </section>

  <!-- What to do next -->
  {#if pending}
    <section class="panel wait" aria-live="polite">
      <strong>Waiting for you to approve the payment…</strong>
      <p class="small">Check your phone for the {pending.operator === 'airtel' ? 'Airtel Money' : 'TNM Mpamba'} prompt and enter your PIN. This page updates by itself.</p>
    </section>
  {:else if can('pay')}
    <form method="POST" action="?/pay" class="panel stack" use:enhance={go('pay')}>
      <h2>Pay {mwk(o.amount_mwk)}</h2>
      {#if lastCollect?.status === 'failed'}<p class="alert error small">The last attempt failed{lastCollect.failure_reason ? `: ${lastCollect.failure_reason}` : ''}. Try again or use another number.</p>{/if}
      <label class="field">Airtel Money or TNM Mpamba number
        <input name="phone" type="tel" inputmode="tel" value={localPhone(data.user?.phone)} required />
      </label>
      {#if timeLeft(o.expires_at)}<p class="small muted">Pay within {timeLeft(o.expires_at)} or the {res ? 'reservation' : 'booking'} is released.</p>{/if}
      <button class="btn lg block" disabled={!!busy}>{busy === 'pay' ? 'Sending request…' : `Pay ${mwk(o.amount_mwk)}`}</button>
      <p class="tiny muted">You will get a PIN prompt from your wallet. GalimotoYanga never sees your PIN.</p>
    </form>
  {/if}

  {#if o.status === 'reserved' && o.role === 'buyer'}
    <section class="panel stack small" style="--gap:6px">
      <strong>The car is held for you{#if timeLeft(o.expires_at)} for {timeLeft(o.expires_at)}{/if}.</strong>
      <span>Visit the seller, inspect and test-drive the car. When you buy it, pay the balance to the seller and confirm below.</span>
    </section>
  {/if}
  {#if o.status === 'reserved' && o.role === 'seller'}
    <section class="panel small">Your car is reserved{#if timeLeft(o.expires_at)} for {timeLeft(o.expires_at)}{/if}. Arrange a viewing with the buyer. When they take the car, mark it handed over.</section>
  {/if}

  {#if can('complete') || can('handover')}
    <section class="panel stack">
      {#if can('complete')}
        <form method="POST" action="?/complete" use:enhance={go('complete')}
          onsubmit={confirmFirst(res ? 'Confirm you have bought the car? The deposit will be paid to the seller.' : 'Confirm the rental went well? Payment will be released to the owner.')}>
          <button class="btn lg block" disabled={!!busy}>{res ? 'I bought the car' : 'Rental went well, release payment'}</button>
        </form>
        {#if o.auto_complete_at && timeLeft(o.auto_complete_at)}<p class="small muted">If you do nothing, this completes automatically in {timeLeft(o.auto_complete_at)}.</p>{/if}
      {/if}
      {#if can('handover')}
        <form method="POST" action="?/handover" use:enhance={go('handover')}
          onsubmit={confirmFirst(res ? 'Has the buyer taken the car and paid you the balance?' : 'Has the car been returned?')}>
          <button class="btn lg block dark" disabled={!!busy}>{res ? 'Buyer has taken the car' : 'Car has been returned'}</button>
        </form>
      {/if}
    </section>
  {/if}

  {#if other.phone && o.role !== 'admin'}
    <section class="panel row between">
      <div><div class="tiny muted">{o.role === 'buyer' ? 'Seller' : 'Buyer'}</div><strong>{other.name}</strong></div>
      {#if masked}
        <span class="small muted">{localPhone(other.phone)}: shown after payment</span>
      {:else}
        <div class="row" style="--gap:6px">
          <a class="btn dark sm" href={`tel:${other.phone}`}><Icon name="phone" size={16} /> {localPhone(other.phone)}</a>
          <a class="btn plain sm" href={whatsapp(other.phone, `Hello, about GalimotoYanga order ${o.ref} (${carTitle(o)}).`)} target="_blank" rel="noopener"><Icon name="whatsapp" size={16} /> WhatsApp</a>
        </div>
      {/if}
    </section>
  {/if}

  {#if o.dispute}
    <section class="alert info stack" style="--gap:4px">
      <strong>Problem reported</strong>
      <span class="small">{o.dispute.reason}</span>
      {#if o.dispute.status === 'open'}<span class="small">GalimotoYanga support will contact both of you by {dateTime(o.dispute.sla_due_at)}. The money stays held until then.</span>
      {:else}<span class="small">Decision: {o.dispute.resolution}{o.dispute.resolution === 'split' ? ` (${o.dispute.seller_share_percent}% to the seller)` : ''}. {o.dispute.admin_note ?? ''}</span>{/if}
    </section>
  {/if}

  {#if can('dispute')}
    {#if showDispute}
      <form method="POST" action="?/dispute" class="panel stack" use:enhance={go('dispute')}>
        <label class="field">What went wrong?<textarea name="reason" minlength="5" maxlength="1000" required placeholder={res ? 'e.g. The mileage is not as advertised' : 'e.g. The car was not available on the pick-up day'}></textarea></label>
        <button class="btn danger block" disabled={!!busy}>Report problem</button>
        <span class="tiny muted">The money stays held while GalimotoYanga support looks into it.</span>
      </form>
    {:else}
      <button class="btn plain block" onclick={() => (showDispute = true)}><Icon name="alert" size={17} /> Report a problem</button>
    {/if}
  {/if}

  {#if can('cancel')}
    <form method="POST" action="?/cancel" use:enhance={go('cancel')} onsubmit={confirmFirst('Cancel this order?' + (o.status !== 'pending_payment' ? ' The buyer will be refunded in full.' : ''))}>
      <button class="btn plain block" disabled={!!busy}>Cancel {res ? 'reservation' : 'booking'}</button>
    </form>
  {/if}

  <section class="stack" style="--gap:8px">
    <h2 class="small muted">History</h2>
    <ol class="timeline">
      {#each o.events as e}<li><strong>{STATUS_LABEL[e.to_status] ?? e.to_status}</strong> <span class="muted">{dateTime(e.at)}</span>{#if e.note}<br /><span class="muted">{e.note}</span>{/if}</li>{/each}
    </ol>
    {#each o.payments as p}
      <div class="row between small muted">
        <span>{p.direction === 'collect' ? 'Payment' : p.direction === 'payout' ? 'Payout' : 'Refund'}, {p.operator === 'airtel' ? 'Airtel Money' : 'TNM Mpamba'}</span>
        <span>{mwk(p.amount_mwk)}, {p.status}</span>
      </div>
    {/each}
  </section>
</div>

<style>
  .head { display: grid; grid-template-columns: 160px minmax(0, 1fr); gap: 14px; align-items: start; }
  .head h1 { font-family: var(--font-cond); font-size: 28px; }
  .ph { border-radius: 4px; overflow: hidden; }
  .money { display: flex; flex-direction: column; gap: 6px; }
  .money .price { font-size: 19px; }
  .strong { font-weight: 700; }
  .held { display: flex; gap: 6px; align-items: flex-start; color: var(--hold); margin-top: 4px; }
  .wait { border: 2px solid var(--go); background: var(--go-tint); }
  @media (max-width: 520px) { .head { grid-template-columns: 1fr; } }
</style>
