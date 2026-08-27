import * as NavigationBar from 'expo-navigation-bar';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

export function useImmersiveNavigation(): void {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const hide = async () => {
      await NavigationBar.setVisibilityAsync('hidden');
    };
    void hide();
    const visibility = NavigationBar.addVisibilityListener(({ visibility: state }) => {
      if (state === 'visible') {
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(() => void hide(), 2500);
      }
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void hide();
    });
    return () => {
      if (hideTimer) clearTimeout(hideTimer);
      visibility.remove();
      appState.remove();
    };
  }, []);
}
