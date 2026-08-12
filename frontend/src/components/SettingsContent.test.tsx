import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsContent } from './SettingsContent';
import { makeTransaction, seedStorage } from '../test/factories';

/** Intercepts the download so the generated CSV can be read back. */
function captureDownload() {
  const blobs: Blob[] = [];
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    blobs.push(blob as Blob);
    return 'blob:mock';
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  return {
    async text() {
      expect(blobs).toHaveLength(1);
      return blobs[0].text();
    },
  };
}

function renderSettings(
  props: Partial<React.ComponentProps<typeof SettingsContent>> = {},
) {
  const onClearAll = vi.fn();
  const onUserNameChange = vi.fn();
  render(
    <SettingsContent
      userName="Ada"
      onUserNameChange={onUserNameChange}
      onClearAll={onClearAll}
      transactionCount={1}
      isClearing={false}
      fetchAllTransactions={async () => [makeTransaction()]}
      {...props}
    />,
  );
  return { onClearAll, onUserNameChange };
}

describe('SettingsContent export (D-03)', () => {
  it('exports what the server returns instead of reading storage directly', async () => {
    const user = userEvent.setup();
    const download = captureDownload();
    // Storage holds a different row — if the component reads storage, it shows up here.
    seedStorage([makeTransaction({ description: 'stale storage row' })]);
    const getItem = vi.spyOn(Storage.prototype, 'getItem');

    renderSettings({
      fetchAllTransactions: async () => [
        makeTransaction({ description: 'row from the server' }),
      ],
    });
    await user.click(screen.getByRole('button', { name: /^export$/i }));

    const csv = await download.text();
    expect(csv).toContain('row from the server');
    expect(csv).not.toContain('stale storage row');
    expect(getItem).not.toHaveBeenCalledWith('finance_tracker_transactions');
  });

  it('exports every row, not just the page the user was looking at', async () => {
    const user = userEvent.setup();
    const download = captureDownload();

    // The Settings export says "all data" and has to mean it: the page on
    // screen holds 25 rows at most, and the ledger holds far more.
    renderSettings({
      transactionCount: 120,
      fetchAllTransactions: async () =>
        Array.from({ length: 120 }, (_, i) =>
          makeTransaction({ description: `row ${i}` }),
        ),
    });
    await user.click(screen.getByRole('button', { name: /^export$/i }));

    const csv = await download.text();
    expect(csv).toContain('row 0');
    expect(csv).toContain('row 119');
  });

  it('reports the count the server gave, not the size of a page', () => {
    renderSettings({ transactionCount: 384 });
    expect(screen.getByText(/384 transactions/i)).toBeInTheDocument();
  });

  it('no longer claims the data lives in the browser', () => {
    renderSettings({ transactionCount: 3 });
    expect(screen.queryByText(/locally in your browser/i)).toBeNull();
  });
});

describe('SettingsContent destructive confirmation (D-10)', () => {
  it('uses an in-app dialog rather than the native window.confirm', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { onClearAll } = renderSettings();

    await user.click(screen.getByRole('button', { name: /clear all transactions/i }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(onClearAll).not.toHaveBeenCalled();
  });

  it('clears only after the dialog is confirmed', async () => {
    const user = userEvent.setup();
    const { onClearAll } = renderSettings();

    await user.click(screen.getByRole('button', { name: /clear all transactions/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^clear all$/i }));

    expect(onClearAll).toHaveBeenCalledOnce();
  });

  it('leaves the data alone when the dialog is cancelled', async () => {
    const user = userEvent.setup();
    const { onClearAll } = renderSettings();

    await user.click(screen.getByRole('button', { name: /clear all transactions/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /cancel/i }));

    expect(onClearAll).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
