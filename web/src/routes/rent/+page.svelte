<script lang="ts">
  import StockList from '$lib/components/StockList.svelte';
  let { data } = $props();
</script>

<svelte:head><title>Car hire in Malawi · GalimotoYanga</title></svelte:head>
<StockList {data} />
