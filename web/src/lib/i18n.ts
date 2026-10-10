/**
 * UI strings. Chichewa (ny) leads; English (en) is the fallback. Chichewa copy is a draft and must be
 * reviewed by a native speaker before launch. Tumbuka will be added as a third column in Phase 1.
 */
export type Lang = 'ny' | 'en';
export const normalizeLang = (v: string | undefined | null): Lang => (v === 'en' ? 'en' : 'ny');

const S = {
  nav_find: { ny: 'Pezani mmisiri', en: 'Find a fundi' },
  nav_bookings: { ny: 'Ntchito zanga', en: 'My bookings' },
  nav_become: { ny: 'Lembetsani ngati mmisiri', en: 'Become a fundi' },
  nav_provider: { ny: 'Ntchito zanga (mmisiri)', en: 'Fundi dashboard' },
  nav_admin: { ny: 'Admin', en: 'Admin' },
  nav_signin: { ny: 'Lowani', en: 'Sign in' },
  nav_signout: { ny: 'Tulukani', en: 'Sign out' },
  nav_account: { ny: 'Akaunti', en: 'Account' },

  hero_title: { ny: 'Pezani mmisiri wodalirika pafupi nanu.', en: 'Find a trusted fundi near you.' },
  hero_sub: {
    ny: 'Lipirani ntchito ikatha. Ma plumber, owotcherera, osoka, makaniko ndi ena ku Lilongwe, Blantyre ndi Mzuzu.',
    en: 'Pay only when the job is done. Verified plumbers, welders, tailors, mechanics and more in Lilongwe, Blantyre and Mzuzu.',
  },
  what_need: { ny: 'Mukufuna chiyani?', en: 'What do you need?' },
  where: { ny: 'Kuti?', en: 'Where?' },
  any_trade: { ny: 'Ntchito iliyonse', en: 'Any trade' },
  search: { ny: 'Sakani', en: 'Search' },
  use_my_location: { ny: 'Gwiritsani ntchito malo anga', en: 'Use my location' },
  browse_trades: { ny: 'Sankhani ntchito', en: 'Browse by trade' },
  how_title: { ny: 'Momwe zimagwirira ntchito', en: 'How it works' },
  how_1_t: { ny: 'Pezani', en: 'Find' },
  how_1: { ny: 'Yerekezerani amisiri pafupi: zizindikiro, ndemanga, zithunzi ndi mitengo.', en: 'Compare nearby fundis by badges, reviews, photos of past work and prices.' },
  how_2_t: { ny: 'Bukani, lipirani motetezeka', en: 'Book and pay safely' },
  how_2: { ny: 'Lipirani ndi Airtel Money kapena TNM Mpamba. Fundi imasunga ndalama mpaka ntchito itatha.', en: 'Pay by Airtel Money or TNM Mpamba. Fundi holds the money until the job is done.' },
  how_3_t: { ny: 'Tsimikizani, perekani ndemanga', en: 'Confirm and rate' },
  how_3: { ny: 'Tsimikizani ntchito, mmisiri alipidwa, ndipo ndemanga yanu imathandiza ena.', en: 'Confirm the work, the fundi gets paid, and your rating helps the next customer.' },
  cta_title: { ny: 'Ndinu mmisiri? Lowani kwaulere.', en: 'Are you a fundi? Join free.' },
  cta_sub: { ny: 'Pezani ntchito pafupi nanu ndi malipiro otsimikizika.', en: 'Get jobs near you and guaranteed payment.' },

  results_within: { ny: 'mkati mwa', en: 'within' },
  no_results: { ny: 'Palibe amisiri pano pakali pano.', en: 'No fundis found here yet.' },
  no_results_sub: { ny: 'Yesani ntchito ina kapena dera lina.', en: 'Try another trade or area, or remove filters.' },
  verified_only: { ny: 'Otsimikizidwa okha', en: 'Verified only' },
  available_today: { ny: 'Alipo lero', en: 'Available today' },
  home_visit: { ny: 'Amabwera kunyumba', en: 'Home visits' },
  from_price: { ny: 'Kuyambira', en: 'From' },
  ask_quote: { ny: 'Funsani mtengo', en: 'Ask for a quote' },
  book: { ny: 'Bukani', en: 'Book' },
  view: { ny: 'Onani', en: 'View' },
  reviews: { ny: 'ndemanga', en: 'reviews' },
  jobs: { ny: 'ntchito', en: 'jobs' },
  years: { ny: 'zaka', en: 'years' },
  new_fundi: { ny: 'Watsopano', en: 'New' },
  services: { ny: 'Ntchito ndi mitengo', en: 'Services and prices' },
  something_else: { ny: 'China', en: 'Something else' },
  works_within: { ny: 'Amagwira mkati mwa', en: 'Works within' },
  phone_hidden: { ny: 'Nambala ya foni imaoneka mukabuka', en: 'Phone number shows once your booking is accepted' },

  badge_trusted: { ny: 'Fundi Trusted', en: 'Fundi Trusted' },
  badge_id: { ny: 'ID yatsimikizidwa', en: 'ID verified' },
  badge_basic: { ny: 'Foni yatsimikizidwa', en: 'Phone verified' },

  when: { ny: 'Liti?', en: 'When?' },
  today: { ny: 'Lero', en: 'Today' },
  tomorrow: { ny: 'Mawa', en: 'Tomorrow' },
  morning: { ny: 'M\'mawa', en: 'Morning' },
  afternoon: { ny: 'Masana', en: 'Afternoon' },
  evening: { ny: 'Madzulo', en: 'Evening' },
  landmark: { ny: 'Chizindikiro pafupi ndi nyumba yanu', en: 'Landmark near your home' },
  describe_job: { ny: 'Fotokozani ntchito', en: 'Describe the job' },
  escrow_title: { ny: 'Ndalama zanu zili bwino ndi Fundi', en: 'Your money is safe with Fundi' },
  escrow_body: { ny: 'Timalipira mmisiri mukangotsimikiza kuti ntchito yatha.', en: 'We pay the fundi only after you confirm the job is done.' },
  pay_direct: { ny: 'Ndilipira mmisiri ndekha', en: 'I will pay the fundi directly' },
  send_request: { ny: 'Tumizani', en: 'Send booking' },
  pay_with: { ny: 'Lipirani ndi', en: 'Pay with' },
  pay_now: { ny: 'Lipirani', en: 'Pay' },
  pin_prompt: { ny: 'Mulandira uthenga wolowetsa PIN pa foni yanu', en: 'You will get a PIN prompt on your phone' },
  waiting_payment: { ny: 'Tikudikira kuti mulowetse PIN...', en: 'Waiting for you to approve with your PIN...' },

  st_requested: { ny: 'Yatumizidwa', en: 'Waiting for fundi' },
  st_quoted: { ny: 'Mtengo wafika', en: 'Quote received' },
  st_accepted: { ny: 'Yavomerezedwa', en: 'Accepted' },
  st_paid: { ny: 'Yalipidwa', en: 'Paid, money held' },
  st_in_progress: { ny: 'Ikuchitika', en: 'In progress' },
  st_completed: { ny: 'Mmisiri wamaliza', en: 'Marked done' },
  st_confirmed: { ny: 'Yatha', en: 'Completed' },
  st_disputed: { ny: 'Pali vuto', en: 'Problem reported' },
  st_cancelled: { ny: 'Yathetsedwa', en: 'Cancelled' },
  st_expired: { ny: 'Nthawi yatha', en: 'Expired' },
  st_refunded: { ny: 'Ndalama zabwezedwa', en: 'Refunded' },

  login_title: { ny: 'Lowani ndi nambala ya foni', en: 'Sign in with your phone number' },
  phone: { ny: 'Nambala ya foni', en: 'Phone number' },
  send_code: { ny: 'Tumizani khodi', en: 'Send code' },
  code: { ny: 'Khodi ya manambala 6', en: '6-digit code' },
  verify: { ny: 'Pitirizani', en: 'Continue' },
  use_pin: { ny: 'Lowani ndi PIN', en: 'Sign in with PIN' },
  use_code: { ny: 'Lowani ndi khodi ya SMS', en: 'Sign in with an SMS code' },
  pin: { ny: 'PIN ya manambala 4', en: '4-digit PIN' },
  set_pin: { ny: 'Ikani PIN', en: 'Set a PIN' },
  continue: { ny: 'Pitirizani', en: 'Continue' },
  save: { ny: 'Sungani', en: 'Save' },
  cancel: { ny: 'Lekani', en: 'Cancel' },
  back: { ny: 'Bwererani', en: 'Back' },
};

export type Key = keyof typeof S;
export function t(lang: Lang, key: Key): string {
  return S[key][lang] ?? S[key].en;
}

export function catName(lang: Lang, c: { name_ny?: string; name_en?: string; category_name_ny?: string; category_name_en?: string }) {
  return lang === 'ny' ? c.name_ny ?? c.category_name_ny ?? c.name_en ?? '' : c.name_en ?? c.category_name_en ?? '';
}
