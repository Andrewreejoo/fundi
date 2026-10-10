<script lang="ts">
  import { page } from '$app/state';
  let { children } = $props();
  const links = [
    ['/admin', 'Overview'],
    ['/admin/verifications', 'Verification queue'],
    ['/admin/listings', 'Listings'],
    ['/admin/disputes', 'Disputes'],
    ['/admin/payments', 'Payments'],
    ['/admin/users', 'Users'],
  ];
</script>

<div class="admin">
  <nav aria-label="Admin">
    <div class="brand">fundi <span>admin</span></div>
    {#each links as [href, label]}
      <a {href} aria-current={page.url.pathname === href ? 'page' : undefined}>{label}</a>
    {/each}
  </nav>
  <div class="content">{@render children()}</div>
</div>

<style>
  .admin { display: flex; flex-wrap: wrap; min-height: 80vh; background: #f4f1ea; }
  nav { flex: 1 1 200px; max-width: 240px; background: #12201a; padding: 20px 12px; display: flex; flex-direction: column; gap: 2px; }
  .brand { color: #fff; font-weight: 700; font-size: 22px; padding: 0 10px 14px; }
  .brand span { font-weight: 400; font-size: 13px; color: #9db8a8; }
  nav a { color: #e6efe9; padding: 10px; border-radius: 10px; text-decoration: none; font-size: 15px; }
  nav a:hover { background: #1f3a2c; color: #fff; }
  nav a[aria-current='page'] { background: #1f3a2c; color: #fff; font-weight: 700; }
  .content { flex: 999 1 560px; min-width: 0; padding: 24px; display: flex; flex-direction: column; gap: 18px; }
  @media (max-width: 760px) {
    nav { max-width: none; flex-direction: row; overflow-x: auto; padding: 10px; }
    .brand { display: none; }
    nav a { white-space: nowrap; }
  }
</style>
