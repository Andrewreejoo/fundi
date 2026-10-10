<script lang="ts">
  import { enhance } from '$app/forms';
  import { onMount, tick } from 'svelte';
  import Icon from './Icon.svelte';

  /** Create/edit form for a listing. Photos are shrunk in the browser (max 1600 px) before upload. */
  let { car = null, makes, models, bodyTypes, features, places, fileBase, error = '', values = {} as Record<string, any>, submitLabel }:
    { car?: any; makes: any[]; models: any[]; bodyTypes: any[]; features: any[]; places: any[]; fileBase: string; error?: string; values?: Record<string, any>; submitLabel: string } = $props();

  const v = (k: string, fallback: any = '') => values[k] ?? car?.[k] ?? fallback;
  // Svelte quirk: the first time this form updates after loading (picking Sell or Hire, adding a photo, ticking
  // a box), it puts every text field back to its starting value and wipes what the seller typed. Flipping
  // `purpose` once on load, before anyone types, uses up that first update. Browser-tested; keep it.
  onMount(async () => {
    const was = purpose;
    purpose = was === 'sale' ? 'rent' : 'sale';
    await tick();
    purpose = was;
  });
  let purpose = $state<'sale' | 'rent'>('sale');
  let offerDriver = $state(false);
  let selfDrive = $state(true);
  $effect.pre(() => {
    purpose = (values.purpose ?? car?.purpose ?? 'sale') as 'sale' | 'rent';
    offerDriver = values.offerDriver ? values.offerDriver === 'on' : car ? car.driver_rate_mwk != null : false;
    selfDrive = values.selfDrive ? values.selfDrive === 'on' : car ? car.self_drive : true;
  });
  const chosenFeatures = $derived(new Set<string>(car?.features ?? []));
  const byMake = $derived(makes.map((m) => ({ ...m, models: models.filter((x) => x.make_slug === m.slug) })));
  const byDistrict = $derived(places.reduce((acc: Record<string, any[]>, p: any) => ((acc[p.district] ??= []).push(p), acc), {}));
  const years = Array.from({ length: 40 }, (_, i) => new Date().getFullYear() + 1 - i);
  const existing = $derived((car?.photo_ids ?? []) as string[]);

  let previews = $state<string[]>([]);
  let preparing = $state(false);
  let busy = $state(false);

  async function shrink(file: File): Promise<File> {
    if (!file.type.startsWith('image/')) return file;
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

  async function onPhotos(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    if (!input.files?.length) return;
    preparing = true;
    const dt = new DataTransfer();
    for (const f of Array.from(input.files).slice(0, 20)) dt.items.add(await shrink(f));
    input.files = dt.files;
    previews.forEach(URL.revokeObjectURL);
    previews = Array.from(dt.files).map((f) => URL.createObjectURL(f));
    preparing = false;
  }
</script>

<form method="POST" enctype="multipart/form-data" class="stack" style="--gap:16px"
  use:enhance={() => { busy = true; return async ({ update }) => { await update({ reset: false }); busy = false; }; }}>
  {#if error}<p class="alert error" role="alert">{error}</p>{/if}

  <section class="panel stack">
    <h2>What are you listing?</h2>
    {#if car}
      <input type="hidden" name="purpose" value={purpose} />
      <p>{purpose === 'sale' ? 'Car for sale' : 'Car for hire'}</p>
    {:else}
      <div class="grid2">
        <label class="choice"><input type="radio" name="purpose" value="sale" bind:group={purpose} /> <span><strong>Sell a car</strong><br /><span class="hint">Buyers reserve it with a refundable deposit</span></span></label>
        <label class="choice"><input type="radio" name="purpose" value="rent" bind:group={purpose} /> <span><strong>Hire out a car</strong><br /><span class="hint">Renters book dates and pay up front</span></span></label>
      </div>
    {/if}
  </section>

  <section class="panel stack">
    <h2>The car</h2>
    <div class="grid2">
      <label class="field">Make and model
        <select name="modelId" required value={String(v('modelId', car?.model_id ?? ''))}>
          <option value="" disabled>Choose</option>
          {#each byMake as m}<optgroup label={m.name}>{#each m.models as md}<option value={md.id}>{m.name} {md.name}</option>{/each}</optgroup>{/each}
        </select>
      </label>
      <label class="field">Grade or version <span class="hint">(optional)</span><input name="variant" maxlength="60" value={v('variant')} placeholder="e.g. 20X 4WD, 1.5 G" /></label>
      <label class="field">Year<select name="year" required value={String(v('year', ''))}><option value="" disabled>Choose</option>{#each years as y}<option>{y}</option>{/each}</select></label>
      <label class="field">Mileage (km)<input name="mileageKm" inputmode="numeric" value={v('mileageKm', car?.mileage_km ?? '')} placeholder="e.g. 86000" /></label>
      <label class="field">Transmission<select name="transmission" value={v('transmission', 'automatic')}><option value="automatic">Automatic</option><option value="manual">Manual</option></select></label>
      <label class="field">Fuel<select name="fuel" value={v('fuel', 'petrol')}><option value="petrol">Petrol</option><option value="diesel">Diesel</option><option value="hybrid">Hybrid</option><option value="electric">Electric</option></select></label>
      <label class="field">Drive<select name="drive" value={v('drive', '2wd')}><option value="2wd">2WD</option><option value="4wd">4WD</option></select></label>
      <label class="field">Engine size (cc)<input name="engineCc" inputmode="numeric" value={v('engineCc', car?.engine_cc ?? '')} placeholder="e.g. 2000" /></label>
      <label class="field">Colour<input name="color" maxlength="30" value={v('color')} placeholder="e.g. Silver" /></label>
      <label class="field">Condition<select name="condition" value={v('condition', 'good')}><option value="excellent">Excellent</option><option value="good">Good</option><option value="fair">Fair</option><option value="needs_work">Needs work</option></select></label>
      <label class="field">Seats<input name="seats" inputmode="numeric" value={v('seats', car?.seats ?? '')} /></label>
      <label class="field">Doors<input name="doors" inputmode="numeric" value={v('doors', car?.doors ?? '')} /></label>
    </div>
  </section>

  <section class="panel stack">
    <h2>Papers</h2>
    <div class="grid2">
      <label class="field">Number plate <span class="hint">(optional, shown to buyers)</span><input name="plate" maxlength="12" value={v('plate')} placeholder="e.g. BZ 21851" /></label>
      <label class="field">Certificate of fitness valid to <span class="hint">(optional)</span><input type="date" name="cofExpiry" value={v('cofExpiry', car?.cof_expiry ?? '')} /></label>
    </div>
    <label class="check"><input type="checkbox" name="registered" checked={values.registered ? values.registered === 'on' : car ? car.registered : true} /> Registered in Malawi</label>
    <label class="check"><input type="checkbox" name="dutyPaid" checked={values.dutyPaid ? values.dutyPaid === 'on' : car ? car.duty_paid : true} /> MRA duty paid</label>
  </section>

  <section class="panel stack">
    <h2>{purpose === 'sale' ? 'Price' : 'Rates'}</h2>
    {#if purpose === 'sale'}
      <div class="grid2">
        <label class="field">Asking price (MWK)<input name="priceMwk" inputmode="numeric" required value={v('priceMwk', car?.price_mwk ?? '')} placeholder="e.g. 32000000" /></label>
      </div>
      <label class="check"><input type="checkbox" name="negotiable" checked={values.negotiable ? values.negotiable === 'on' : car ? car.negotiable : true} /> Price is negotiable</label>
      {#if car}<p class="hint">Lowering the price shows a "Price down" badge with the old price crossed out.</p>{/if}
    {:else}
      <div class="grid2">
        <label class="field">Price per day (MWK)<input name="dailyRateMwk" inputmode="numeric" required value={v('dailyRateMwk', car?.daily_rate_mwk ?? '')} placeholder="e.g. 120000" /></label>
        <label class="field">Minimum days<input name="minDays" inputmode="numeric" value={v('minDays', car?.min_days ?? 1)} /></label>
      </div>
      <label class="check"><input type="checkbox" name="selfDrive" bind:checked={selfDrive} /> Renters can drive it themselves</label>
      <label class="check"><input type="checkbox" name="offerDriver" bind:checked={offerDriver} /> I can provide a driver</label>
      {#if offerDriver}
        <label class="field">Driver charge per day (MWK) <span class="hint">0 if the driver is included</span>
          <input name="driverRateMwk" inputmode="numeric" value={v('driverRateMwk', car?.driver_rate_mwk ?? '')} placeholder="e.g. 35000" />
        </label>
      {/if}
      {#if !selfDrive && !offerDriver}<p class="alert error small">Allow self-drive or offer a driver.</p>{/if}
    {/if}
  </section>

  <section class="panel stack">
    <h2>Features</h2>
    <div class="feats">
      {#each features as f}<label class="check"><input type="checkbox" name="features" value={f.slug} checked={(values.features ?? []).includes?.(f.slug) || chosenFeatures.has(f.slug)} /> {f.name}</label>{/each}
    </div>
    <label class="field">Description <span class="hint">(service history, recent repairs, why you are selling)</span>
      <textarea name="description" maxlength="3000">{v('description')}</textarea>
    </label>
  </section>

  <section class="panel stack">
    <h2>Photos</h2>
    <p class="hint">Good photos sell cars. Add the front, back, both sides, the dashboard and the seats. The first photo is the cover.</p>
    {#if existing.length}
      <div class="photos">
        {#each existing as id, i}
          <figure>
            <img src={`${fileBase}/files/${id}`} alt={`Photo ${i + 1}`} />
            <label class="check tiny"><input type="checkbox" name="keep" value={id} checked /> Keep</label>
            <label class="check tiny"><input type="radio" name="cover" value={id} checked={i === 0} /> Cover</label>
          </figure>
        {/each}
      </div>
    {/if}
    <label class="upload">
      <Icon name="car" /> {preparing ? 'Preparing photos…' : existing.length ? 'Add more photos' : 'Choose photos'}
      <input type="file" name="photos" accept="image/*" multiple onchange={onPhotos} />
    </label>
    {#if previews.length}
      <div class="photos">{#each previews as src, i}<figure><img {src} alt={`New photo ${i + 1}`} /></figure>{/each}</div>
    {/if}
  </section>

  <section class="panel stack">
    <h2>Where is the car?</h2>
    <select name="placeId" value={String(values.placeId ?? '')}>
      <option value="">{car ? `${car.area}, ${car.district} (unchanged)` : 'Same as my address'}</option>
      {#each Object.entries(byDistrict) as [d, list]}<optgroup label={d}>{#each list as p}<option value={p.id}>{p.name}, {d}</option>{/each}</optgroup>{/each}
    </select>
  </section>

  <button class="btn lg" disabled={busy || preparing}>{busy ? 'Saving…' : submitLabel}</button>
</form>

<style>
  .choice { display: flex; gap: 10px; align-items: flex-start; padding: 12px; border: 1px solid var(--line-strong); border-radius: var(--radius); cursor: pointer; }
  .choice:has(input:checked) { border-color: var(--go); background: var(--go-tint); }
  .choice input { margin-top: 4px; accent-color: var(--go); }
  .feats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0 10px; }
  .photos { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
  figure { margin: 0; display: flex; flex-direction: column; gap: 2px; }
  figure img { aspect-ratio: 4 / 3; object-fit: cover; border-radius: 4px; width: 100%; }
  .upload { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 64px; border: 2px dashed var(--line-strong); border-radius: var(--radius); cursor: pointer; font-weight: 700; }
  .upload:hover { border-color: var(--ink); }
  .upload input { position: absolute; opacity: 0; width: 1px; height: 1px; }
  .upload:focus-within { outline: 3px solid #2f7de1; }
  @media (max-width: 640px) { .feats { grid-template-columns: 1fr 1fr; } }
</style>
