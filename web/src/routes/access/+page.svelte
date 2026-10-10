<script lang="ts">
  import { enhance } from '$app/forms';
  import { onDestroy, tick } from 'svelte';
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

  // Selfie: taken live with the camera. There is no file picker for it, so a photo from the gallery cannot be sent.
  let camState = $state<'idle' | 'starting' | 'live' | 'done' | 'error'>('idle');
  let camError = $state('');
  let video = $state<HTMLVideoElement>();
  let selfieInput = $state<HTMLInputElement>();
  let stream: MediaStream | null = null;

  function stopCamera() {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  onDestroy(stopCamera);

  async function openCamera() {
    camError = '';
    camState = 'starting';
    if (!navigator.mediaDevices?.getUserMedia) {
      camState = 'error';
      camError = 'This browser cannot open the camera. Open galimotoyanga.com in Chrome or Safari and try again.';
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      camState = 'live';
      await tick();
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
    } catch (e: any) {
      stopCamera();
      camState = 'error';
      camError =
        e?.name === 'NotAllowedError'
          ? 'The camera is blocked. Allow the camera for this site in your browser settings, then try again.'
          : 'Could not open the camera. Check that no other app is using it, then try again.';
    }
  }

  async function takeSelfie() {
    if (!video || !video.videoWidth) return;
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    if (!blob || !selfieInput) return;
    const dt = new DataTransfer();
    dt.items.add(new File([blob], 'selfie.jpg', { type: 'image/jpeg' }));
    selfieInput.files = dt.files;
    if (selfiePreview) URL.revokeObjectURL(selfiePreview);
    selfiePreview = URL.createObjectURL(blob);
    stopCamera();
    camState = 'done';
  }

  function retake() {
    if (selfieInput) selfieInput.value = '';
    if (selfiePreview) URL.revokeObjectURL(selfiePreview);
    selfiePreview = '';
    openCamera();
  }

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

  async function onPhoto(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    busy = true;
    const small = await shrink(file);
    const dt = new DataTransfer();
    dt.items.add(small);
    input.files = dt.files;
    idPreview = URL.createObjectURL(small);
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

      <form method="POST" enctype="multipart/form-data" class="stack" use:enhance={({ cancel }) => {
        if (!selfieInput?.files?.length) {
          cancel();
          camError = 'Take a selfie with the camera before you send your request.';
          if (camState === 'idle') camState = 'error';
          return;
        }
        busy = true;
        return async ({ update }) => { await update({ reset: false }); busy = false; };
      }}>
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
          <input name="idPhoto" type="file" accept="image/*" capture="environment" required onchange={onPhoto} />
        </label>
        {#if idPreview}<img class="preview" src={idPreview} alt="Your national ID photo" />{/if}

        <div class="field">
          <span>A selfie, taken now with your camera</span>
          <span class="hint">Look at the camera in good light, with nothing covering your face. You cannot upload a photo here.</span>
          <input bind:this={selfieInput} name="selfie" type="file" accept="image/jpeg" hidden tabindex="-1" aria-hidden="true" />

          {#if camState === 'live'}
            <video bind:this={video} class="cam" playsinline muted aria-label="Camera preview"></video>
            <button type="button" class="btn lg block" onclick={takeSelfie}>Take photo</button>
          {:else if camState === 'done' && selfiePreview}
            <img class="preview" src={selfiePreview} alt="Your selfie" />
            <button type="button" class="btn plain block" onclick={retake}>Take it again</button>
          {:else}
            <button type="button" class="btn dark block" onclick={openCamera} disabled={camState === 'starting'}>{camState === 'starting' ? 'Opening camera…' : 'Open camera'}</button>
          {/if}
          {#if camError}<p class="alert error" role="alert">{camError}</p>{/if}
        </div>

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
  .cam { width: 100%; max-height: 360px; background: #000; border-radius: var(--radius); transform: scaleX(-1); object-fit: cover; }
  .preview { max-width: 100%; max-height: 220px; object-fit: contain; border-radius: var(--radius); border: 1px solid var(--line); }
</style>
