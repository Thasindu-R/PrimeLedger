import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { InsightsPanel } from './InsightsPanel';
import type { Insight } from '../types';

function makeInsight(overrides: Partial<Insight> = {}): Insight {
  return {
    kind: 'CATEGORY_SHIFT',
    tone: 'WARNING',
    title: 'Food spending is up',
    detail: 'You have spent USD 1,340 on Food so far this month, 34% more than by this point last month.',
    subjectId: 'cat-food',
    subjectName: 'Food',
    amount: 1340,
    percent: 34,
    ...overrides,
  };
}

function renderPanel(insights: Insight[], isLoading = false) {
  render(
    <MemoryRouter>
      <InsightsPanel insights={insights} isLoading={isLoading} />
    </MemoryRouter>,
  );
}

describe('InsightsPanel', () => {
  it('renders the observation as written by the rule', () => {
    renderPanel([makeInsight()]);

    expect(screen.getByText('Food spending is up')).toBeInTheDocument();
    expect(screen.getByText(/34% more/)).toBeInTheDocument();
  });

  /**
   * The whole value of this panel is being worth reading on the day it says
   * something. One that always found an observation is one the user learns to
   * skip, so a quiet month renders nothing rather than a cheerful placeholder.
   */
  it('renders nothing at all when there is nothing to say', () => {
    const { container } = render(
      <MemoryRouter>
        <InsightsPanel insights={[]} isLoading={false} />
      </MemoryRouter>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows a skeleton while loading rather than an empty panel', () => {
    renderPanel([], true);
    expect(screen.queryByLabelText('Insights')).not.toBeInTheDocument();
  });

  it('links a category observation to the transactions it is about', () => {
    renderPanel([makeInsight()]);

    expect(screen.getByRole('link', { name: /see food transactions/i })).toHaveAttribute(
      'href',
      '/transactions',
    );
  });

  /**
   * A transaction insight names a row the transactions page cannot be
   * deep-linked to yet. A link landing on an unfiltered list would be worse
   * than no link.
   */
  it('does not offer a link it cannot honour', () => {
    renderPanel([
      makeInsight({
        kind: 'UNUSUAL_TRANSACTION',
        title: 'Unusually large Food expense',
        subjectName: 'Food',
      }),
    ]);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders several observations in the order the server sent them', () => {
    renderPanel([
      makeInsight({ title: 'Food spending is up', tone: 'WARNING' }),
      makeInsight({
        kind: 'SAVINGS_RATE_TREND',
        tone: 'GOOD',
        title: 'Your savings rate is improving',
        subjectId: undefined,
        subjectName: undefined,
      }),
    ]);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Food spending is up');
    expect(items[1]).toHaveTextContent('Your savings rate is improving');
  });
});
