<script lang="ts">
  import { enhance } from '$app/forms';
  import { dateLabel, localPhone } from '$lib/format';
  let { data, form } = $props();
  const tabs = [['pending', 'Waiting'], ['approved', 'Approved'], ['rejected', 'Not approved']];
  const reject = (e: SubmitEvent) => {
    const f = e.currentTarget as HTMLFormElement;
    const why = prompt('Why is this request not approved? The applicant sees this.', 'We could not verify your details');
    if (why === null) return e.preventDefault();
    (f.elements.namedItem('reason') as HTMLInputElement).value = why;
  };
</script>

<svelte:head><title>Account requests · Admin · GalimotoYanga</title></svelte:head>

<div class="row between">
  <h1>Account requests</h1>
  <nav class="filters" aria-label="Status">
    {#each tabs as [s, label]}<a href={`/admin/access?status=${s}`} aria-current={data.status === s ? 'page' : undefined}>{label}</a>{/each}
  </nav>
</div>
<p class="muted small">Check that the name on the ID matches the request, that the photo is clear, and that the selfie matches the ID. Photos are private and deleted if you do not approve.</p>
{#if form?.error}<p class="alert error">{form.error}</p>{/if}

{#if data.list.length === 0}
  <p class="panel">No requests here.</p>
{/if}
<div class="stack" style="--gap:12px">
  {#each data.list as r (r.id)}
    <article class="panel req">
      <div class="who stack" style="--gap:4px">
        <strong>{r.name}</strong>
        <span>{localPhone(r.phone)}</span>
        <span class="tiny muted">Asked {dateLabel(r.created_at)}</span>
        {#if r.note}<span class="small">“{r.note}”</span>{/if}
        {#if r.reason}<span class="small">Reason given: {r.reason}</span>{/if}
      </div>
      <div class="photos">
        {#if r.id_file_id}<a href={`/admin/access/file/${r.id_file_id}`} target="_blank" rel="noopener"><img src={`/admin/access/file/${r.id_file_id}`} alt={`National ID of ${r.name}`} /><span class="tiny">National ID</span></a>{/if}
        {#if r.selfie_file_id}<a href={`/admin/access/file/${r.selfie_file_id}`} target="_blank" rel="noopener"><img src={`/admin/access/file/${r.selfie_file_id}`} alt={`Selfie of ${r.name}`} /><span class="tiny">Selfie</span></a>{/if}
      </div>
      {#if r.status === 'pending'}
        <div class="row" style="--gap:8px">
          <form method="POST" action="?/approve" use:enhance><input type="hidden" name="id" value={r.id} /><button class="btn">Approve</button></form>
          <form method="POST" action="?/reject" use:enhance onsubmit={reject}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="reason" value="" /><button class="btn plain">Do not approve</button></form>
        </div>
      {/if}
    </article>
  {/each}
</div>

<style>
  .req { display: grid; gap: 12px; }
  .photos { display: flex; gap: 12px; flex-wrap: wrap; }
  .photos a { display: grid; gap: 4px; color: var(--ink); text-decoration: none; }
  .photos img { width: 220px; max-width: 100%; height: 150px; object-fit: cover; border-radius: var(--radius); border: 1px solid var(--line); background: var(--sunk); }
</style>
