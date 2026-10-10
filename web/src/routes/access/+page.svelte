<script lang="ts">
  import { enhance } from '$app/forms';
  import Plate from '$lib/components/Plate.svelte';

  let { form } = $props();
  const first = (form as any)?.values ?? {};
  // Held in local state so choosing a photo never wipes what was already typed.
  let name = $state(first.name ?? '');
  let phone = $state(first.phone ?? '');
  let note = $state(first.note ?? '');
  let busy = $state(false);
  let idPreview = $state('');
  let selfiePreview = $state('');

  async function shrink(file: File): Promise<File> {
    const bitmap = await createImageBitmap(file).catch(() => null);
    if (!bitmap) return file;
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.8));
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  }

  async function onPhoto(e: Event, which: 'id' | 'selfie') {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    busy = true;
    const small = await shrink(file);
    const dt = new DataTransfer();
    dt.items.add(small);
    input.files = dt.files;
    const url = URL.createObjectURL(small);
    if (which === 'id') idPreview = url; else selfiePreview = url;
    busy = false;
  }
</script>

<svelte:head><title>Request an account · GalimotoYanga</title></svelte:head>

<div class="narrow page">
  <div class="panel stack box" style="--gap:16px">
    <Plate text="GALIMOTO YANGA" size="md" />
    {#if (form as any)?.sent}
      <h1>Request received</h1>
      <p>Thank you, {name}. We check each request by hand. When it is approved we send you an SMS, and you can then sign in with your phone number and PIN.</p>
      <p class="muted small">If you try to sign in before then, the site will tell you that your request is waiting.</p>
      <a class="btn lg block" href="/login?mode=pin">Go to sign in</a>
    {:else}
      <h1>Request an account</h1>
      <p class="muted small">Not getting an SMS code? Ask for an account instead. Send your details and a photo of your national ID, and we approve you by hand. Then you sign in with your phone number and a 4-digit PIN. No SMS code is needed.</p>

      {#if form?.error}<p class="alert error" role="alert">{form.error}</p>{/if}

      <form method="POST" enctype="multipart/form-data" class="stack" use:enhance={() => { busy = true; return async ({ update }) => { await update({ reset: false }); busy = false; }; }}>
        <label class="field">Full name, as on your ID
          <input name="name" autocomplete="name" minlength="2" maxlength="80" bind:value={name} required />
        </label>
        <label class="field">Phone number
          <span class="hint">Airtel (099, 098) or TNM (088, 089)</span>
          <input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="0991 234 567" bind:value={phone} required />
        </label>
        <div class="grid2">
          <label class="field">Choose a 4-digit PIN
            <input name="pin" type="password" inputmode="numeric" pattern={"[0-9]{4}"} maxlength="4" autocomplete="new-password" required />
          </label>
          <label class="field">Type the PIN again
            <input name="pin2" type="password" inputmode="numeric" pattern={"[0-9]{4}"} maxlength="4" autocomplete="new-password" required />
          </label>
        </div>

        <label class="field">Photo of your national ID
          <span class="hint">Take a clear photo of the front. All four corners and the text must be readable.</span>
          <input name="idPhoto" type="file" accept="image/*" capture="environment" required onchange={(e) => onPhoto(e, 'id')} />
        </label>
        {#if idPreview}<img class="preview" src={idPreview} alt="Your national ID photo" />{/if}

        <label class="field">A selfie
          <span class="hint">Look at the camera in good light, with nothing covering your face.</span>
          <input name="selfie" type="file" accept="image/*" capture="user" required onchange={(e) => onPhoto(e, 'selfie')} />
        </label>
        {#if selfiePreview}<img class="preview" src={selfiePreview} alt="Your selfie" />{/if}

        <label class="field">What will you use GalimotoYanga for? <span class="hint">Optional. For example, "I run a car yard in Blantyre"</span>
          <textarea name="note" rows="2" maxlength="300" bind:value={note}></textarea>
        </label>

        <p class="tiny muted">Your ID and selfie are kept private. Only GalimotoYanga staff who approve accounts can see them. If we do not approve your request, we delete them.</p>
        <button class="btn lg block" disabled={busy}>{busy ? 'Please wait…' : 'Send my request'}</button>
      </form>
      <a class="small" href="/login">I can get an SMS code, sign in</a>
    {/if}
  </div>
</div>

<style>
  .box { max-width: 480px; margin: 0 auto; padding: 24px; }
  h1 { font-family: var(--font-cond); font-size: 30px; }
  .preview { max-width: 100%; max-height: 220px; object-fit: contain; border-radius: var(--radius); border: 1px solid var(--line); }
</style>
