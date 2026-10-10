<script lang="ts">
  import { enhance } from '$app/forms';
  import { dateTime, localPhone, mwk } from '$lib/format';
  let { data, form } = $props();
</script>

<svelte:head><title>Payments · Fundi admin</title></svelte:head>

<div class="row between">
  <h1 class="page-title">Payments</h1>
  <nav class="row" style="--gap:6px">
    {#each [['', 'All'], ['pending', 'Pending'], ['failed', 'Failed'], ['success', 'Success']] as [s, label]}
      <a class="btn small {s === data.status ? '' : 'ghost'}" href={s ? `?status=${s}` : '?'}>{label}</a>
    {/each}
  </nav>
</div>
{#if form?.error}<p class="alert error">{form.error}</p>{/if}
{#if form?.done}<p class="alert ok">{form.done}</p>{/if}

<div class="card scroll-x">
  <table class="data">
    <thead><tr><th>When</th><th>Booking</th><th>Type</th><th>Wallet</th><th>Amount</th><th>Status</th><th></th></tr></thead>
    <tbody>
      {#each data.items as p (p.id)}
        <tr>
          <td>{dateTime(p.created_at)}</td>
          <td>{p.ref}</td>
          <td>{p.direction}</td>
          <td>{p.operator === 'airtel' ? 'Airtel' : 'TNM'} {localPhone(p.msisdn)}</td>
          <td>{mwk(p.amount_mwk)}</td>
          <td><span class="pill {p.status === 'success' ? 'good' : p.status === 'failed' ? 'bad' : 'warn'}">{p.status}</span>
            {#if p.failure_reason}<br /><span class="tiny muted">{p.failure_reason}</span>{/if}
            {#if p.attempts > 1}<br /><span class="tiny muted">attempt {p.attempts}</span>{/if}</td>
          <td>{#if p.status === 'failed' && p.direction !== 'collect'}
            <form method="POST" action="?/retry" use:enhance><input type="hidden" name="id" value={p.id} /><button class="btn small secondary">Retry</button></form>
          {/if}</td>
        </tr>
      {:else}
        <tr><td colspan="7" class="empty">No payments.</td></tr>
      {/each}
    </tbody>
  </table>
</div>
