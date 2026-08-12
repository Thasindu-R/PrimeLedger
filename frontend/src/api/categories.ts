import { z } from 'zod';
import { apiJson } from './client';
import { categorySchema } from '../schemas/api';
import { fromWireType } from './transactions';
import type { TransactionType } from '../types';

/**
 * A category as the app uses it. `kind` is reused for the transaction type it
 * may be filed under, which is exactly the rule the server enforces: an expense
 * cannot go under an income category.
 */
export interface CategoryOption {
  id: string;
  name: string;
  kind: TransactionType;
  colour?: string;
  system: boolean;
  sortOrder: number;
}

export async function listCategories(): Promise<CategoryOption[]> {
  const body = await apiJson<unknown>('/categories');
  const parsed = z.array(categorySchema).parse(body);

  return parsed
    .map((category) => ({
      id: category.id,
      name: category.name,
      kind: fromWireType(category.kind),
      colour: category.colour ?? undefined,
      system: category.system,
      sortOrder: category.sortOrder,
    }))
    .sort(bySortOrderThenName);
}

/** The options the form offers for one transaction type. */
export function categoriesOfKind(
  categories: CategoryOption[],
  kind: TransactionType,
): CategoryOption[] {
  return categories.filter((category) => category.kind === kind);
}

function bySortOrderThenName(a: CategoryOption, b: CategoryOption): number {
  // The seeded rows carry a deliberate order; user-defined ones all sit at 0,
  // so name is what separates them.
  return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
}
