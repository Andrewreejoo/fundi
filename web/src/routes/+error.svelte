<script lang="ts">
  import { page } from '$app/state';
  import Plate from '$lib/components/Plate.svelte';
</script>

<svelte:head><title>{page.status === 404 ? 'Not found' : 'Error'} · Galimoto</title></svelte:head>

<div class="narrow page stack err" style="--gap:14px">
  <Plate text={String(page.status)} size="xl" />
  <h1>{page.status === 404 ? 'We could not find that page' : page.status === 403 ? 'You do not have access to this page' : 'Something went wrong'}</h1>
  {#if page.error?.message && page.error.message !== 'Not Found'}<p class="muted">{page.error.message}</p>{/if}
  <div class="row" style="--gap:8px; justify-content:center">
    <a class="btn" href="/cars">Browse cars for sale</a>
    <a class="btn plain" href="/rent">Cars for hire</a>
  </div>
</div>

<style>
  .err { text-align: center; align-items: center; padding-block: 48px; }
  h1 { font-family: var(--font-cond); font-size: 30px; }
</style>
