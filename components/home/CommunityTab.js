import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function CommunityTab() {
  const chatRooms = [
    { id: '1', name: '우리동네 수다방 💬', lastMsg: '오늘 날씨 진짜 좋네요!', count: 12 },
    { id: '2', name: '맛집 공유/탐방 📍', lastMsg: '성수역 근처 카페 추천점요', count: 5 },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🏘️ 동네 소통방</Text>
      <FlatList
        data={chatRooms}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.room}>
            <View style={styles.info}>
              <Text style={styles.roomName}>{item.name}</Text>
              <Text style={styles.lastMsg}>{item.lastMsg}</Text>
            </View>
            {item.count > 0 && (
              <View style={styles.badge}><Text style={styles.badgeText}>{item.count}</Text></View>
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
  room: { flexDirection: 'row', alignItems: 'center', padding: 18, backgroundColor: '#F2F2F7', borderRadius: 15, marginBottom: 10 },
  info: { flex: 1 },
  roomName: { fontSize: 16, fontWeight: 'bold' },
  lastMsg: { fontSize: 13, color: '#8E8E93', marginTop: 4 },
  badge: { backgroundColor: '#FF3B30', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  badgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
});