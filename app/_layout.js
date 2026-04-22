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
      <Stack.Screen name="index" />       {/* 로그인 화면 */}
      <Stack.Screen name="signup" />      {/* 회원가입 화면 */}
      <Stack.Screen name="(tabs)" />      {/* 탭 구조로 이동 (여기서 home 등이 관리됨) */}
    </Stack>
  );
}