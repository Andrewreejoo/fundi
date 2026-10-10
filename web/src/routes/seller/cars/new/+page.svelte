<script lang="ts">
  import CarForm from '$lib/components/CarForm.svelte';
  let { data, form } = $props();
</script>

<svelte:head><title>List a car · Galimoto</title></svelte:head>

<div class="narrow page stack" style="--gap:14px">
  <a href="/seller" class="small">← Seller dashboard</a>
  <h1>List a car</h1>
  {#if data.welcome}<p class="alert ok">Your seller account is ready. Now add your first car.</p>{/if}
  <CarForm makes={data.makes} models={data.models} features={data.features} bodyTypes={data.bodyTypes} places={data.places}
    fileBase={data.fileBase} error={form?.error ?? ''} values={(form as any)?.values ?? {}} submitLabel="Publish listing" />
</div>
