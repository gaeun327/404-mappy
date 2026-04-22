import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#007AFF', headerShown: false }}>
      <Tabs.Screen name="home" options={{ title: '홈', tabBarIcon: ({ color }) => <Ionicons name="map" size={24} color={color} /> }} />
      <Tabs.Screen name="feed" options={{ title: '피드', tabBarIcon: ({ color }) => <Ionicons name="list" size={24} color={color} /> }} />
      <Tabs.Screen name="ai" options={{ title: 'AI 추천', tabBarIcon: ({ color }) => <Ionicons name="sparkles" size={24} color={color} /> }} />
      <Tabs.Screen name="community" options={{ title: '커뮤니티', tabBarIcon: ({ color }) => <Ionicons name="chatbubbles" size={24} color={color} /> }} />
      <Tabs.Screen name="mypage" options={{ title: '마이', tabBarIcon: ({ color }) => <Ionicons name="person-circle" size={24} color={color} /> }} />
    </Tabs>
  );
}