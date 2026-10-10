<script lang="ts">
  import { t, catName } from '$lib/i18n';
  import { mwk, initials, dateLabel } from '$lib/format';
  import Badge from '$lib/components/Badge.svelte';
  import Icon from '$lib/components/Icon.svelte';

  let { data } = $props();
  const lang = $derived(data.lang ?? 'ny');
  const p = $derived(data.provider);
  const photos = $derived(p.listings.flatMap((l: any) => l.photo_ids ?? []).slice(0, 6));
</script>

<svelte:head>
  <title>{p.display_name} · Fundi</title>
  <meta name="description" content={`${p.display_name}: ${p.trades.map((x: any) => x.name_en).join(', ')} in ${p.area}, ${p.district}.`} />
</svelte:head>

<div class="narrow section stack" style="--gap:20px">
  <a href="/search" class="row muted small" style="--gap:4px"><Icon name="back" size={18} /> {t(lang, 'back')}</a>

  {#if photos.length}
    <div class="photos">
      {#each photos as id}<img src={`${data.fileBase}/files/${id}`} alt="Work by {p.display_name}" loading="lazy" />{/each}
    </div>
  {/if}

  <header class="row" style="--gap:16px; align-items:center">
    <div class="avatar" style="width:72px;height:72px;font-size:24px">
      {#if p.avatar_file_id}<img src={`${data.fileBase}/files/${p.avatar_file_id}`} alt="" />{:else}{initials(p.display_name)}{/if}
    </div>
    <div class="stack" style="--gap:4px">
      <h1 class="page-title">{p.display_name}</h1>
      <span class="muted">
        {p.trades.map((x: any) => catName(lang, x)).join(', ')} · {p.area}, {p.district}
        {#if p.years_experience} · {p.years_experience} {t(lang, 'years')}{/if}
        {#if p.distance_km != null} · {p.distance_km} km{/if}
      </span>
      <span>
        {#if p.rating_count}<strong>★ {p.rating}</strong> <span class="muted">· {p.rating_count} {t(lang, 'reviews')} · {p.jobs_completed} {t(lang, 'jobs')}</span>
        {:else}<span class="muted">{t(lang, 'new_fundi')}</span>{/if}
      </span>
    </div>
  </header>

  <div class="row" style="--gap:6px">
    <Badge level={p.verification_level} {lang} />
    {#if p.available_today}<span class="pill good">{t(lang, 'available_today')}</span>{/if}
    {#if p.home_visits}<span class="pill neutral">{t(lang, 'home_visit')}</span>{/if}
  </div>

  {#if p.bio}<p>{p.bio}</p>{/if}

  <section class="stack" style="--gap:10px">
    <h2>{t(lang, 'services')}</h2>
    <ul class="services card">
      {#each p.listings as l (l.id)}
        <li>
          <div class="stack" style="--gap:2px">
            <strong>{l.title}</strong>
            {#if l.description}<span class="muted small">{l.description}</span>{/if}
          </div>
          <div class="row" style="--gap:12px">
            <span class="price">{l.price_type === 'quote' ? t(lang, 'ask_quote') : `${l.price_type === 'from' ? t(lang, 'from_price') + ' ' : ''}${mwk(l.price_mwk)}`}</span>
            <a class="btn small" href={`/book/${p.id}?listing=${l.id}`}>{t(lang, 'book')}</a>
          </div>
        </li>
      {/each}
      <li>
        <strong>{t(lang, 'something_else')}</strong>
        <a class="btn small secondary" href={`/book/${p.id}`}>{t(lang, 'ask_quote')}</a>
      </li>
    </ul>
    <p class="muted small">
      {t(lang, 'works_within')} {p.service_radius_km} km{#if p.work_hours} · {p.work_hours}{/if} · {t(lang, 'phone_hidden')}
    </p>
  </section>

  <section class="stack" style="--gap:10px">
    <h2>{t(lang, 'reviews')[0].toUpperCase() + t(lang, 'reviews').slice(1)}</h2>
    {#each p.reviews as r (r.id)}
      <article class="card stack" style="--gap:6px">
        <div class="row between small"><strong>{r.customer_first_name}</strong><span class="muted">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)} · {dateLabel(r.created_at)}</span></div>
        {#if r.text}<p>{r.text}</p>{/if}
        {#if r.provider_reply}<p class="reply small"><strong>{p.display_name}:</strong> {r.provider_reply}</p>{/if}
      </article>
    {:else}
      <p class="muted">No reviews yet.</p>
    {/each}
  </section>
</div>

<div class="sticky">
  <div class="narrow row" style="--gap:10px">
    <a class="btn block" href={`/book/${p.id}${p.listings[0] ? `?listing=${p.listings[0].id}` : ''}`}>{t(lang, 'book')} · {p.display_name.split(' ')[0]}</a>
  </div>
</div>

<style>
  .photos { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; border-radius: var(--radius); overflow: hidden; }
  .photos img { aspect-ratio: 1; object-fit: cover; width: 100%; background: var(--sunk); }
  .services { list-style: none; margin: 0; padding: 0; }
  .services li { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--sunk); flex-wrap: wrap; }
  .services li:last-child { border-bottom: 0; }
  .price { font-weight: 700; }
  .reply { background: var(--sunk); padding: 8px 10px; border-radius: 10px; }
  .sticky { position: sticky; bottom: 0; background: var(--surface); border-top: 1px solid var(--line); padding: 12px 0 16px; margin-top: 24px; }
</style>
