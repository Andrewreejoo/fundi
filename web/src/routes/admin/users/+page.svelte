<script lang="ts">
  import { enhance } from '$app/forms';
  import { dateLabel, localPhone } from '$lib/format';
  let { data, form } = $props();
  const sure = (e: SubmitEvent) => { if (!confirm('Suspend this user? They are signed out and their live cars are paused.')) e.preventDefault(); };
</script>

<svelte:head><title>Users · Admin · GalimotoYanga</title></svelte:head>

<div class="row between"><h1>Users</h1>
  <form method="GET" class="row" style="--gap:6px"><input name="phone" value={data.phone} placeholder="Phone number" aria-label="Search by phone" /><button class="btn dark sm">Search</button></form>
</div>
{#if form?.error}<p class="alert error">{form.error}</p>{/if}
<div class="tablewrap"><table>
  <thead><tr><th>Phone</th><th>Name</th><th>Roles</th><th>Seller</th><th>Status</th><th>Joined</th><th></th></tr></thead>
  <tbody>
    {#each data.list as u (u.id)}
      <tr>
        <td>{localPhone(u.phone)}</td><td>{u.name ?? ''}</td><td>{u.roles.join(', ')}</td>
        <td>{u.seller_name ?? ''}{#if u.seller_name}<br /><span class="tiny muted">{u.seller_kind}{u.verified ? ', verified' : ''}</span>{/if}</td>
        <td>{u.status}</td><td>{dateLabel(u.created_at)}</td>
        <td>
          {#if !u.roles.includes('admin')}
            <form method="POST" action="?/status" use:enhance onsubmit={u.status === 'active' ? sure : undefined}>
              <input type="hidden" name="id" value={u.id} /><input type="hidden" name="to" value={u.status === 'active' ? 'suspend' : 'activate'} />
              <button class="btn sm {u.status === 'active' ? 'plain' : ''}">{u.status === 'active' ? 'Suspend' : 'Reactivate'}</button>
            </form>
          {/if}
        </td>
      </tr>
    {/each}
  </tbody>
</table></div>
