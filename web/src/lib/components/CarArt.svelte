<script lang="ts">
  /**
   * Side-profile outline of a car body type, painted in the car's colour. Shown when a listing has no photo,
   * so a listing never shows a picture of a different car.
   */
  let { body = 'sedan', color = 'Silver', label }: { body?: string; color?: string | null; label?: string } = $props();

  const PAINT: [RegExp, string][] = [
    [/white|pearl/i, '#f3f4f5'], [/black/i, '#2b2e33'], [/silver/i, '#c3c8ce'], [/gr[ae]y/i, '#7e858d'],
    [/red/i, '#b3302a'], [/blue/i, '#2f5d9c'], [/green/i, '#3d7550'], [/pink/i, '#d98aa8'], [/bronze|brown|gold/i, '#8a6a43'],
    [/yellow/i, '#e2b52b'], [/orange/i, '#d06a2a'],
  ];
  const paint = $derived(PAINT.find(([re]) => re.test(color ?? ''))?.[1] ?? '#a9afb6');
  const dark = $derived(['#2b2e33', '#7e858d', '#2f5d9c', '#3d7550', '#8a6a43', '#b3302a'].includes(paint));

  // Body outline, window band and wheel centres per body type (viewBox 0 0 240 110, ground at y=92).
  const SHAPES: Record<string, { body: string; glass: string; wheels: [number, number] }> = {
    sedan: { body: 'M12 80 L14 66 Q18 58 34 56 L72 53 L94 36 Q100 31 112 31 L148 31 Q158 31 166 38 L184 53 L214 56 Q227 58 229 68 L230 80 Q230 84 225 84 L16 84 Q11 84 12 80 Z',
             glass: 'M80 53 L98 39 Q103 36 112 36 L126 36 L126 53 Z M131 36 L146 36 Q154 36 160 41 L174 53 L131 53 Z', wheels: [62, 182] },
    hatchback: { body: 'M18 80 L20 66 Q24 59 40 57 L70 54 L92 36 Q99 31 112 31 L176 31 Q188 31 194 42 L202 60 Q208 64 210 70 L211 80 Q211 84 206 84 L22 84 Q17 84 18 80 Z',
             glass: 'M78 54 L96 40 Q101 36 110 36 L136 36 L136 54 Z M141 36 L172 36 Q182 36 186 44 L192 54 L141 54 Z', wheels: [62, 172] },
    suv: { body: 'M12 82 L13 62 Q15 54 30 52 L60 49 L80 28 Q86 22 98 22 L196 22 Q210 22 214 34 L222 56 Q228 60 229 68 L230 82 Q230 86 225 86 L16 86 Q11 86 12 82 Z',
             glass: 'M68 49 L84 31 Q89 27 98 27 L132 27 L132 49 Z M137 27 L170 27 L170 49 L137 49 Z M175 27 L196 27 Q206 27 209 36 L213 49 L175 49 Z', wheels: [60, 186] },
    pickup: { body: 'M10 82 L11 62 Q13 55 28 53 L56 50 L74 30 Q80 24 92 24 L134 24 Q142 24 144 32 L146 52 L228 52 Q232 52 232 58 L232 82 Q232 86 227 86 L14 86 Q9 86 10 82 Z',
             glass: 'M64 50 L78 33 Q83 29 92 29 L108 29 L108 50 Z M113 29 L132 29 Q138 29 139 35 L141 50 L113 50 Z', wheels: [56, 190] },
    minibus: { body: 'M14 82 L14 62 Q16 54 26 50 L50 34 Q60 20 78 18 L206 18 Q220 18 222 32 L226 82 Q226 86 221 86 L18 86 Q13 86 14 82 Z',
             glass: 'M56 36 Q64 24 78 23 L104 23 L104 46 L44 46 Z M109 23 L150 23 L150 46 L109 46 Z M155 23 L196 23 L196 46 L155 46 Z M201 23 L208 23 Q216 23 217 32 L218 46 L201 46 Z', wheels: [58, 186] },
    van: { body: 'M12 82 L12 60 Q14 52 24 48 L44 30 Q54 18 72 18 L218 18 Q228 18 228 28 L228 82 Q228 86 223 86 L16 86 Q11 86 12 82 Z',
             glass: 'M50 32 Q58 23 72 23 L96 23 L96 44 L38 44 Z', wheels: [56, 188] },
    wagon: { body: 'M12 80 L14 66 Q18 58 34 56 L68 53 L90 35 Q97 30 110 30 L206 30 Q216 30 220 40 L226 56 Q229 60 229 68 L230 80 Q230 84 225 84 L16 84 Q11 84 12 80 Z',
             glass: 'M76 53 L94 39 Q100 35 110 35 L134 35 L134 53 Z M139 35 L174 35 L174 53 L139 53 Z M179 35 L204 35 Q212 35 215 43 L219 53 L179 53 Z', wheels: [62, 186] },
    truck: { body: 'M10 84 L10 50 Q10 34 24 32 L36 18 Q40 14 48 14 L74 14 Q80 14 80 20 L80 44 L232 44 L232 84 Q232 88 227 88 L14 88 Q9 88 10 84 Z',
             glass: 'M40 22 Q43 19 48 19 L70 19 Q75 19 75 24 L75 40 L28 40 Z', wheels: [44, 196] },
    bus: { body: 'M8 82 L8 26 Q8 16 20 16 L224 16 Q232 16 232 26 L232 82 Q232 86 227 86 L13 86 Q8 86 8 82 Z',
             glass: 'M14 22 L44 22 L44 50 L14 50 Z M50 22 L90 22 L90 46 L50 46 Z M95 22 L135 22 L135 46 L95 46 Z M140 22 L180 22 L180 46 L140 46 Z M185 22 L225 22 L225 46 L185 46 Z', wheels: [52, 192] },
  };
  const s = $derived(SHAPES[body] ?? SHAPES[body === 'coupe' ? 'sedan' : 'sedan']);
</script>

<svg viewBox="0 0 240 110" role="img" aria-label={label ?? `${color ?? ''} ${body} (no photo yet)`} class="art">
  <rect width="240" height="110" fill="#e9ecef" />
  <line x1="0" y1="99" x2="240" y2="99" stroke="#d3d8de" stroke-width="2" />
  <path d={s.body} fill={paint} stroke={dark ? '#1c1f23' : '#8d949c'} stroke-width="1.5" />
  <path d={s.glass} fill={dark ? '#5d6670' : '#7d8a97'} opacity="0.85" />
  {#each s.wheels as x}
    <circle cx={x} cy="88" r="14" fill="#23262a" />
    <circle cx={x} cy="88" r="6.5" fill="#9aa1a8" />
  {/each}
</svg>

<style>
  .art { width: 100%; height: 100%; display: block; }
</style>
