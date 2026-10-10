import type { WeatherIcon } from '../../gfx/osArt';

/** Wetter-App: Gag-Vorhersagen (i18n unter os.weather.forecast.<id>, Parameter {chance}) mit Symbol. */
export const FORECASTS: readonly { id: string; symbol: WeatherIcon }[] = [
  { id: 'rockets', symbol: 'rocket' },
  { id: 'rage', symbol: 'sun' },
  { id: 'paper', symbol: 'rain' },
  { id: 'coffee', symbol: 'fog' },
  { id: 'quota', symbol: 'sun' },
  { id: 'police', symbol: 'cloud' },
  { id: 'pigeons', symbol: 'cloud' },
  { id: 'clear', symbol: 'sun' },
  { id: 'staplers', symbol: 'storm' },
  { id: 'calm', symbol: 'fog' },
];

/** Anzahl der „gefühlt …“-Zeilen (i18n os.weather.feels.<n>). */
export const FEELS_COUNT = 6;
