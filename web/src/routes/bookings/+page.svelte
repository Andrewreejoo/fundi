<script lang="ts">
  import { t } from '$lib/i18n';
  import BookingRow from '$lib/components/BookingRow.svelte';

  let { data } = $props();
  const lang = $derived(data.lang ?? 'ny');
</script>

<svelte:head><title>{t(lang, 'nav_bookings')} · Fundi</title></svelte:head>

<div class="narrow section stack" style="--gap:16px">
  <h1 class="page-title">{t(lang, 'nav_bookings')}</h1>
  <nav class="tabs" aria-label="Booking filter">
    <a href="/bookings" aria-current={data.scope === 'active' ? 'page' : undefined}>Active</a>
    <a href="/bookings?scope=past" aria-current={data.scope === 'past' ? 'page' : undefined}>Past</a>
  </nav>
  {#each data.bookings as b (b.id)}
    <BookingRow {b} {lang} />
  {:else}
    <div class="card empty">
      <p>No {data.scope} bookings.</p>
      <a class="btn" href="/search">{t(lang, 'nav_find')}</a>
    </div>
  {/each}
</div>

<style>
  .tabs { display: grid; grid-template-columns: 1fr 1fr; background: var(--sunk); border-radius: 12px; padding: 4px; }
  .tabs a { text-align: center; padding: 10px; border-radius: 9px; color: var(--muted); text-decoration: none; }
  .tabs a[aria-current='page'] { background: var(--surface); color: var(--ink); font-weight: 700; }
</style>
