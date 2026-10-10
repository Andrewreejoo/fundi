<script lang="ts">
  import { catName, t, type Lang } from '$lib/i18n';
  import { dateLabel, mwk } from '$lib/format';
  import StatusPill from './StatusPill.svelte';

  let { b, lang, as = 'customer' }: { b: any; lang: Lang; as?: 'customer' | 'provider' } = $props();
</script>

<a class="card brow" href={`/bookings/${b.id}`}>
  <div class="row between">
    <strong>{b.listing_title ?? catName(lang, b)}</strong>
    <StatusPill status={b.status} {lang} />
  </div>
  <span class="muted small">
    {as === 'customer' ? b.provider_name : b.customer_name} · {b.ref}
    {#if b.scheduled_for} · {dateLabel(b.scheduled_for)}{/if}{#if b.time_slot} {t(lang, b.time_slot)}{/if}
  </span>
  {#if b.price_mwk}<span class="small">{mwk(b.price_mwk)}{#if b.escrow} · <span class="muted">escrow</span>{/if}</span>{/if}
</a>

<style>
  .brow { display: flex; flex-direction: column; gap: 6px; color: var(--ink); text-decoration: none; }
  .brow:hover { border-color: var(--green); text-decoration: none; }
</style>
