<script lang="ts">
  import StockList from '$lib/components/StockList.svelte';
  let { data } = $props();
</script>

<svelte:head><title>Cars for sale in Malawi · Galimoto</title></svelte:head>
<StockList {data} />
