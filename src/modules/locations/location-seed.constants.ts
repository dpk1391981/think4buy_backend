export const LOCATION_SEED_QUEUE = 'location-seed';

export const SEED_JOB = {
  DISPATCH: 'seed:dispatch',
  CITY:     'seed:city',
} as const;

export interface SeedDispatchJobData {
  file:        string;   // partial filename filter — default 'all_city_locality'
  dryRun:      boolean;
  geocode:     boolean;
  forceGeo:    boolean;
  triggeredBy: string;   // admin user id
}

export interface SeedCityJobData {
  dispatchJobId: string;
  cityName:      string;
  state:         string;
  stateCode:     string;
  slug:          string;
  imageUrl?:     string;
  isFeatured:    boolean;
  localities:    string[];
  geocode:       boolean;
  forceGeo:      boolean;
  dryRun:        boolean;
}

export interface SeedDispatchProgress {
  dispatched: number;
  total:      number;
  cityJobIds: string[];
}
