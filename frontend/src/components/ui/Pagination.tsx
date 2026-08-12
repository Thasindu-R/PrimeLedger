import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  /** Zero-based, as the API counts. */
  page: number;
  totalPages: number;
  totalElements: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** True while the next page is in flight, so the buttons cannot be spammed. */
  busy?: boolean;
}

export function Pagination({
  page,
  totalPages,
  totalElements,
  pageSize,
  onPageChange,
  busy = false,
}: PaginationProps) {
  // One page of results is not a choice, so offering the controls would only
  // raise a question the user does not have.
  if (totalPages <= 1) return null;

  const first = page * pageSize + 1;
  const last = Math.min(totalElements, (page + 1) * pageSize);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-100 px-4 py-3"
    >
      <p className="text-xs text-gray-500" aria-live="polite">
        Showing <span className="font-medium text-gray-700">{first}</span>–
        <span className="font-medium text-gray-700">{last}</span> of{' '}
        <span className="font-medium text-gray-700">{totalElements}</span>
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 0 || busy}
          className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={15} />
          Previous
        </button>

        <span className="text-xs text-gray-500 px-1">
          Page {page + 1} of {totalPages}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages - 1 || busy}
          className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
          <ChevronRight size={15} />
        </button>
      </div>
    </nav>
  );
}
