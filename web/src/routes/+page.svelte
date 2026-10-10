<script lang="ts">
  import { t, catName } from '$lib/i18n';
  import Icon from '$lib/components/Icon.svelte';
  import SearchForm from '$lib/components/SearchForm.svelte';

  let { data } = $props();
  const lang = $derived(data.lang ?? 'ny');
  const placeQ = $derived(data.saved.placeId ? `&place=${data.saved.placeId}` : '');
</script>

<svelte:head>
  <title>Fundi: find a trusted fundi near you</title>
  <meta name="description" content="Find verified plumbers, welders, tailors, mechanics and more near you in Malawi. Pay with Airtel Money or TNM Mpamba, held safely until the job is done." />
</svelte:head>

<section class="hero">
  <div class="wrap hero-grid">
    <div class="stack" style="--gap:18px">
      <h1>{t(lang, 'hero_title')}</h1>
      <p class="lead">{t(lang, 'hero_sub')}</p>
      <SearchForm {lang} categories={data.categories} districts={data.districts} placeId={data.saved.placeId ?? ''} />
    </div>
    <div class="promise card">
      <div class="row" style="--gap:12px"><span class="ic"><Icon name="shield" size={28} /></span><strong>{t(lang, 'escrow_title')}</strong></div>
      <p class="muted">{t(lang, 'escrow_body')}</p>
      <ul>
        <li><Icon name="check" size={18} /> Airtel Money · TNM Mpamba</li>
        <li><Icon name="check" size={18} /> {t(lang, 'badge_id')}</li>
        <li><Icon name="check" size={18} /> Chichewa · English</li>
      </ul>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap stack" style="--gap:16px">
    <h2>{t(lang, 'browse_trades')}</h2>
    <div class="grid-cats">
      {#each data.categories as c}
        <a class="cat-tile" href={`/search?category=${c.slug}${placeQ}`}>
          <span class="ic"><Icon name={c.icon} size={30} /></span>
          <strong>{catName(lang, c)}</strong>
          {#if lang === 'ny'}<span class="tiny muted">{c.name_en}</span>{/if}
        </a>
      {/each}
    </div>
  </div>
</section>

<section class="section how">
  <div class="wrap stack" style="--gap:20px">
    <h2>{t(lang, 'how_title')}</h2>
    <ol class="steps">
      <li><span class="n">1</span><strong>{t(lang, 'how_1_t')}</strong><span class="muted">{t(lang, 'how_1')}</span></li>
      <li><span class="n">2</span><strong>{t(lang, 'how_2_t')}</strong><span class="muted">{t(lang, 'how_2')}</span></li>
      <li><span class="n">3</span><strong>{t(lang, 'how_3_t')}</strong><span class="muted">{t(lang, 'how_3')}</span></li>
    </ol>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="cta">
      <div class="stack" style="--gap:8px">
        <h2>{t(lang, 'cta_title')}</h2>
        <p>{t(lang, 'cta_sub')}</p>
      </div>
      <a class="btn secondary" href="/become-a-fundi">{t(lang, 'nav_become')}</a>
    </div>
  </div>
</section>

<style>
  .hero { padding: 40px 0 24px; }
  .hero-grid { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 32px; align-items: start; }
  h1 { font-size: clamp(32px, 5.5vw, 52px); letter-spacing: -1px; }
  .lead { font-size: 19px; color: var(--muted); max-width: 580px; }
  .promise { display: flex; flex-direction: column; gap: 12px; background: #fff6e6; border-color: #f0d9a8; margin-top: 8px; }
  .promise .ic { color: var(--gold-ink); }
  .promise ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
  .promise li { display: flex; gap: 8px; align-items: center; color: var(--green-dark); }
  .how { background: var(--surface); border-block: 1px solid var(--line); }
  .steps { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 24px; }
  .steps li { display: flex; flex-direction: column; gap: 8px; }
  .n { width: 40px; height: 40px; border-radius: 50%; background: var(--green-tint); color: var(--green); font-weight: 700; display: grid; place-items: center; font-size: 18px; }
  .cta { background: var(--green); color: #fff; border-radius: 24px; padding: 32px; display: flex; flex-wrap: wrap; gap: 20px; align-items: center; justify-content: space-between; }
  .cta p { color: #cfe3d6; }
  .cta .btn.secondary { background: #fff; border-color: #fff; }
  @media (max-width: 860px) { .hero-grid { grid-template-columns: 1fr; } }
</style>
