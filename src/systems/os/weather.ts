import { FEELS_COUNT, FORECASTS } from '../../data/os/weather';
import type { WeatherIcon } from '../../gfx/osArt';
import { hashSeed, Rng } from '../rng/rng';

export interface DayWeather {
  day: number;
  id: string;
  symbol: WeatherIcon;
  /** Temperatur in °C. */
  temp: number;
  /** Prozentwert für Texte wie „80 % Raketenwahrscheinlichkeit“. */
  chance: number;
  /** Index der „gefühlt …“-Zeile. */
  feels: number;
}

/**
 * Wetter eines Arbeitstags: fest pro Tag (die Vorhersage von gestern stimmt also heute),
 * nie zweimal hintereinander dieselbe Lage.
 */
export function weatherOn(day: number): DayWeather {
  let prev = -1;
  let result: DayWeather | null = null;
  for (let d = 1; d <= Math.max(1, day); d++) {
    const rng = new Rng(hashSeed(`wetter-${d}`));
    let idx = rng.int(0, FORECASTS.length - 1);
    if (idx === prev) idx = (idx + 1) % FORECASTS.length;
    prev = idx;
    if (d === Math.max(1, day)) {
      const f = FORECASTS[idx]!;
      result = { day: d, id: f.id, symbol: f.symbol, temp: rng.int(-5, 38), chance: rng.int(4, 19) * 5, feels: rng.int(0, FEELS_COUNT - 1) };
    }
  }
  return result!;
}

/** Vorhersage ab `day` für `count` Tage. */
export function forecast(day: number, count = 3): DayWeather[] {
  return Array.from({ length: count }, (_, i) => weatherOn(day + i));
}
