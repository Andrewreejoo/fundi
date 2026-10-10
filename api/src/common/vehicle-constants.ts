/** Fixed vocabularies shared with the website (served at GET /catalog). */
export const BODY_TYPES = [
  { slug: 'sedan', name: 'Sedan' },
  { slug: 'hatchback', name: 'Hatchback' },
  { slug: 'suv', name: 'SUV' },
  { slug: 'pickup', name: 'Pickup' },
  { slug: 'minibus', name: 'Minivan / Minibus' },
  { slug: 'wagon', name: 'Station wagon' },
  { slug: 'van', name: 'Van' },
  { slug: 'truck', name: 'Truck' },
  { slug: 'bus', name: 'Bus' },
  { slug: 'coupe', name: 'Coupe' },
] as const;

export const FEATURES = [
  { slug: 'air_conditioning', name: 'Air conditioning' },
  { slug: 'power_steering', name: 'Power steering' },
  { slug: 'power_windows', name: 'Power windows' },
  { slug: 'central_locking', name: 'Central locking' },
  { slug: 'abs', name: 'ABS' },
  { slug: 'airbags', name: 'Airbags' },
  { slug: 'alloy_wheels', name: 'Alloy wheels' },
  { slug: 'navigation', name: 'Navigation' },
  { slug: 'reverse_camera', name: 'Reverse camera' },
  { slug: 'bluetooth', name: 'Bluetooth / USB' },
  { slug: 'leather_seats', name: 'Leather seats' },
  { slug: 'sunroof', name: 'Sunroof' },
  { slug: 'keyless_entry', name: 'Keyless entry' },
  { slug: 'push_start', name: 'Push start' },
  { slug: 'cruise_control', name: 'Cruise control' },
  { slug: 'fog_lights', name: 'Fog lights' },
  { slug: 'roof_rails', name: 'Roof rails' },
  { slug: 'third_row_seats', name: 'Third row seats' },
  { slug: 'sliding_doors', name: 'Power sliding doors' },
  { slug: 'tow_bar', name: 'Tow bar' },
  { slug: 'new_tyres', name: 'New tyres' },
  { slug: 'service_history', name: 'Service history' },
] as const;

export const FEATURE_SLUGS: string[] = FEATURES.map((f) => f.slug);
export const BODY_SLUGS: string[] = BODY_TYPES.map((b) => b.slug);
