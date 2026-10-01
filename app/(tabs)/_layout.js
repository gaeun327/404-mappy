import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { useEffect, useState } from 'react';

import { auth, db } from '../../firebaseConfig';
import {
  collection,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';

export default function TabLayout() {
  const [hasNewFeed, setHasNewFeed] = useState(false);

  useEffect(() => {
    const myUid = auth.currentUser?.uid;

    if (!myUid) {
      setHasNewFeed(false);
      return;
    }

    // 나에게 온 "친구 새 장소" 알림 중
    // 아직 피드에서 확인하지 않은 것이 있는지 실시간 확인
    const q = query(
      collection(db, 'notifications'),
      where('recipientUid', '==', myUid),
      where('type', '==', 'friend_place'),
      where('feedSeen', '==', false)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setHasNewFeed(!snapshot.empty);
      },
      (error) => {
        console.log('피드 새 글 확인 오류:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: '홈',
          tabBarIcon: ({ color }) => (
            <Ionicons name="map" size={24} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="feed"
        options={{
          title: '피드',
          tabBarIcon: ({ color }) => (
            <View>
              <Ionicons name="list" size={24} color={color} />

              {hasNewFeed && (
                <View
                  style={{
                    position: 'absolute',
                    top: -3,
                    right: -5,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: '#FF3B30',
                  }}
                />
              )}
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="ai"
        options={{
          title: 'AI 추천',
          tabBarIcon: ({ color }) => (
            <Ionicons name="sparkles" size={24} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="community"
        options={{
          title: '커뮤니티',
          tabBarIcon: ({ color }) => (
            <Ionicons name="chatbubbles" size={24} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="mypage"
        options={{
          title: '마이',
          tabBarIcon: ({ color }) => (
            <Ionicons name="person-circle" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}