<script lang="ts">
  import { enhance } from '$app/forms';
  import { t } from '$lib/i18n';

  let { data, form } = $props();
  const lang = $derived(data.lang ?? 'ny');
  const step = $derived((form as any)?.step ?? (data.mode === 'pin' ? 'pin' : 'phone'));
  const phone = $derived((form as any)?.phone ?? '');
  let busy = $state(false);
  const submit = () => {
    busy = true;
    return async ({ update }: any) => { await update(); busy = false; };
  };
</script>

<svelte:head><title>{t(lang, 'nav_signin')} · Fundi</title></svelte:head>

<div class="narrow section">
  <div class="card stack box" style="--gap:18px">
    <h1 class="page-title">{t(lang, 'login_title')}</h1>

    {#if form?.error}<p class="alert error" role="alert">{form.error}</p>{/if}

    {#if step === 'code'}
      <p>We sent a 6-digit code by SMS to <strong>{phone}</strong>.</p>
      {#if (form as any)?.devCode}<p class="alert info">Development mode, your code is <strong>{(form as any).devCode}</strong></p>{/if}
      <form method="POST" action="?/verify" class="stack" use:enhance={submit}>
        <input type="hidden" name="phone" value={phone} />
        <input type="hidden" name="next" value={data.next} />
        <label class="field">{t(lang, 'code')}
          <input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required autofocus />
        </label>
        <button class="btn block" disabled={busy}>{t(lang, 'verify')}</button>
      </form>
      <form method="POST" action="?/request" use:enhance={submit}>
        <input type="hidden" name="phone" value={phone} />
        <button class="btn ghost block" disabled={busy}>Send a new code</button>
      </form>
    {:else if step === 'pin'}
      <form method="POST" action="?/pin" class="stack" use:enhance={submit}>
        <input type="hidden" name="next" value={data.next} />
        <label class="field">{t(lang, 'phone')}
          <input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="0991 234 567" value={phone} required />
        </label>
        <label class="field">{t(lang, 'pin')}
          <input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="current-password" required />
        </label>
        <button class="btn block" disabled={busy}>{t(lang, 'nav_signin')}</button>
      </form>
      <a href={`/login?next=${encodeURIComponent(data.next)}`}>{t(lang, 'use_code')}</a>
    {:else}
      <form method="POST" action="?/request" class="stack" use:enhance={submit}>
        <label class="field">{t(lang, 'phone')}
          <span class="hint">Airtel (099, 098) or TNM (088, 089)</span>
          <input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="0991 234 567" value={phone} required autofocus />
        </label>
        <button class="btn block" disabled={busy}>{t(lang, 'send_code')}</button>
      </form>
      <a href={`/login?mode=pin&next=${encodeURIComponent(data.next)}`}>{t(lang, 'use_pin')}</a>
    {/if}
  </div>
</div>

<style>
  .box { max-width: 460px; margin: 0 auto; padding: 24px; }
</style>
