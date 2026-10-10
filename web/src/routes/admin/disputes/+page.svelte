<script lang="ts">
  import { enhance } from '$app/forms';
  import { dateTime, localPhone, mwk, timeLeft } from '$lib/format';
  let { data, form } = $props();
  let choice = $state<Record<string, string>>({});
</script>

<svelte:head><title>Disputes · Fundi admin</title></svelte:head>

<div class="row between">
  <h1 class="page-title">Disputes</h1>
  <nav class="row" style="--gap:6px">
    {#each ['open', 'resolved'] as s}<a class="btn small {s === data.status ? '' : 'ghost'}" href={`?status=${s}`}>{s}</a>{/each}
  </nav>
</div>
{#if form?.error}<p class="alert error">{form.error}</p>{/if}
{#if form?.done}<p class="alert ok">{form.done}. Payouts and refunds have been sent.</p>{/if}

{#each data.items as d (d.id)}
  <article class="card stack" class:late={d.status === 'open' && !timeLeft(d.sla_due_at)} style="--gap:8px">
    <div class="row between">
      <strong><a href={`/bookings/${d.booking_id}`}>{d.ref}</a> · {mwk(d.price_mwk)}{d.escrow ? ' in escrow' : ' (paid directly)'}</strong>
      {#if d.status === 'open'}<span class="pill {timeLeft(d.sla_due_at) ? 'warn' : 'bad'}">{timeLeft(d.sla_due_at) ? `${timeLeft(d.sla_due_at)} left` : 'SLA missed'}</span>
      {:else}<span class="pill good">{d.resolution}{d.resolution === 'split' ? ` ${d.provider_share_percent}%` : ''}</span>{/if}
    </div>
    <p class="small"><strong>Reason:</strong> {d.reason}</p>
    {#if d.description}<p class="small muted">Job: {d.description}</p>{/if}
    <p class="small muted">
      Fundi {d.provider_name} <a href={`tel:${d.provider_phone}`}>{localPhone(d.provider_phone)}</a> ·
      Customer {d.customer_name} <a href={`tel:${d.customer_phone}`}>{localPhone(d.customer_phone)}</a> ·
      opened {dateTime(d.created_at)} by {localPhone(d.opened_by_phone)}
    </p>
    {#if d.status === 'open'}
      <form method="POST" action="?/resolve" class="stack" style="--gap:8px" use:enhance>
        <input type="hidden" name="id" value={d.id} />
        <div class="choices">
          <label class="choice"><input type="radio" name="resolution" value="release" required bind:group={choice[d.id]} /> Release to fundi</label>
          <label class="choice"><input type="radio" name="resolution" value="refund" bind:group={choice[d.id]} /> Refund customer</label>
          <label class="choice"><input type="radio" name="resolution" value="split" bind:group={choice[d.id]} /> Split</label>
        </div>
        {#if choice[d.id] === 'split'}<label class="field">Share to fundi (%)<input name="share" type="number" min="1" max="99" value="50" required /></label>{/if}
        <label class="field">Note to both parties<input name="note" maxlength="1000" placeholder="What you decided and why" /></label>
        <button class="btn" onclick={(e) => { if (!confirm('This moves money and cannot be undone. Continue?')) e.preventDefault(); }}>Resolve</button>
      </form>
    {:else if d.admin_note}
      <p class="small">Note: {d.admin_note}</p>
    {/if}
  </article>
{:else}
  <p class="card empty">No {data.status} disputes.</p>
{/each}

<style>
  .late { border: 2px solid var(--red); }
</style>
