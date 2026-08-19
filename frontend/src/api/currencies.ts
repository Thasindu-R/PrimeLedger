import { apiJson } from './client';
import { currencySchema, type WireCurrency } from '../schemas/api';
import type { Currency } from '../types';

/**
 * Every currency an account may be held in, priced against the base (F-05).
 *
 * <p>A currency with no rate is still in the list. Holding money in a currency
 * the rate provider does not quote is perfectly legitimate — the amount is
 * stored exactly as spent either way — it simply cannot be folded into a
 * converted total, and the analytics summary reports how many rows that
 * affected rather than dropping them quietly.
 */
export async function listCurrencies(): Promise<Currency[]> {
  const body = await apiJson<unknown>('/currencies');
  return currencySchema.array().parse(body).map(toCurrency);
}

export function toCurrency(wire: WireCurrency): Currency {
  return {
    code: wire.code,
    name: wire.name,
    rate: wire.rate === null || wire.rate === undefined ? undefined : Number(wire.rate),
    asOf: wire.asOf ?? undefined,
  };
}
