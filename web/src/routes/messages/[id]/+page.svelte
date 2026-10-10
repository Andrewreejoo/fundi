<script lang="ts">
  import { enhance } from '$app/forms';
  import { carTitle, dateTime, localPhone, mwk, whatsapp } from '$lib/format';
  import CarPhoto from '$lib/components/CarPhoto.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import Plate from '$lib/components/Plate.svelte';

  let { data, form } = $props();
  const t = $derived(data.t);
  const otherName = $derived(t.role === 'buyer' ? t.seller_name : t.buyer_name);
  const otherPhone = $derived(t.role === 'buyer' ? t.seller_phone : t.buyer_phone);
  let text = $state('');
</script>

<svelte:head><title>{otherName} · Messages · Galimoto</title></svelte:head>

<div class="narrow page stack" style="--gap:12px">
  <a href="/messages" class="small"><Icon name="back" size={15} /> All messages</a>
  {#if data.sent}<p class="alert ok">Message sent. You will get an SMS when {otherName} replies.</p>{/if}
  {#if form?.error}<p class="alert error">{form.error}</p>{/if}

  <a class="car panel" href={`/cars/${t.stock_no}`}>
    <div class="ph"><CarPhoto id={t.photo_id} fileBase={data.fileBase} body={t.body_type} color={t.color} alt={carTitle(t)} /></div>
    <div class="stack" style="--gap:2px">
      <strong>{carTitle(t)}</strong>
      <span class="row small" style="--gap:6px"><Plate text={t.stock_no} size="sm" /><span class="price">{t.purpose === 'rent' ? `${mwk(t.daily_rate_mwk)}/day` : mwk(t.price_mwk)}</span></span>
    </div>
  </a>

  <div class="row between">
    <h1>{otherName}</h1>
    <div class="row" style="--gap:6px">
      <a class="btn sm dark" href={`tel:${otherPhone}`}><Icon name="phone" size={16} /> {localPhone(otherPhone)}</a>
      <a class="btn sm plain" href={whatsapp(otherPhone, `Hello, about the ${carTitle(t)} (${t.stock_no}) on Galimoto.`)} target="_blank" rel="noopener"><Icon name="whatsapp" size={16} /> WhatsApp</a>
    </div>
  </div>

  <ol class="msgs">
    {#each t.messages as m (m.id)}
      <li class:mine={m.mine}><p>{m.body}</p><span class="tiny">{m.mine ? 'You' : otherName}, {dateTime(m.created_at)}</span></li>
    {/each}
  </ol>

  <form method="POST" class="panel stack" style="--gap:8px" use:enhance={() => async ({ update, result }) => { await update(); if (result.type === 'success') text = ''; }}>
    <label class="sr-only" for="reply">Reply</label>
    <textarea id="reply" name="body" bind:value={text} maxlength="2000" required placeholder="Write a reply"></textarea>
    <button class="btn">Send</button>
  </form>
</div>

<style>
  .car { display: grid; grid-template-columns: 110px minmax(0, 1fr); gap: 12px; color: var(--ink); text-decoration: none; align-items: center; }
  .ph { border-radius: 4px; overflow: hidden; }
  .msgs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .msgs li { max-width: 80%; background: var(--surface); border: 1px solid var(--line); border-radius: 10px 10px 10px 2px; padding: 8px 12px; }
  .msgs li.mine { align-self: flex-end; background: #fff6cc; border-color: #ecd786; border-radius: 10px 10px 2px 10px; }
  .msgs p { white-space: pre-line; }
  .msgs span { color: var(--muted); }
</style>
