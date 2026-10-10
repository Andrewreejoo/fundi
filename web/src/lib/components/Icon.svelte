<script lang="ts">
  /** Simple stroke icons. Category icons match the API's `icon` field. */
  let { name, size = 24, label }: { name: string; size?: number; label?: string } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.9"
  stroke-linecap="round"
  stroke-linejoin="round"
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
>
  {#if name === 'droplet'}<path d="M12 3c-4 5-6 8-6 11a6 6 0 0012 0c0-3-2-6-6-11z" />
  {:else if name === 'bolt'}<path d="M13 2L5 14h6l-1 8 8-12h-6z" />
  {:else if name === 'flame'}<path d="M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-3 2-4 2-6 1 1 2 2 3 2 0-2-1-4 0-6z" />
  {:else if name === 'hammer'}<path d="M14 4l6 6-3 3-6-6z" /><path d="M11 9L4 20" />
  {:else if name === 'bricks'}<rect x="3" y="5" width="18" height="14" rx="1" /><path d="M3 10h18M3 15h18M9 5v5M15 10v5M9 15v4" />
  {:else if name === 'scissors'}<circle cx="6" cy="18" r="3" /><circle cx="18" cy="18" r="3" /><path d="M8 16L18 4M16 16L6 4" />
  {:else if name === 'comb'}<rect x="4" y="7" width="16" height="4" rx="1" /><path d="M6 11v7M9 11v7M12 11v7M15 11v7M18 11v7" />
  {:else if name === 'car'}<path d="M3 15l2-6h14l2 6v3H3z" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" />
  {:else if name === 'basket'}<path d="M4 10h16l-2 9H6z" /><path d="M8 10l4-6 4 6" />
  {:else if name === 'phone'}<rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 18h2" />
  {:else if name === 'pin'}<path d="M12 21s-7-6-7-11a7 7 0 0114 0c0 5-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" />
  {:else if name === 'search'}<circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" />
  {:else if name === 'shield'}<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" />
  {:else if name === 'check'}<path d="M5 12l5 5L20 7" />
  {:else if name === 'star'}<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" />
  {:else if name === 'call'}<path d="M5 4h4l2 5-3 2a11 11 0 005 5l2-3 5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />
  {:else if name === 'back'}<path d="M15 5l-7 7 7 7" />
  {:else if name === 'user'}<circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
  {:else if name === 'calendar'}<rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" />
  {:else if name === 'briefcase'}<rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V4h6v3" />
  {:else if name === 'home'}<path d="M4 11l8-7 8 7v9H4z" />
  {:else if name === 'more'}<circle cx="6" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="18" cy="12" r="1.5" />
  {:else if name === 'alert'}<path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17v.5" />
  {:else}<circle cx="12" cy="12" r="8" />
  {/if}
</svg>
