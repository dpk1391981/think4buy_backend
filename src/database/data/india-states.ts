/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  india-states.ts — state/UT → 2-letter code for seed:india-cities
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  `cities.state_id` is NOT NULL, so every city in india-cities.ts needs a
 *  states row before it can be written. Codes for the 22 states already in the
 *  database are copied from those rows verbatim — a different code here would
 *  create a second row for a state we already have.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const INDIA_STATE_CODES: Record<string, string> = {
  // Already present in the database — codes must match what is there.
  'Andhra Pradesh':  'AP',
  'Assam':           'AS',
  'Bihar':           'BR',
  'Chhattisgarh':    'CG',
  'Delhi':           'DL',
  'Goa':             'GA',
  'Gujarat':         'GJ',
  'Haryana':         'HR',
  'Himachal Pradesh':'HP',
  'Jharkhand':       'JH',
  'Karnataka':       'KA',
  'Kerala':          'KL',
  'Madhya Pradesh':  'MP',
  'Maharashtra':     'MH',
  'Odisha':          'OD',
  'Punjab':          'PB',
  'Rajasthan':       'RJ',
  'Tamil Nadu':      'TN',
  'Telangana':       'TS',
  'Uttar Pradesh':   'UP',
  'Uttarakhand':     'UK',
  'West Bengal':     'WB',

  // Created by the seed on first run.
  'Andaman and Nicobar Islands': 'AN',
  'Arunachal Pradesh':           'AR',
  'Chandigarh':                  'CH',
  'Dadra and Nagar Haveli and Daman and Diu': 'DN',
  'Jammu and Kashmir':           'JK',
  'Ladakh':                      'LA',
  'Manipur':                     'MN',
  'Meghalaya':                   'ML',
  'Mizoram':                     'MZ',
  'Nagaland':                    'NL',
  'Puducherry':                  'PY',
  'Sikkim':                      'SK',
  'Tripura':                     'TR',
};
