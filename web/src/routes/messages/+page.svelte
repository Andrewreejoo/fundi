<script lang="ts">
  import { carTitle, dateTime } from '$lib/format';
  import CarPhoto from '$lib/components/CarPhoto.svelte';
  let { data } = $props();
</script>

<svelte:head><title>Messages · GalimotoYanga</title></svelte:head>

<div class="narrow page stack">
  <h1>Messages</h1>
  {#each data.threads as t (t.id)}
    <a class="thread" class:unread={t.unread > 0} href={`/messages/${t.id}`}>
      <div class="ph"><CarPhoto id={t.photo_id} fileBase={data.fileBase} body={t.body_type} color={t.color} alt={carTitle(t)} /></div>
      <div class="stack" style="--gap:2px; min-width:0">
        <div class="row between"><strong>{t.other_name}</strong><span class="tiny muted">{dateTime(t.last_message_at)}</span></div>
        <span class="small muted">{t.role === 'buyer' ? 'You asked about' : 'Asking about your'} {carTitle(t)} ({t.stock_no})</span>
        <span class="last">{t.last_message}</span>
      </div>
      {#if t.unread > 0}<span class="badge">{t.unread}</span>{/if}
    </a>
  {:else}
    <div class="panel empty">No messages yet. Use "Ask the seller" on any car to start a conversation.</div>
  {/each}
</div>

<style>
  .thread { position: relative; display: grid; grid-template-columns: 90px minmax(0, 1fr); gap: 12px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 10px; color: var(--ink); text-decoration: none; }
  .thread:hover { border-color: #9aa3ad; text-decoration: none; }
  .thread.unread { border-left: 4px solid var(--plate); }
  .ph { border-radius: 4px; overflow: hidden; }
  .last { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .badge { position: absolute; right: 10px; bottom: 10px; background: #e5533d; color: #fff; border-radius: 10px; font-size: 12px; padding: 0 7px; line-height: 20px; }
</style>
