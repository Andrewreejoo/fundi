<script lang="ts">
  import { enhance } from '$app/forms';
  import { mwk } from '$lib/format';
  let { data, form } = $props();
</script>

<svelte:head><title>Listings · Fundi admin</title></svelte:head>

<div class="row between">
  <h1 class="page-title">Listings</h1>
  <nav class="row" style="--gap:6px">
    {#each ['pending', 'live', 'rejected', 'paused'] as s}<a class="btn small {s === data.status ? '' : 'ghost'}" href={`?status=${s}`}>{s}</a>{/each}
  </nav>
</div>
{#if form?.error}<p class="alert error">{form.error}</p>{/if}
{#if form?.done}<p class="alert ok">{form.done}.</p>{/if}

{#each data.items as l (l.id)}
  <article class="card stack" style="--gap:6px">
    <div class="row between"><strong>{l.title}</strong><span class="small">{l.price_type === 'quote' ? 'Quote' : mwk(l.price_mwk)}</span></div>
    <span class="small muted">{l.display_name} · {l.category_name} · {l.verification_level}</span>
    {#if l.description}<p class="small">{l.description}</p>{/if}
    {#if l.photo_ids.length}<div class="row" style="--gap:6px">{#each l.photo_ids as id}<img src={`${data.fileBase}/files/${id}`} alt="" />{/each}</div>{/if}
    {#if data.status === 'pending'}
      <div class="row" style="--gap:8px">
        <form method="POST" action="?/approve" use:enhance><input type="hidden" name="id" value={l.id} /><button class="btn small">Approve</button></form>
        <form method="POST" action="?/reject" class="row" style="--gap:6px" use:enhance>
          <input type="hidden" name="id" value={l.id} />
          <input name="reason" required minlength="3" placeholder="Reason shown to the provider" style="min-height:40px" />
          <button class="btn small danger">Reject</button>
        </form>
      </div>
    {/if}
  </article>
{:else}
  <p class="card empty">Nothing here.</p>
{/each}

<style>
  img { width: 72px; height: 72px; object-fit: cover; border-radius: 8px; }
</style>
