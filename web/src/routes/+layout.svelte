<script lang="ts">
  import '../app.css';
  import { page } from '$app/state';
  import Icon from '$lib/components/Icon.svelte';
  import Plate from '$lib/components/Plate.svelte';

  let { data, children } = $props();
  const user = $derived(data.user);
  const path = $derived(page.url.pathname);
  const tab = $derived(
    path.startsWith('/rent') ? 'rent'
    : path.startsWith('/sell') || path.startsWith('/seller') ? 'sell'
    : path.startsWith('/cars') || path === '/' ? 'buy' : '',
  );
  const q = $derived(page.url.searchParams.get('q') ?? '');
  const isAdmin = $derived(!!user?.roles?.includes('admin'));
</script>

<a class="skip" href="#main">Skip to content</a>
{#if data.demo}
  <div class="demo" role="note">Demo site: sign-in codes appear on screen and payments are simulated, so no real money moves. Admin sign-in: 0999 000 001.</div>
{/if}

<header class="top">
  <div class="wrap bar">
    <a href="/" class="logo" aria-label="Galimoto home"><Plate text="GALIMOTO" size="xl" /></a>
    <form class="search" method="GET" action={tab === 'rent' ? '/rent' : '/cars'} role="search">
      <label class="sr-only" for="q">Search cars</label>
      <input id="q" name="q" type="search" value={q} placeholder="Make, model or stock number, e.g. X-Trail or GM10001" />
      <button class="go" aria-label="Search"><Icon name="search" /></button>
    </form>
    <nav class="me" aria-label="Your account">
      <a href="/favorites" class="icon"><Icon name="heart" /><span>Saved</span>{#if user?.favorites_count}<b>{user.favorites_count}</b>{/if}</a>
      <a href="/compare" class="icon"><Icon name="compare" /><span>Compare</span>{#if data.compareCount}<b>{data.compareCount}</b>{/if}</a>
      {#if user}
        <a href="/messages" class="icon"><Icon name="chat" /><span>Messages</span>{#if user.unread_messages}<b class="hot">{user.unread_messages}</b>{/if}</a>
        <a href="/orders" class="icon"><Icon name="key" /><span>Orders</span></a>
        <a href="/account" class="icon"><Icon name="user" /><span>Account</span></a>
      {:else}
        <a class="btn sm signin" href={`/login?next=${encodeURIComponent(page.url.pathname + page.url.search)}`}>Sign in</a>
      {/if}
    </nav>
  </div>
  <nav class="tabs" aria-label="Main">
    <div class="wrap tabrow">
      <a href="/cars" aria-current={tab === 'buy' ? 'page' : undefined}>Buy a car</a>
      <a href="/rent" aria-current={tab === 'rent' ? 'page' : undefined}>Rent a car</a>
      <a href="/cars?priceDown=true" class="minor">Price down</a>
      <a href="/cars?sort=newest" class="minor">New arrivals</a>
      <span class="spacer"></span>
      {#if isAdmin}<a href="/admin" class="minor">Admin</a>{/if}
      <a href={user?.is_seller ? '/seller' : '/sell'} aria-current={tab === 'sell' ? 'page' : undefined} class="sell">
        {user?.is_seller ? 'Seller dashboard' : 'Sell or hire out your car'}
      </a>
    </div>
  </nav>
</header>

<main id="main">
  {@render children()}
</main>

<footer class="foot">
  <div class="wrap cols">
    <div class="stack" style="--gap:8px">
      <Plate text="GALIMOTO" size="md" />
      <p class="small">Cars already in Malawi, duty paid and ready to drive. Buy from dealers and private sellers, or hire a car by the day.</p>
    </div>
    <div class="stack small" style="--gap:6px">
      <strong>Buy</strong>
      <a href="/cars">All cars for sale</a>
      <a href="/cars?body=suv">SUVs</a>
      <a href="/cars?body=pickup">Pickups</a>
      <a href="/cars?maxPrice=15000000">Under MWK 15 million</a>
    </div>
    <div class="stack small" style="--gap:6px">
      <strong>Rent</strong>
      <a href="/rent">All cars for hire</a>
      <a href="/rent?withDriver=true">With a driver</a>
      <a href="/rent?minSeats=7">7 seats or more</a>
    </div>
    <div class="stack small" style="--gap:6px">
      <strong>Galimoto</strong>
      <a href="/how-it-works">How buying and renting works</a>
      <a href="/sell">Sell or hire out your car</a>
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
    </div>
  </div>
</footer>

<style>
  .skip { position: absolute; left: -999px; top: 8px; background: #fff; padding: 8px 12px; z-index: 20; }
  .skip:focus { left: 8px; }
  .demo { background: var(--hold-tint); color: #5a3b00; border-bottom: 1px solid #f0d698; padding: 6px 16px; font-size: 14px; text-align: center; }
  .top { background: var(--asphalt); color: #fff; }
  .bar { display: flex; align-items: center; gap: 18px; padding-top: 12px; padding-bottom: 12px; flex-wrap: wrap; }
  .logo { flex-shrink: 0; text-decoration: none !important; }
  .search { flex: 1 1 320px; display: flex; min-width: 0; }
  .search input { border: 0; border-radius: var(--radius) 0 0 var(--radius); min-height: 44px; }
  .go { width: 52px; border: 0; border-radius: 0 var(--radius) var(--radius) 0; background: var(--plate); color: var(--plate-ink); cursor: pointer; display: grid; place-items: center; }
  .go:hover { background: #ffd43b; }
  .me { display: flex; align-items: center; gap: 4px; }
  .icon { position: relative; display: flex; flex-direction: column; align-items: center; gap: 1px; color: #d9dde2; font-size: 12px; padding: 4px 8px; min-width: 58px; text-decoration: none !important; }
  .icon:hover { color: #fff; }
  .icon b { position: absolute; top: -2px; right: 10px; background: var(--plate); color: var(--plate-ink); font-size: 11px; border-radius: 9px; padding: 0 5px; line-height: 16px; }
  .icon b.hot { background: #e5533d; color: #fff; }
  .signin { background: var(--plate); color: var(--plate-ink); }
  .signin:hover { background: #ffd43b; color: var(--plate-ink); }
  .tabs { background: var(--asphalt-2); border-top: 1px solid #40464f; }
  .tabrow { display: flex; align-items: stretch; gap: 2px; overflow-x: auto; }
  .tabs a { color: #d9dde2; padding: 11px 14px; font-weight: 600; white-space: nowrap; border-bottom: 3px solid transparent; text-decoration: none; }
  .tabs a:hover { color: #fff; }
  .tabs a[aria-current='page'] { color: #fff; border-bottom-color: var(--plate); }
  .tabs a.minor { font-weight: 500; }
  .spacer { flex: 1; }
  .tabs a.sell { color: var(--plate); }
  main { min-height: 70vh; }
  .foot { background: var(--asphalt); color: #c9ced4; margin-top: 48px; padding: 32px 0 40px; }
  .foot a { color: #e3e6ea; }
  .foot strong { color: #fff; }
  .cols { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr; gap: 24px; }
  @media (max-width: 760px) {
    .bar { gap: 10px; }
    .search { order: 3; flex-basis: 100%; }
    .me { margin-left: auto; }
    .icon { min-width: 0; padding: 4px 5px; }
    .icon span { display: none; }
    .cols { grid-template-columns: 1fr 1fr; }
  }
</style>
