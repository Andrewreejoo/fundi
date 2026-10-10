<script lang="ts">
  import { enhance } from '$app/forms';
  import { dateTime, localPhone } from '$lib/format';

  let { data, form } = $props();
  const user = $derived(data.user!);
  const unread = $derived(data.notifications.filter((n: any) => !n.read_at).length);
</script>

<svelte:head><title>Your account · Galimoto</title></svelte:head>

<div class="narrow page stack" style="--gap:16px">
  <h1>Your account</h1>
  {#if form?.error}<p class="alert error" role="alert">{form.error}</p>{/if}
  {#if form?.saved === 'profile' || form?.saved === 'pin'}<p class="alert ok" role="status">Saved.</p>{/if}

  {#if data.setpin || !user.has_pin}
    <form method="POST" action="?/pin" class="panel stack">
      <h2>Set a sign-in PIN</h2>
      <p class="muted small">Next time, sign in with your number and this PIN instead of waiting for an SMS. Don't use your mobile money PIN.</p>
      <input type="hidden" name="next" value={data.next} />
      <label class="field">4-digit PIN
        <input name="pin" type="password" inputmode="numeric" pattern={"[0-9]{4}"} maxlength="4" autocomplete="new-password" required />
      </label>
      <div class="row" style="--gap:8px">
        <button class="btn">Save PIN</button>
        {#if data.next}<a class="btn plain" href={data.next}>Skip for now</a>{/if}
      </div>
    </form>
  {/if}

  <form method="POST" action="?/profile" class="panel stack" use:enhance={() => async ({ update }) => update({ reset: false })}>
    <h2>Your details</h2>
    <p class="muted small">Signed in as {localPhone(user.phone)}</p>
    <label class="field">Your name <span class="hint">(sellers see this when you enquire or reserve)</span>
      <input name="name" value={user.name ?? ''} maxlength="80" autocomplete="name" />
    </label>
    <button class="btn dark">Save details</button>
  </form>

  <section class="panel links">
    <a href="/orders">Reservations and rentals</a>
    <a href="/messages">Messages with sellers</a>
    <a href="/favorites">Saved cars</a>
    {#if user.is_seller}<a href="/seller">Seller dashboard</a>{:else}<a href="/sell">Sell or hire out a car</a>{/if}
  </section>

  {#if data.notifications.length}
    <section class="panel stack" style="--gap:10px">
      <div class="row between">
        <h2>Notifications</h2>
        {#if unread}<form method="POST" action="?/read" use:enhance><button class="btn plain sm">Mark all read</button></form>{/if}
      </div>
      {#each data.notifications as n (n.id)}
        <div class="note" class:unread={!n.read_at}>
          <div class="row between"><strong>{n.title}</strong><span class="muted tiny">{dateTime(n.created_at)}</span></div>
          <p class="small">{n.body}</p>
          {#if n.link}<a class="small" href={n.link}>Open</a>{/if}
        </div>
      {/each}
    </section>
  {/if}

  <form method="POST" action="?/logout"><button class="btn plain">Sign out</button></form>
</div>

<style>
  h1 { font-family: var(--font-cond); font-size: 32px; }
  .note { border-top: 1px solid var(--line); padding-top: 10px; }
  .note.unread { border-left: 3px solid var(--plate); padding-left: 10px; }
  .links { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; }
  @media (max-width: 520px) { .links { grid-template-columns: 1fr; } }
</style>
