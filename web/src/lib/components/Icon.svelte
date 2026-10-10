<script lang="ts">
  let { name, size = 20, label }: { name: string; size?: number; label?: string } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"
  role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'}>
  {#if name === 'search'}<circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" />
  {:else if name === 'heart'}<path d="M12 20s-7-4.4-9-9a5 5 0 019-3 5 5 0 019 3c-2 4.6-9 9-9 9z" />
  {:else if name === 'heart-fill'}<path d="M12 20s-7-4.4-9-9a5 5 0 019-3 5 5 0 019 3c-2 4.6-9 9-9 9z" fill="currentColor" />
  {:else if name === 'chat'}<path d="M4 5h16v11H9l-5 4z" />
  {:else if name === 'phone'}<path d="M5 4h4l2 5-3 2a11 11 0 005 5l2-3 5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />
  {:else if name === 'whatsapp'}<path d="M4 20l1.3-4A8 8 0 1112 20a8 8 0 01-4-1z" /><path d="M9 9c0 3 3 6 6 6l1-1.5-2-1-1 1c-1 0-2.5-1.5-2.5-2.5l1-1-1-2z" />
  {:else if name === 'pin'}<path d="M12 21s-7-6-7-11a7 7 0 0114 0c0 5-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" />
  {:else if name === 'gauge'}<path d="M4 17a8 8 0 1116 0" /><path d="M12 17l4-5" />
  {:else if name === 'calendar'}<rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" />
  {:else if name === 'gear'}<circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
  {:else if name === 'fuel'}<path d="M5 20V5a1 1 0 011-1h7a1 1 0 011 1v15M4 20h11M14 9h2a2 2 0 012 2v5a1.5 1.5 0 003 0V8l-3-3" /><path d="M7 8h5" />
  {:else if name === 'shield'}<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" />
  {:else if name === 'check'}<path d="M5 12l5 5L20 7" />
  {:else if name === 'x'}<path d="M6 6l12 12M18 6L6 18" />
  {:else if name === 'compare'}<path d="M8 4v16M16 4v16M4 8h4M16 16h4" />
  {:else if name === 'key'}<circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l2 2M15 8l2 2" />
  {:else if name === 'user'}<circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
  {:else if name === 'car'}<path d="M3 15l2-6h14l2 6v3H3z" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" />
  {:else if name === 'back'}<path d="M15 5l-7 7 7 7" />
  {:else if name === 'next'}<path d="M9 5l7 7-7 7" />
  {:else if name === 'filter'}<path d="M4 6h16M7 12h10M10 18h4" />
  {:else if name === 'seat'}<path d="M7 4v9h10M7 13l-1 7M17 13v7M7 9h8" />
  {:else if name === 'share'}<circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.2 11l7.6-4M8.2 13l7.6 4" />
  {:else if name === 'alert'}<path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17v.5" />
  {:else if name === 'store'}<path d="M4 9l2-5h12l2 5M4 9v11h16V9M4 9h16M9 20v-6h6v6" />
  {:else if name === 'menu'}<path d="M4 7h16M4 12h16M4 17h16" />
  {:else}<circle cx="12" cy="12" r="8" />
  {/if}
</svg>
