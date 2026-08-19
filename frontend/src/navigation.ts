/** The application sections, shared by the header tabs and the mobile menu. */
export const SECTIONS = [
  { label: 'Overview', path: '/overview' },
  { label: 'Analytics', path: '/analytics' },
  { label: 'Transactions', path: '/transactions' },
  { label: 'Accounts', path: '/accounts' },
  { label: 'Budgets', path: '/budgets' },
  { label: 'Recurring', path: '/recurring' },
  { label: 'Goals', path: '/goals' },
  { label: 'Settings', path: '/settings' },
] as const;

export type SectionPath = (typeof SECTIONS)[number]['path'];
