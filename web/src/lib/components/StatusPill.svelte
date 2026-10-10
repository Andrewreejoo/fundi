<script lang="ts">
  import { t, type Lang, type Key } from '$lib/i18n';
  let { status, lang }: { status: string; lang: Lang } = $props();
  const tone = $derived(
    ['confirmed', 'paid'].includes(status) ? 'good'
    : ['disputed', 'cancelled', 'expired'].includes(status) ? 'bad'
    : ['requested', 'quoted', 'accepted', 'completed'].includes(status) ? 'warn'
    : 'neutral',
  );
</script>

<span class="pill {tone}">{t(lang, `st_${status}` as Key)}</span>
