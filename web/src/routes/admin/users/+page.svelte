<script lang="ts">
  import { enhance } from '$app/forms';
  import { dateTime, localPhone } from '$lib/format';
  let { data, form } = $props();
</script>

<svelte:head><title>Users · Fundi admin</title></svelte:head>

<h1 class="page-title">Users</h1>
<form method="GET" class="row" style="--gap:8px">
  <input name="phone" type="search" placeholder="Search by phone" value={data.phone} style="max-width:280px" />
  <button class="btn small">Search</button>
</form>
{#if form?.error}<p class="alert error">{form.error}</p>{/if}
{#if form?.done}<p class="alert ok">{form.done}.</p>{/if}

<div class="card scroll-x">
  <table class="data">
    <thead><tr><th>Phone</th><th>Name</th><th>Roles</th><th>Provider</th><th>Joined</th><th>Status</th><th></th></tr></thead>
    <tbody>
      {#each data.items as u (u.id)}
        <tr>
          <td>{localPhone(u.phone)}</td>
          <td>{u.name ?? ''}</td>
          <td>{u.roles.join(', ')}</td>
          <td>{u.display_name ? `${u.display_name} (${u.verification_level}, ${u.district})` : ''}</td>
          <td>{dateTime(u.created_at)}</td>
          <td><span class="pill {u.status === 'active' ? 'good' : 'bad'}">{u.status}</span></td>
          <td class="row" style="--gap:6px">
            <form method="POST" action="?/status" use:enhance>
              <input type="hidden" name="id" value={u.id} /><input type="hidden" name="to" value={u.status === 'active' ? 'suspended' : 'active'} />
              <button class="btn small {u.status === 'active' ? 'danger' : 'secondary'}">{u.status === 'active' ? 'Suspend' : 'Activate'}</button>
            </form>
            <form method="POST" action="?/role" use:enhance>
              <input type="hidden" name="id" value={u.id} /><input type="hidden" name="role" value="agent" />
              <input type="hidden" name="op" value={u.roles.includes('agent') ? 'remove' : 'add'} />
              <button class="btn small ghost">{u.roles.includes('agent') ? 'Remove agent' : 'Make agent'}</button>
            </form>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
