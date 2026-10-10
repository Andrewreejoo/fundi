<script lang="ts">
  import '../app.css';
  import { page } from '$app/state';
  import { t } from '$lib/i18n';
  import Icon from '$lib/components/Icon.svelte';

  let { data, children } = $props();
  const lang = $derived(data.lang ?? 'ny');
  const user = $derived(data.user);
  const isProvider = $derived(!!user?.roles?.includes('provider'));
  const isAdmin = $derived(!!user?.roles?.includes('admin'));
</script>

<a class="skip" href="#main">Skip to content</a>
<header class="site">
  <div class="wrap row between bar">
    <a href="/" class="logo" aria-label="Fundi home">fundi</a>
    <nav aria-label="Main" class="row nav">
      <a href="/search" class="hide-sm">{t(lang, 'nav_find')}</a>
      {#if user}
        <a href="/bookings">{t(lang, 'nav_bookings')}</a>
        {#if isProvider}<a href="/provider">{t(lang, 'nav_provider')}</a>{:else}<a href="/become-a-fundi" class="hide-sm">{t(lang, 'nav_become')}</a>{/if}
        {#if isAdmin}<a href="/admin">{t(lang, 'nav_admin')}</a>{/if}
        <a href="/account" aria-label={t(lang, 'nav_account')} class="icon-link"><Icon name="user" /></a>
      {:else}
        <a href="/become-a-fundi" class="hide-sm">{t(lang, 'nav_become')}</a>
        <a class="btn secondary small" href={`/login?next=${encodeURIComponent(page.url.pathname + page.url.search)}`}>{t(lang, 'nav_signin')}</a>
      {/if}
      <form method="POST" action="/lang" class="lang">
        <input type="hidden" name="next" value={page.url.pathname + page.url.search} />
        <button class="btn ghost small" name="lang" value={lang === 'ny' ? 'en' : 'ny'} title="Change language">
          {lang === 'ny' ? 'English' : 'Chichewa'}
        </button>
      </form>
    </nav>
  </div>
</header>

<main id="main">
  {@render children()}
</main>

<footer class="site-footer">
  <div class="wrap row between">
    <span>Fundi Malawi</span>
    <span class="row" style="--gap: 16px">
      <a href="/become-a-fundi">{t(lang, 'nav_become')}</a>
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
    </span>
  </div>
</footer>

<style>
  .skip { position: absolute; left: -999px; top: 8px; background: #fff; padding: 8px 12px; border-radius: 8px; z-index: 10; }
  .skip:focus { left: 8px; }
  header.site { background: var(--surface); border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 5; }
  .bar { min-height: 64px; }
  .logo { font-size: 28px; font-weight: 700; color: var(--green); letter-spacing: -0.5px; text-decoration: none; }
  .nav { --gap: 16px; font-size: 15px; }
  .nav a:not(.btn) { color: var(--ink); }
  .icon-link { display: inline-grid; place-items: center; width: 44px; height: 44px; border-radius: 22px; background: var(--sunk); }
  .lang { margin: 0; }
  main { min-height: 70vh; }
  .site-footer { border-top: 1px solid var(--line); padding: 24px 0; margin-top: 48px; font-size: 14px; color: var(--muted); }
  @media (max-width: 640px) {
    .hide-sm { display: none; }
    .nav { --gap: 10px; }
  }
</style>
