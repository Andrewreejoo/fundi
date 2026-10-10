<script lang="ts">
  import { enhance } from '$app/forms';
  import { dateLabel, localPhone } from '$lib/format';
  let { data, form } = $props();
</script>

<svelte:head><title>Sellers · Admin · GalimotoYanga</title></svelte:head>

<div class="row between"><h1>Sellers</h1>
  <form method="GET" class="row" style="--gap:6px"><input name="q" value={data.q} placeholder="Name or phone" aria-label="Search sellers" /><button class="btn dark sm">Search</button></form>
</div>
{#if form?.error}<p class="alert error">{form.error}</p>{/if}
<p class="small muted">Verify a seller after checking their ID (and business registration for dealers). Verified sellers' listings go live without review, and any waiting listings are published.</p>
<div class="tablewrap"><table>
  <thead><tr><th>Seller</th><th>Phone</th><th>Where</th><th>Live</th><th>Waiting</th><th>Sales done</th><th>Joined</th><th></th></tr></thead>
  <tbody>
    {#each data.list as s (s.id)}
      <tr>
        <td><a href={`/dealers/${s.id}`}>{s.name}</a><br /><span class="tiny muted">{s.kind === 'dealer' ? 'Dealer' : 'Private'}{s.status !== 'active' ? `, ${s.status}` : ''}</span></td>
        <td>{localPhone(s.phone)}</td><td>{s.area}, {s.district}</td><td>{s.live}</td><td>{s.pending}</td><td>{s.completed_orders}</td><td>{dateLabel(s.created_at)}</td>
        <td>
          <form method="POST" action="?/verify" use:enhance><input type="hidden" name="id" value={s.id} /><input type="hidden" name="on" value={String(!s.verified)} />
            <button class="btn sm {s.verified ? 'plain' : ''}">{s.verified ? 'Remove verified' : 'Verify'}</button></form>
        </td>
      </tr>
    {/each}
  </tbody>
</table></div>
