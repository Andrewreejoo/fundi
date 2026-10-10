<script lang="ts">
  import { dateTime, mwk } from '$lib/format';
  let { data } = $props();
  const o = $derived(data.overview);
  const tiles = $derived([
    ['Completed jobs', o.completed_jobs, `last ${data.days} days`],
    ['GMV', mwk(o.gmv_mwk), 'confirmed jobs'],
    ['Held in escrow now', mwk(o.escrow_held_mwk), o.oldest_escrow_at ? `oldest since ${dateTime(o.oldest_escrow_at)}` : 'nothing held'],
    ['Fee revenue (all time)', mwk(o.fee_revenue_mwk), 'protection fees + commission'],
    ['Payment success', o.payment_success_pct == null ? 'n/a' : `${o.payment_success_pct}%`, `last ${data.days} days`],
    ['New bookings', o.new_bookings, `${o.new_users} new users`],
  ]);
  const queues = $derived([
    ['/admin/verifications', 'IDs to verify', o.pending_verifications, 'SLA 24 h'],
    ['/admin/listings', 'Listings to review', o.pending_listings, ''],
    ['/admin/disputes', 'Open disputes', o.open_disputes, 'SLA 72 h'],
    ['/admin/payments?status=failed', 'Failed payouts', o.failed_payouts, 'retry or check number'],
  ]);
</script>

<svelte:head><title>Admin · Fundi</title></svelte:head>

<div class="row between">
  <h1 class="page-title">Overview</h1>
  <nav class="row" style="--gap:6px" aria-label="Period">
    {#each [1, 7, 30, 90] as d}<a class="btn small {d === data.days ? '' : 'ghost'}" href={`/admin?days=${d}`}>{d === 1 ? 'Today' : `${d} days`}</a>{/each}
  </nav>
</div>

<div class="tiles">
  {#each tiles as [label, value, sub]}
    <div class="card tile"><span class="muted small">{label}</span><strong>{value}</strong><span class="muted tiny">{sub}</span></div>
  {/each}
</div>

<div class="tiles">
  {#each queues as [href, label, n, sub]}
    <a class="card tile queue" class:hot={Number(n) > 0} {href}><span class="small">{label}</span><strong>{n}</strong><span class="muted tiny">{sub}</span></a>
  {/each}
</div>

<div class="cols">
  <section class="card stack">
    <h2>Providers by district</h2>
    <div class="scroll-x">
      <table class="data">
        <thead><tr><th>District</th><th>Providers</th><th>Completed jobs</th></tr></thead>
        <tbody>{#each o.byDistrict as r}<tr><td>{r.district}</td><td>{r.providers}</td><td>{r.completed_jobs}</td></tr>{/each}</tbody>
      </table>
    </div>
  </section>
  <section class="card stack">
    <h2>Ledger balances</h2>
    <p class="muted small">Double-entry; the sum of all accounts must be zero.</p>
    <table class="data">
      <tbody>
        {#each data.ledger as r}<tr><td>{r.account}</td><td style="text-align:right">{mwk(r.balance)}</td></tr>{/each}
        <tr><td class="bold">Sum</td><td class="bold" style="text-align:right">{mwk(data.ledger.reduce((s: number, r: any) => s + Number(r.balance), 0))}</td></tr>
      </tbody>
    </table>
  </section>
</div>

<style>
  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
  .tile { display: flex; flex-direction: column; gap: 4px; }
  .tile strong { font-size: 26px; }
  .queue { color: var(--ink); text-decoration: none; }
  .queue.hot { border: 2px solid var(--orange); }
  .cols { display: flex; flex-wrap: wrap; gap: 16px; }
  .cols > * { flex: 1 1 320px; min-width: 0; }
</style>
