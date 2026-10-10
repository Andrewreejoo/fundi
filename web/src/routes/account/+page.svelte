<script lang="ts">
  import { t } from '$lib/i18n';
  import { dateTime, localPhone } from '$lib/format';

  let { data, form } = $props();
  const lang = $derived(data.lang ?? 'ny');
  const user = $derived(data.user!);
</script>

<svelte:head><title>{t(lang, 'nav_account')} · Fundi</title></svelte:head>

<div class="narrow section stack" style="--gap:20px">
  <h1 class="page-title">{t(lang, 'nav_account')}</h1>
  {#if form?.error}<p class="alert error" role="alert">{form.error}</p>{/if}
  {#if form?.saved}<p class="alert ok" role="status">Saved.</p>{/if}

  {#if data.setpin || !user.has_pin}
    <form method="POST" action="?/pin" class="card stack">
      <h2>{t(lang, 'set_pin')}</h2>
      <p class="muted">Next time, sign in with your number and this PIN instead of waiting for an SMS. Do not use your mobile money PIN.</p>
      <input type="hidden" name="next" value={data.next} />
      <label class="field">{t(lang, 'pin')}
        <input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="new-password" required />
      </label>
      <div class="row">
        <button class="btn">{t(lang, 'save')}</button>
        {#if data.next}<a class="btn ghost" href={data.next}>Skip for now</a>{/if}
      </div>
    </form>
  {/if}

  <form method="POST" action="?/profile" class="card stack">
    <p class="muted">{localPhone(user.phone)}</p>
    <label class="field">Your name
      <input name="name" value={user.name ?? ''} maxlength="80" autocomplete="name" />
    </label>
    <button class="btn secondary">{t(lang, 'save')}</button>
  </form>

  {#if data.notifications.length}
    <section class="card stack">
      <h2>Messages</h2>
      {#each data.notifications as n (n.id)}
        <div class="note">
          <div class="row between"><strong>{n.title}</strong><span class="muted tiny">{dateTime(n.created_at)}</span></div>
          <p class="small">{n.body}</p>
          {#if n.booking_id}<a class="small" href={`/bookings/${n.booking_id}`}>Open booking</a>{/if}
        </div>
      {/each}
    </section>
  {/if}

  <form method="POST" action="?/logout"><button class="btn ghost">{t(lang, 'nav_signout')}</button></form>
</div>

<style>
  .note { border-top: 1px solid var(--sunk); padding-top: 10px; }
</style>
