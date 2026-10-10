<script lang="ts">
  import { STATUS_LABEL } from '$lib/format';
  let { status }: { status: string } = $props();
  const tone = $derived(
    ['completed', 'confirmed', 'reserved'].includes(status) ? 'good'
    : ['disputed', 'cancelled', 'expired'].includes(status) ? 'bad'
    : ['pending_payment', 'handed_over', 'returned'].includes(status) ? 'held'
    : 'quiet',
  );
</script>

<span class="tag {tone}">{STATUS_LABEL[status] ?? status}</span>
