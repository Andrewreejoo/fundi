<script lang="ts">
  import { enhance } from '$app/forms';
  import { dateTime, localPhone, mwk } from '$lib/format';
  let { data, form } = $props();
  const ACCOUNT: Record<string, string> = {
    cash: 'Cash with payment provider', escrow: 'Held for open orders', seller_payable: 'Owed to sellers',
    buyer_refundable: 'Owed back to buyers', fee_revenue: 'Galimoto fees',
  };
  const total = $derived(data.ledger.reduce((s: number, a: any) => s + Number(a.balance), 0));
</script>

<svelte:head><title>Payments · Admin · Galimoto</title></svelte:head>

<h1>Money</h1>
<section class="panel stack" style="--gap:6px">
  <h2>Ledger balances</h2>
  {#each data.ledger as a}<div class="row between small"><span>{ACCOUNT[a.account] ?? a.account}</span><span class="price">{mwk(Math.abs(Number(a.balance)))}</span></div>{/each}
  <span class="tiny" class:bad={total !== 0}>{total === 0 ? 'Books balance: every entry has a matching opposite entry.' : `Books are off by ${mwk(total)}. Investigate.`}</span>
</section>

<div class="row between"><h2>Payments</h2>
  <nav class="filters" aria-label="Status">{#each [['', 'All'], ['pending', 'Pending'], ['failed', 'Failed'], ['success', 'Successful']] as [k, l]}<a href={k ? `?status=${k}` : '?'} aria-current={data.status === k ? 'page' : undefined}>{l}</a>{/each}</nav>
</div>
{#if form?.error}<p class="alert error">{form.error}</p>{/if}
<div class="tablewrap"><table>
  <thead><tr><th>Order</th><th>Type</th><th>Wallet</th><th>Amount</th><th>Status</th><th>Tries</th><th>Updated</th><th></th></tr></thead>
  <tbody>
    {#each data.list as p (p.id)}
      <tr>
        <td><a href={`/orders/${p.order_id}`}>{p.ref}</a></td>
        <td>{p.direction === 'collect' ? 'Payment in' : p.direction === 'payout' ? 'Payout' : 'Refund'}</td>
        <td>{p.operator === 'airtel' ? 'Airtel' : 'TNM'} {localPhone(p.msisdn)}</td>
        <td>{mwk(p.amount_mwk)}</td>
        <td>{p.status}{#if p.failure_reason}<br /><span class="tiny muted">{p.failure_reason}</span>{/if}</td>
        <td>{p.attempts}</td><td>{dateTime(p.updated_at)}</td>
        <td>{#if p.status === 'failed' && p.direction !== 'collect'}<form method="POST" action="?/retry" use:enhance><input type="hidden" name="id" value={p.id} /><button class="btn sm">Retry</button></form>{/if}</td>
      </tr>
    {/each}
  </tbody>
</table></div>

<style>.bad { color: var(--drop); font-weight: 700; }</style>
