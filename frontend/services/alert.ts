import { Alert, Platform } from 'react-native';

// React Native's Alert.alert does nothing in a web browser, so errors were
// silently disappearing. This shows a browser popup on web instead.
export function showAlert(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}
