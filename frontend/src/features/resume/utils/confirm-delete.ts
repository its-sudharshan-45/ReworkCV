/** Shared delete-confirmation copy so resume flows stay consistent. */
export const RESUME_DELETE_CONFIRM_MESSAGE = 'Are you sure you want to delete this resume?';

export function confirmResumeDelete(): boolean {
  return window.confirm(RESUME_DELETE_CONFIRM_MESSAGE);
}
