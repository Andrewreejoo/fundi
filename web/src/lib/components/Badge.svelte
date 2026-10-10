<script lang="ts">
  import { t, type Lang } from '$lib/i18n';
  let { level, lang }: { level: string; lang: Lang } = $props();
</script>

{#if level === 'trusted'}
  <span class="pill trusted">★ {t(lang, 'badge_trusted')}</span>
{:else if level === 'id_verified'}
  <span class="pill verified">✓ {t(lang, 'badge_id')}</span>
{:else}
  <span class="pill basic">{t(lang, 'badge_basic')}</span>
{/if}
