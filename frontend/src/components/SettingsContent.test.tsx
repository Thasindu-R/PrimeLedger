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
      transactions={[makeTransaction()]}
      {...props}
    />,
  );
  return { onClearAll, onUserNameChange };
}

describe('SettingsContent export (D-03)', () => {
  it('exports the transactions it was given instead of reading storage directly', async () => {
    const user = userEvent.setup();
    const download = captureDownload();
    // Storage holds a different row — if the component reads storage, it shows up here.
    seedStorage([makeTransaction({ description: 'stale storage row' })]);
    const getItem = vi.spyOn(Storage.prototype, 'getItem');

    renderSettings({
      transactions: [makeTransaction({ description: 'row from props' })],
    });
    await user.click(screen.getByRole('button', { name: /^export$/i }));

    const csv = await download.text();
    expect(csv).toContain('row from props');
    expect(csv).not.toContain('stale storage row');
    expect(getItem).not.toHaveBeenCalledWith('finance_tracker_transactions');
  });

  it('reports the count from the transactions it was given', () => {
    renderSettings({ transactions: [makeTransaction(), makeTransaction()] });
    expect(screen.getByText(/2 transactions/i)).toBeInTheDocument();
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
