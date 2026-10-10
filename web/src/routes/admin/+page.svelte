<script lang="ts">
  import { mwk } from '$lib/format';
  let { data } = $props();
  const o = $derived(data.o);
  const todo = $derived([
    { n: o.pending_listings, label: 'listings to check', href: '/admin/listings' },
    { n: o.unverified_dealers, label: 'dealers to verify', href: '/admin/sellers' },
    { n: o.open_disputes, label: 'open problems', href: '/admin/orders' },
    { n: o.failed_payouts, label: 'failed payouts or refunds', href: '/admin/payments?status=failed' },
  ]);
  const maxMake = $derived(Math.max(1, ...o.byMake.map((m: any) => Number(m.sale) + Number(m.rent))));
</script>

<svelte:head><title>Admin · Galimoto</title></svelte:head>

<div class="row between">
  <h1>Overview</h1>
  <nav class="filters" aria-label="Period">
    {#each [7, 30, 90] as d}<a href={`/admin?days=${d}`} aria-current={o.days === d ? 'page' : undefined}>Last {d} days</a>{/each}
  </nav>
</div>

<section class="todo">
  {#each todo as t}
    <a href={t.href} class="panel" class:hot={Number(t.n) > 0}><b>{t.n}</b> {t.label}</a>
  {/each}
</section>

<section class="kpis">
  <div class="panel"><b>{o.live_for_sale}</b><span>Cars for sale</span></div>
  <div class="panel"><b>{o.live_for_rent}</b><span>Cars for hire</span></div>
  <div class="panel"><b>{o.sellers}</b><span>Sellers</span></div>
  <div class="panel"><b>{o.new_listings}</b><span>New listings</span></div>
  <div class="panel"><b>{o.inquiries}</b><span>Enquiries</span></div>
  <div class="panel"><b>{o.reservations}</b><span>Paid reservations</span></div>
  <div class="panel"><b>{o.rentals}</b><span>Paid rentals</span></div>
  <div class="panel"><b>{o.sold}</b><span>Marked sold</span></div>
  <div class="panel"><b>{o.new_users}</b><span>New users</span></div>
  <div class="panel"><b>{o.payment_success_pct ?? '–'}%</b><span>Payments approved</span></div>
  <div class="panel"><b>{mwk(o.escrow_held_mwk)}</b><span>Held in escrow now</span></div>
  <div class="panel"><b>{mwk(o.fee_revenue_mwk)}</b><span>Fee revenue, all time</span></div>
</section>

<div class="grid2">
  <section class="panel stack" style="--gap:8px">
    <h2>Live stock by make</h2>
    {#each o.byMake as m}
      <div class="bar"><span>{m.name}</span><span class="track"><i style={`width:${(Number(m.sale) / maxMake) * 100}%`}></i><i class="rent" style={`width:${(Number(m.rent) / maxMake) * 100}%`}></i></span><span class="tiny muted">{m.sale} sale, {m.rent} hire</span></div>
    {/each}
  </section>
  <section class="panel stack" style="--gap:8px">
    <h2>Live stock by district</h2>
    <div class="tablewrap"><table><tbody>{#each o.byDistrict as d}<tr><td>{d.district}</td><td>{d.listings}</td></tr>{/each}</tbody></table></div>
  </section>
</div>

<style>
  .todo { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
  .todo a { color: var(--ink); text-decoration: none; }
  .todo a.hot { border-color: var(--plate); background: #fffbe8; }
  .todo b { font-family: var(--font-cond); font-size: 28px; display: block; }
  .kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
  .kpis div { display: flex; flex-direction: column; gap: 2px; }
  .kpis b { font-family: var(--font-cond); font-size: 24px; }
  .kpis span { font-size: 13px; color: var(--muted); }
  .bar { display: grid; grid-template-columns: 110px 1fr 110px; gap: 8px; align-items: center; font-size: 14px; }
  .track { display: flex; height: 12px; background: var(--sunk); border-radius: 3px; overflow: hidden; }
  .track i { background: var(--asphalt); }
  .track i.rent { background: var(--plate); }
  @media (max-width: 700px) { .todo, .kpis { grid-template-columns: 1fr 1fr; } }
</style>
