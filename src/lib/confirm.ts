import { Alert } from 'react-native';

/** Asks before a destructive action. The web version uses the browser's confirm dialog. */
export function confirmAction(title: string, message: string | undefined, actionLabel: string, onConfirm: () => void) {
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: actionLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

export function showMessage(title: string, message: string) {
  Alert.alert(title, message);
}
