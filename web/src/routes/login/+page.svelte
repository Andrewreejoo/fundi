<script lang="ts">
  import { enhance } from '$app/forms';
  import Plate from '$lib/components/Plate.svelte';

  let { data, form } = $props();
  const step = $derived((form as any)?.step ?? (data.mode === 'pin' ? 'pin' : 'phone'));
  const phone = $derived((form as any)?.phone ?? '');
  let busy = $state(false);
  const submit = () => {
    busy = true;
    return async ({ update }: any) => { await update(); busy = false; };
  };
</script>

<svelte:head><title>Sign in · Galimoto</title></svelte:head>

<div class="narrow page">
  <div class="panel stack box" style="--gap:16px">
    <Plate text="GALIMOTO" size="md" />
    <h1>Sign in</h1>
    <p class="muted small">Use your phone number. No password, no email needed. Signing in lets you see sellers' numbers, save cars, reserve and hire.</p>

    {#if form?.error}<p class="alert error" role="alert">{form.error}</p>{/if}

    {#if step === 'code'}
      <p>We sent a 6-digit code by SMS to <strong>{phone}</strong>.</p>
      {#if (form as any)?.devCode}<p class="alert info">Demo site: your code is <strong>{(form as any).devCode}</strong></p>{/if}
      <form method="POST" action="?/verify" class="stack" use:enhance={submit}>
        <input type="hidden" name="phone" value={phone} />
        <input type="hidden" name="next" value={data.next} />
        <label class="field">Code from the SMS
          <input name="code" inputmode="numeric" autocomplete="one-time-code" pattern={"[0-9]{6}"} maxlength="6" required autofocus />
        </label>
        <button class="btn lg block" disabled={busy}>Sign in</button>
      </form>
      <form method="POST" action="?/request" use:enhance={submit}>
        <input type="hidden" name="phone" value={phone} />
        <button class="btn plain block" disabled={busy}>Send a new code</button>
      </form>
    {:else if step === 'pin'}
      <form method="POST" action="?/pin" class="stack" use:enhance={submit}>
        <input type="hidden" name="next" value={data.next} />
        <label class="field">Phone number
          <input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="0991 234 567" value={phone} required />
        </label>
        <label class="field">4-digit PIN
          <input name="pin" type="password" inputmode="numeric" pattern={"[0-9]{4}"} maxlength="4" autocomplete="current-password" required />
        </label>
        <button class="btn lg block" disabled={busy}>Sign in</button>
      </form>
      <a class="small" href={`/login?next=${encodeURIComponent(data.next)}`}>Get a code by SMS instead</a>
    {:else}
      <form method="POST" action="?/request" class="stack" use:enhance={submit}>
        <label class="field">Phone number
          <span class="hint">Airtel (099, 098) or TNM (088, 089)</span>
          <input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="0991 234 567" value={phone} required autofocus />
        </label>
        <button class="btn lg block" disabled={busy}>{busy ? 'Sending…' : 'Send me a code'}</button>
      </form>
      <a class="small" href={`/login?mode=pin&next=${encodeURIComponent(data.next)}`}>I have a PIN</a>
    {/if}
  </div>
</div>

<style>
  .box { max-width: 440px; margin: 0 auto; padding: 24px; }
  h1 { font-family: var(--font-cond); font-size: 30px; }
</style>
