// Fallback defaults (browser preview). In Wallpaper Engine use wallpaper settings.

window.DASHBOARD_WEATHER_CITIES = {
  sao_paulo: { label: 'Sao Paulo', lat: -23.55, lon: -46.63 },
  moscow: { label: 'Moscow', lat: 55.76, lon: 37.62 },
  spb: { label: 'Saint Petersburg', lat: 59.93, lon: 30.32 },
  kyiv: { label: 'Kyiv', lat: 50.45, lon: 30.52 },
  london: { label: 'London', lat: 51.51, lon: -0.13 },
  paris: { label: 'Paris', lat: 48.86, lon: 2.35 },
  berlin: { label: 'Berlin', lat: 52.52, lon: 13.41 },
  dubai: { label: 'Dubai', lat: 25.2, lon: 55.27 },
  delhi: { label: 'Delhi', lat: 28.61, lon: 77.23 },
  bangkok: { label: 'Bangkok', lat: 13.76, lon: 100.5 },
  tokyo: { label: 'Tokyo', lat: 35.68, lon: 139.69 },
  shanghai: { label: 'Shanghai', lat: 31.23, lon: 121.47 },
  sydney: { label: 'Sydney', lat: -33.87, lon: 151.21 },
  new_york: { label: 'New York', lat: 40.71, lon: -74.01 },
  chicago: { label: 'Chicago', lat: 41.88, lon: -87.63 },
  los_angeles: { label: 'Los Angeles', lat: 34.05, lon: -118.24 },
  vladivostok: { label: 'Vladivostok', lat: 43.12, lon: 131.89 },
  yekaterinburg: { label: 'Yekaterinburg', lat: 56.84, lon: 60.6 },
  komsomolsk: { label: 'Komsomolsk-on-Amur', lat: 50.55, lon: 137.01 }
};

// Timezone (Clock settings) -> weather city key
window.DASHBOARD_TZ_WEATHER = {
  'America/Sao_Paulo': 'sao_paulo',
  'Europe/London': 'london',
  'Europe/Paris': 'paris',
  'Europe/Moscow': 'moscow',
  'Europe/Berlin': 'berlin',
  'Asia/Dubai': 'dubai',
  'Asia/Kolkata': 'delhi',
  'Asia/Bangkok': 'bangkok',
  'Asia/Tokyo': 'tokyo',
  'Asia/Shanghai': 'shanghai',
  'Australia/Sydney': 'sydney',
  'America/New_York': 'new_york',
  'America/Chicago': 'chicago',
  'America/Los_Angeles': 'los_angeles',
  'Asia/Vladivostok': 'komsomolsk',
  UTC: 'london'
};

window.DASHBOARD_CONFIG = {
  clocks: [
    { id: 0, label: 'SP', tz: 'America/Sao_Paulo' },
    { id: 1, label: 'TOKYO', tz: 'Asia/Tokyo' },
    { id: 2, label: 'PARIS', tz: 'Europe/Paris' }
  ],
  timers: [
    { id: 0, label: 'Birthday', date: '2026-12-31' },
    { id: 1, label: 'NEW YEAR', date: '2027-01-01' },
    { id: 2, label: 'Custom', date: '2026-06-01' }
  ],
  statsPollMs: 1500,
  barWidth: 16,
  audioGain: 2.8,
  localClockShow: true,
  weatherShow: true,
  weatherCity: 'komsomolsk',
  weatherCoords: '50.55, 137.01',
  sectionLang: 'ru'
};
