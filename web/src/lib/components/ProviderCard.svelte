<script lang="ts">
  import { t, type Lang } from '$lib/i18n';
  import { mwk, initials } from '$lib/format';
  import Badge from './Badge.svelte';
  import Icon from './Icon.svelte';

  let { p, lang, fileBase, query = '' }: { p: any; lang: Lang; fileBase: string; query?: string } = $props();
  const href = $derived(`/fundi/${p.id}${query}`);
</script>

<article class="card pc">
  <a {href} class="top">
    <div class="avatar" style="width:56px;height:56px;font-size:20px">
      {#if p.avatar_file_id}<img src={`${fileBase}/files/${p.avatar_file_id}`} alt="" loading="lazy" />{:else}{initials(p.display_name)}{/if}
    </div>
    <div class="stack" style="--gap:3px; flex:1; min-width:0">
      <div class="row between"><h3>{p.display_name}</h3>{#if p.distance_km != null}<span class="muted small">{p.distance_km} km</span>{/if}</div>
      <span class="muted small">
        {#if p.rating_count > 0}<span class="star"><Icon name="star" size={14} /></span> {p.rating} ({p.rating_count} {t(lang, 'reviews')}){:else}{t(lang, 'new_fundi')}{/if}
        · {p.area}
      </span>
      <div class="row" style="--gap:6px"><Badge level={p.verification_level} {lang} />{#if p.available_today}<span class="pill good">{t(lang, 'available_today')}</span>{/if}</div>
    </div>
  </a>
  <div class="row between">
    <span>{#if p.from_price_mwk}{t(lang, 'from_price')} <strong>{mwk(p.from_price_mwk)}</strong>{:else}{t(lang, 'ask_quote')}{/if}</span>
    <a class="btn small" href={href}>{t(lang, 'view')}</a>
  </div>
</article>

<style>
  .pc { display: flex; flex-direction: column; gap: 12px; }
  .top { display: flex; gap: 12px; color: var(--ink); text-decoration: none; }
  h3 { font-size: 18px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .star { color: #b7791f; display: inline-flex; vertical-align: -2px; }
</style>
