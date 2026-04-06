import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* initialRouteName을 써서 "무조건 얘가 시작이야!"라고 못박기 */}
      <Stack.Screen name="splash" options={{ initialRouteName: 'splash' }} /> 
      <Stack.Screen name="index" /> 
      <Stack.Screen name="home" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="mypage" options={{ title: '마이페이지' }} />
    </Stack>
  );
}