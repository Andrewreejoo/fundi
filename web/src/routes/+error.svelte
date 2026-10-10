<script lang="ts">
  import { page } from '$app/state';
</script>

<svelte:head><title>{page.status} · Fundi</title></svelte:head>

<div class="narrow section stack" style="--gap:14px; text-align:center">
  <h1 class="page-title">{page.status === 404 ? 'Not found' : 'Something went wrong'}</h1>
  <p class="muted">{page.error?.message ?? ''}</p>
  <p><a class="btn" href="/">Go home</a></p>
</div>
