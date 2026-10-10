<script lang="ts">
  import { enhance } from '$app/forms';
  import { dateTime, localPhone } from '$lib/format';
  let { data, form } = $props();
  const reasons = ['Photo unclear, please retake', 'Name on ID does not match profile', 'Selfie does not match ID photo', 'ID expired'];
</script>

<svelte:head><title>Verification queue · Fundi admin</title></svelte:head>

<div class="row between">
  <h1 class="page-title">Verification queue</h1>
  <nav class="row" style="--gap:6px">
    {#each ['pending', 'approved', 'rejected'] as s}<a class="btn small {s === data.status ? '' : 'ghost'}" href={`?status=${s}`}>{s}</a>{/each}
  </nav>
</div>
{#if form?.error}<p class="alert error">{form.error}</p>{/if}
{#if form?.done}<p class="alert ok">{form.done}.</p>{/if}

{#each data.items as v (v.id)}
  <article class="card item">
    {#if v.id_file_id}
      <a href={`/admin/file/${v.id_file_id}`} target="_blank" rel="noopener"><img src={`/admin/file/${v.id_file_id}`} alt="National ID of {v.display_name}" /></a>
      <a href={`/admin/file/${v.selfie_file_id}`} target="_blank" rel="noopener"><img src={`/admin/file/${v.selfie_file_id}`} alt="Selfie of {v.display_name}" class="selfie" /></a>
    {:else}
      <p class="muted small">Images purged after retention period.</p>
    {/if}
    <div class="stack" style="--gap:4px; flex: 1 1 240px">
      <strong>{v.display_name} · {v.trades}</strong>
      <span class="small muted">{v.area}, {v.district} · {localPhone(v.phone)}{v.onboarded_by_phone ? ` · agent ${localPhone(v.onboarded_by_phone)}` : ''}</span>
      <span class="small muted">Submitted {dateTime(v.created_at)}</span>
      {#if v.status === 'pending'}
        <div class="row" style="--gap:8px; margin-top: 8px">
          <form method="POST" action="?/approve" use:enhance><input type="hidden" name="id" value={v.id} /><button class="btn small">Approve</button></form>
          <form method="POST" action="?/reject" class="row" style="--gap:6px" use:enhance>
            <input type="hidden" name="id" value={v.id} />
            <select name="reason" aria-label="Reason" required>{#each reasons as r}<option>{r}</option>{/each}</select>
            <button class="btn small danger">Reject</button>
          </form>
        </div>
      {:else}
        <span class="pill {v.status === 'approved' ? 'good' : 'bad'}">{v.status}{v.reason ? `: ${v.reason}` : ''}</span>
      {/if}
    </div>
  </article>
{:else}
  <p class="card empty">Nothing here.</p>
{/each}

<style>
  .item { display: flex; gap: 14px; flex-wrap: wrap; align-items: flex-start; }
  img { width: 180px; height: 120px; object-fit: cover; border-radius: 8px; background: var(--sunk); }
  img.selfie { width: 120px; }
  select { width: auto; min-height: 40px; }
</style>
