<script lang="ts">
  import { carTitle } from '$lib/format';
  import CarForm from '$lib/components/CarForm.svelte';
  import Plate from '$lib/components/Plate.svelte';
  let { data, form } = $props();
  const c = $derived(data.car);
  const MSG: Record<string, string> = {
    live: 'Your car is live. Buyers can see it now.',
    pending: 'Saved. Our team will check the listing before buyers see it, usually within a few hours.',
    ok: 'Changes saved.',
  };
</script>

<svelte:head><title>Edit {carTitle(c)} · GalimotoYanga</title></svelte:head>

<div class="narrow page stack" style="--gap:14px">
  <div class="row between small"><a href="/seller">← Seller dashboard</a><a href={`/cars/${c.stock_no}`}>See it as buyers do</a></div>
  <div class="row" style="--gap:10px"><h1>{carTitle(c)}</h1><Plate text={c.stock_no} size="sm" /></div>
  {#if data.saved && MSG[data.saved] && !form?.error}<p class="alert ok" role="status">{MSG[data.saved]}</p>{/if}
  {#if c.status === 'rejected' && c.reject_reason}<p class="alert error">Our team asked for changes: {c.reject_reason}</p>{/if}
  {#key c.updated_at}
    <CarForm car={c} makes={data.makes} models={data.models} features={data.features} bodyTypes={data.bodyTypes} places={data.places}
      fileBase={data.fileBase} error={form?.error ?? ''} values={(form as any)?.values ?? {}} submitLabel="Save changes" />
  {/key}
</div>
