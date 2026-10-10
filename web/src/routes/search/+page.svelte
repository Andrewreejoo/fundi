<script lang="ts">
  import { page } from '$app/state';
  import { t, catName } from '$lib/i18n';
  import ProviderCard from '$lib/components/ProviderCard.svelte';
  import SearchForm from '$lib/components/SearchForm.svelte';

  let { data } = $props();
  const lang = $derived(data.lang ?? 'ny');
  const title = $derived(data.categoryInfo ? catName(lang, data.categoryInfo) : t(lang, 'nav_find'));

  /** Toggle one filter in the current URL. Plain links keep this working without JavaScript. */
  function toggled(key: string) {
    const u = new URL(page.url);
    if (u.searchParams.get(key) === '1') u.searchParams.delete(key);
    else u.searchParams.set(key, '1');
    return u.pathname + u.search;
  }
</script>

<svelte:head><title>{title} · Fundi</title></svelte:head>

<div class="wrap section stack" style="--gap:20px">
  <SearchForm {lang} categories={data.categories} districts={data.districts} category={data.category} placeId={data.placeId} />

  {#if data.result}
    <div class="row between">
      <div>
        <h1 class="page-title">{title}</h1>
        <p class="muted">{data.result.results.length} · {t(lang, 'results_within')} {data.result.radiusKm} km · {data.placeLabel}</p>
      </div>
    </div>
    <nav class="row filters" aria-label="Filters">
      <a class="pill" class:on={data.filters.verifiedOnly} href={toggled('verified')} aria-current={data.filters.verifiedOnly ? "true" : undefined}>{t(lang, 'verified_only')}</a>
      <a class="pill" class:on={data.filters.availableToday} href={toggled('today')} aria-current={data.filters.availableToday ? "true" : undefined}>{t(lang, 'available_today')}</a>
      <a class="pill" class:on={data.filters.homeVisit} href={toggled('home')} aria-current={data.filters.homeVisit ? "true" : undefined}>{t(lang, 'home_visit')}</a>
    </nav>

    {#if data.result.results.length}
      <div class="results">
        {#each data.result.results as p (p.id)}
          <ProviderCard {p} {lang} fileBase={data.fileBase} query={data.locQuery} />
        {/each}
      </div>
    {:else}
      <div class="card empty">
        <strong>{t(lang, 'no_results')}</strong>
        <p>{t(lang, 'no_results_sub')}</p>
      </div>
    {/if}
  {:else if data.error}
    <p class="alert error" role="alert">{data.error}</p>
  {:else}
    <p class="muted">Choose your area to see fundis near you.</p>
  {/if}
</div>

<style>
  .filters { --gap: 8px; }
  .filters .pill { min-height: 40px; padding: 0 14px; border: 1px solid var(--line-strong); background: var(--surface); color: var(--ink); text-decoration: none; font-weight: 400; font-size: 15px; }
  .filters .pill.on { background: var(--green); border-color: var(--green); color: #fff; font-weight: 700; }
  .results { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
  @media (max-width: 400px) { .results { grid-template-columns: 1fr; } }
</style>
