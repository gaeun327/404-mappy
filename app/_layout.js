import { Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import SplashScreen from './splash'; // splash.js 불러오기

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // 4.5초 동안 스플래시(광고)를 보여준 뒤 메인으로 전환
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 4500);

    return () => clearTimeout(timer);
  }, []);

  // ✅ 앱이 준비되지 않았다면 무조건 스플래시 화면만 렌더링
  if (!isReady) {
    return <SplashScreen />;
  }

  // ✅ 준비가 끝나면 그제서야 메인 스택(로그인/홈)을 보여줌
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" /> 
      <Stack.Screen name="home" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="mypage" options={{ title: '마이페이지', headerShown: true }} />
    </Stack>
  );
}