// React Native Web's Alert doesn't render buttons, so fall back to the browser dialogs.
export function confirmAction(title: string, message: string | undefined, _actionLabel: string, onConfirm: () => void) {
  if (window.confirm(message ? `${title}\n\n${message}` : title)) onConfirm();
}

export function showMessage(title: string, message: string) {
  window.alert(`${title}\n\n${message}`);
}
