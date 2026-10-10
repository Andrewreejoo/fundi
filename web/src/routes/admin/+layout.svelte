<script lang="ts">
  import { page } from '$app/state';
  let { children } = $props();
  const links = [
    ['/admin', 'Overview'],
    ['/admin/listings', 'Listings'],
    ['/admin/sellers', 'Sellers'],
    ['/admin/orders', 'Orders and disputes'],
    ['/admin/payments', 'Payments'],
    ['/admin/users', 'Users'],
  ];
</script>

<div class="wrap page admin">
  <nav aria-label="Admin">
    {#each links as [href, label]}
      <a {href} aria-current={page.url.pathname === href ? 'page' : undefined}>{label}</a>
    {/each}
  </nav>
  <div class="content stack" style="--gap:16px">{@render children()}</div>
</div>

<style>
  .admin { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 20px; align-items: start; }
  nav { display: flex; flex-direction: column; gap: 2px; background: var(--asphalt); border-radius: var(--radius); padding: 8px; position: sticky; top: 12px; }
  nav a { color: #e9ebee; padding: 9px 10px; border-radius: 4px; text-decoration: none; font-size: 15px; }
  nav a:hover { background: var(--asphalt-2); }
  nav a[aria-current='page'] { background: var(--plate); color: var(--plate-ink); font-weight: 700; }
  .content :global(h1) { font-family: var(--font-cond); font-size: 30px; }
  .content :global(table) { width: 100%; border-collapse: collapse; background: var(--surface); font-size: 14px; }
  .content :global(th), .content :global(td) { text-align: left; padding: 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
  .content :global(th) { background: var(--sunk); font-weight: 600; }
  .content :global(.tablewrap) { overflow-x: auto; border: 1px solid var(--line); border-radius: var(--radius); }
  .content :global(.filters) { display: flex; gap: 4px; flex-wrap: wrap; }
  .content :global(.filters a) { padding: 5px 10px; border-radius: 999px; border: 1px solid var(--line-strong); color: var(--ink); text-decoration: none; font-size: 14px; background: var(--surface); }
  .content :global(.filters a[aria-current='page']) { background: var(--asphalt); color: #fff; border-color: var(--asphalt); }
  @media (max-width: 800px) {
    .admin { grid-template-columns: 1fr; }
    nav { flex-direction: row; overflow-x: auto; position: static; }
    nav a { white-space: nowrap; }
  }
</style>
