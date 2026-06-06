import { Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import { View } from 'react-native';
import SplashScreen from './splash';
import InAppNotification from '../components/InAppNotification';
import { auth } from '../firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 4500);
    const unsub = onAuthStateChanged(auth, (user) => setIsLoggedIn(!!user));
    return () => { clearTimeout(timer); unsub(); };
  }, []);

  if (!isReady) return <SplashScreen />;

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="detail" />
        <Stack.Screen name="addplace" />
        <Stack.Screen name="editplace" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="editprofile" />
        <Stack.Screen name="userprofile" />
      </Stack>
      {isLoggedIn && <InAppNotification />}
    </View>
  );
}