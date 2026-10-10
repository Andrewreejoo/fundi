<script lang="ts">
  import { enhance } from '$app/forms';
  import { dateLabel, dateTime, localPhone, mwk, STATUS_LABEL, timeLeft } from '$lib/format';
  import Plate from '$lib/components/Plate.svelte';
  import StatusPill from '$lib/components/StatusPill.svelte';
  let { data, form } = $props();
  const STATUSES = ['', 'pending_payment', 'reserved', 'confirmed', 'handed_over', 'returned', 'disputed', 'completed', 'refunded', 'cancelled', 'expired'];
  let choice = $state<Record<string, string>>({});
</script>

<svelte:head><title>Orders · Admin · Galimoto</title></svelte:head>

<h1>Problems reported</h1>
{#if form?.error}<p class="alert error">{form.error}</p>{/if}
{#each data.disputes as d (d.id)}
  <article class="panel stack" style="--gap:8px">
    <div class="row between">
      <span class="row" style="--gap:8px"><Plate text={d.ref} size="sm" /> <strong>{d.car}</strong> <Plate text={d.stock_no} size="sm" /></span>
      <span class="small" class:late={!timeLeft(d.sla_due_at)}>Respond by {dateTime(d.sla_due_at)}</span>
    </div>
    <span class="small">{d.kind === 'reservation' ? `Reservation, deposit ${mwk(d.amount_mwk)} on a ${mwk(d.price_mwk)} car` : `Rental ${dateLabel(d.start_date)} to ${dateLabel(d.end_date)}, ${mwk(d.amount_mwk)}`}</span>
    <span class="small">Buyer {d.buyer_name} {localPhone(d.buyer_phone)} · Seller {d.seller_name} {localPhone(d.seller_phone)} · Reported by {localPhone(d.opened_by_phone)}</span>
    <blockquote>{d.reason}</blockquote>
    <form method="POST" action="?/resolve" class="row" style="--gap:8px; align-items:flex-end" use:enhance>
      <input type="hidden" name="id" value={d.id} />
      <label class="field">Decision
        <select name="resolution" bind:value={choice[d.id]} required>
          <option value="" disabled selected>Choose</option>
          <option value="release">Pay the seller in full</option>
          <option value="refund">Refund the buyer in full</option>
          <option value="split">Split</option>
        </select>
      </label>
      {#if choice[d.id] === 'split'}<label class="field">% to seller<input name="share" type="number" min="1" max="99" value="50" style="width:90px" /></label>{/if}
      <label class="field grow">Note to both<input name="note" maxlength="1000" /></label>
      <button class="btn sm">Resolve</button>
    </form>
  </article>
{:else}
  <p class="panel muted">No open problems.</p>
{/each}

<div class="row between"><h1>All orders</h1>
  <form method="GET"><select name="status" value={data.status} onchange={(e) => (e.currentTarget as HTMLSelectElement).form?.submit()} aria-label="Status">
    {#each STATUSES as s}<option value={s}>{s ? STATUS_LABEL[s] : 'All statuses'}</option>{/each}</select></form>
</div>
<div class="tablewrap"><table>
  <thead><tr><th>Ref</th><th>Car</th><th>Type</th><th>Amount</th><th>Seller</th><th>Buyer</th><th>Status</th><th>Created</th></tr></thead>
  <tbody>
    {#each data.orders as o (o.id)}
      <tr><td><a href={`/orders/${o.id}`}>{o.ref}</a></td><td>{o.car}<br /><span class="tiny muted">{o.stock_no}</span></td>
        <td>{o.kind === 'reservation' ? 'Reservation' : `Rental ${dateLabel(o.start_date)}–${dateLabel(o.end_date)}`}</td>
        <td>{mwk(o.amount_mwk)}</td><td>{o.seller_name}</td><td>{localPhone(o.buyer_phone)}</td><td><StatusPill status={o.status} /></td><td>{dateTime(o.created_at)}</td></tr>
    {/each}
  </tbody>
</table></div>

<style>
  blockquote { margin: 0; padding: 8px 12px; background: var(--sunk); border-left: 3px solid var(--drop); }
  .late { color: var(--drop); font-weight: 700; }
  .grow { flex: 1; min-width: 180px; }
</style>
