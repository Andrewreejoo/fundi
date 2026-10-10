<script lang="ts">
  import { mwk } from '$lib/format';
  let { data } = $props();
  const s = $derived(data.settings);
  const hold = $derived(s.reservationHoldHours / 24);
</script>

<svelte:head><title>How it works · GalimotoYanga</title></svelte:head>

<div class="narrow page stack prose" style="--gap:18px">
  <h1>How buying and renting works</h1>
  <p class="lead">Every car on GalimotoYanga is already in Malawi. No shipping, no waiting at the border, no surprise duty bill. You can see it, drive it and take it home.</p>

  <section class="panel stack">
    <h2>Buying a car</h2>
    <ol class="steps">
      <li><strong>Find a car.</strong> Filter by make, price, year, body type and district. Every listing has a stock number (like GM10001) you can quote to the seller.</li>
      <li><strong>Ask questions.</strong> Sign in to see the seller's number, call or WhatsApp them, or send a message through GalimotoYanga.</li>
      <li><strong>Reserve it with a deposit.</strong> Pay {s.depositPercent}% of the price (at least {mwk(s.depositMinMwk)}, at most {mwk(s.depositMaxMwk)}) by Airtel Money or TNM Mpamba. The car is taken off the market for {hold} days so nobody buys it while you travel to see it.</li>
      <li><strong>Inspect and test-drive.</strong> Check the car, the logbook (blue book) and the certificate of fitness. Make sure the name on the logbook matches the seller or that the dealer has authority to sell.</li>
      <li><strong>Buy it, or walk away.</strong> If you buy, pay the seller the balance and tap "I bought the car". The deposit counts toward the price. If the car is not as described, report a problem and we refund the deposit after checking. If neither of you acts within {hold} days, the reservation lapses and your deposit is refunded in full.</li>
    </ol>
    <p class="small muted">Change of ownership is done at the Directorate of Road Traffic and Safety Services (DRTSS). GalimotoYanga doesn't handle the logbook transfer itself.</p>
  </section>

  <section class="panel stack">
    <h2>Hiring a car</h2>
    <ol class="steps">
      <li><strong>Pick dates.</strong> Search the Rent tab with your dates; only cars free for every day are shown.</li>
      <li><strong>Self-drive or with a driver.</strong> Many owners offer a driver for a daily charge. Self-drive needs a valid driving licence, shown at pick-up.</li>
      <li><strong>Pay up front.</strong> The full hire is paid by mobile money and held by GalimotoYanga. Your dates are blocked for you straight away.</li>
      <li><strong>Drive.</strong> When the car is back, the owner marks it returned. You confirm, or it completes automatically after {s.autoCompleteHours / 24} days, and the owner is paid.</li>
    </ol>
    <p class="small muted">Cancel before your start date for a full refund. Fuel, mileage limits and deposits for damage are agreed with the owner.</p>
  </section>

  <section class="panel stack">
    <h2>Selling or hiring out</h2>
    <p>Listing is free. GalimotoYanga keeps {s.saleFeePercent}% of the price when a car sells through a reservation (taken from the deposit), and {s.rentalCommissionPercent}% of each rental. Money is paid to your mobile money wallet when the deal is done. <a href="/sell">Start selling</a>.</p>
  </section>

  <section class="panel stack">
    <h2>Staying safe</h2>
    <ul>
      <li>Never send money outside GalimotoYanga before you have seen the car.</li>
      <li>Meet in a public place in daylight, or at the dealer's yard.</li>
      <li>Check that the chassis and engine numbers match the logbook.</li>
      <li>GalimotoYanga staff will never ask for your mobile money PIN.</li>
    </ul>
  </section>
</div>

<style>
  h1 { font-family: var(--font-cond); font-size: 36px; }
  .lead { font-size: 17px; }
  .steps { margin: 0; padding-left: 22px; display: flex; flex-direction: column; gap: 10px; }
  ul { margin: 0; padding-left: 20px; }
</style>
