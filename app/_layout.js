import { Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import SplashScreen from './splash';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 4500);
    return () => clearTimeout(timer);
  }, []);

  if (!isReady) return <SplashScreen />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="detail" />
    </Stack>
  );
}