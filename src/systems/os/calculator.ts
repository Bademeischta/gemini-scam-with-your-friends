/**
 * Rechner-Logik von MogelOS (klassischer Taschenrechner ohne Punkt-vor-Strich).
 * Anzeige mit Dezimalkomma; Division durch null ergibt eine freche Fehlermeldung.
 */
export type CalcOp = '+' | '-' | '×' | '÷';
export type CalcKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | ',' | CalcOp | '=' | 'C' | '±' | '⌫';

const MAX_DIGITS = 12;
const DIGITS = new Set(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);

function isDigit(k: CalcKey): k is '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' {
  return DIGITS.has(k);
}

export class Calculator {
  private entry = '0';
  private acc: number | null = null;
  private op: CalcOp | null = null;
  private fresh = true;
  private error: string | null = null;

  constructor(private readonly errorText = 'Nö.') {}

  get display(): string {
    return this.error ?? this.entry;
  }

  press(key: CalcKey): void {
    if (this.error) {
      if (key === 'C' || /[0-9,]/.test(key)) this.reset();
      else return;
    }
    if (isDigit(key)) return this.digit(key);
    switch (key) {
      case ',':
        if (this.fresh) {
          this.entry = '0,';
          this.fresh = false;
        } else if (!this.entry.includes(',')) this.entry += ',';
        return;
      case 'C':
        return this.reset();
      case '⌫':
        if (this.fresh) return;
        this.entry = this.entry.length > 1 && !(this.entry.length === 2 && this.entry.startsWith('-')) ? this.entry.slice(0, -1) : '0';
        return;
      case '±':
        if (this.entry !== '0') this.entry = this.entry.startsWith('-') ? this.entry.slice(1) : `-${this.entry}`;
        return;
      case '=':
        this.apply();
        this.op = null;
        this.acc = null;
        this.fresh = true;
        return;
      default:
        // Operator: offene Rechnung zuerst ausführen (Kettenrechnung).
        if (!this.fresh || this.acc === null) this.apply();
        this.op = key;
        this.acc = this.value();
        this.fresh = true;
    }
  }

  private digit(d: string): void {
    if (this.fresh) {
      this.entry = d;
      this.fresh = false;
      return;
    }
    if (this.entry.replace(/[-,]/g, '').length >= MAX_DIGITS) return;
    this.entry = this.entry === '0' ? d : this.entry === '-0' ? `-${d}` : this.entry + d;
  }

  private value(): number {
    return parseFloat(this.entry.replace(',', '.'));
  }

  private apply(): void {
    if (this.op === null || this.acc === null) {
      this.acc = this.value();
      return;
    }
    const b = this.value();
    let r: number;
    switch (this.op) {
      case '+':
        r = this.acc + b;
        break;
      case '-':
        r = this.acc - b;
        break;
      case '×':
        r = this.acc * b;
        break;
      case '÷':
        if (b === 0) {
          this.error = this.errorText;
          this.acc = null;
          this.op = null;
          return;
        }
        r = this.acc / b;
        break;
    }
    this.entry = format(r);
    this.acc = r;
  }

  private reset(): void {
    this.entry = '0';
    this.acc = null;
    this.op = null;
    this.fresh = true;
    this.error = null;
  }
}

/** Zahl als Anzeige-Text mit Dezimalkomma, höchstens 12 Stellen. */
export function format(n: number): string {
  if (!Number.isFinite(n)) return 'Fehler';
  if (Math.abs(n) >= 1e12) return n.toExponential(5).replace('.', ',');
  const rounded = Number.parseFloat(n.toPrecision(MAX_DIGITS));
  return String(rounded).replace('.', ',');
}

/** Tastatur → Rechnertaste (Ziffern, Rechenzeichen, Enter, Rücktaste). */
export function calcKeyFor(key: string): CalcKey | null {
  if (/^[0-9]$/.test(key)) return key as CalcKey;
  switch (key) {
    case ',':
    case '.':
      return ',';
    case '+':
      return '+';
    case '-':
      return '-';
    case '*':
    case 'x':
    case 'X':
      return '×';
    case '/':
    case ':':
      return '÷';
    case 'Enter':
    case '=':
      return '=';
    case 'Backspace':
      return '⌫';
    case 'c':
    case 'C':
    case 'Delete':
      return 'C';
    default:
      return null;
  }
}
