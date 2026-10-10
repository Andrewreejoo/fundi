<script lang="ts">
  import { t, catName, type Lang } from '$lib/i18n';
  import Icon from './Icon.svelte';

  let {
    lang, categories, districts, category = '', placeId = '', compact = false,
  }: { lang: Lang; categories: any[]; districts: Record<string, any[]>; category?: string; placeId?: string | number; compact?: boolean } = $props();

  let locating = $state(false);
  let locError = $state('');
  let lat = $state('');
  let lng = $state('');
  let form: HTMLFormElement;

  /** Optional GPS; the area list always works without it. */
  function useLocation() {
    if (!navigator.geolocation) { locError = 'Location is not available on this device'; return; }
    locating = true; locError = '';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        lat = pos.coords.latitude.toFixed(5);
        lng = pos.coords.longitude.toFixed(5);
        locating = false;
        queueMicrotask(() => form.requestSubmit());
      },
      () => { locating = false; locError = 'Could not get your location. Choose your area instead.'; },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  }
</script>

<form method="GET" action="/search" class="sf card" class:compact bind:this={form}>
  <label class="field grow">
    <span>{t(lang, 'what_need')}</span>
    <select name="category" value={category}>
      <option value="">{t(lang, 'any_trade')}</option>
      {#each categories as c}<option value={c.slug}>{catName(lang, c)}{lang === 'ny' ? ` · ${c.name_en}` : ''}</option>{/each}
    </select>
  </label>
  <label class="field grow">
    <span>{t(lang, 'where')}</span>
    <select name="place" value={lat ? '' : String(placeId)} required={!lat}>
      <option value="" disabled>Choose your area</option>
      {#each Object.entries(districts) as [d, list]}
        <optgroup label={d}>{#each list as p}<option value={p.id}>{p.name}, {d}</option>{/each}</optgroup>
      {/each}
    </select>
  </label>
  {#if lat}<input type="hidden" name="lat" value={lat} /><input type="hidden" name="lng" value={lng} />{/if}
  <div class="actions">
    <button class="btn" type="submit"><Icon name="search" size={20} /> {t(lang, 'search')}</button>
    <button class="btn ghost" type="button" onclick={useLocation} disabled={locating}>
      <Icon name="pin" size={20} /> {locating ? '…' : t(lang, 'use_my_location')}
    </button>
  </div>
  {#if locError}<p class="alert info small" role="status">{locError}</p>{/if}
</form>

<style>
  .sf { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 16px; }
  .actions { grid-column: 1 / -1; display: flex; gap: 10px; flex-wrap: wrap; }
  .actions .btn:first-child { flex: 1 1 160px; }
  .alert { grid-column: 1 / -1; }
  @media (max-width: 640px) { .sf { grid-template-columns: 1fr; } }
</style>
