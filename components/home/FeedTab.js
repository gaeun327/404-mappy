import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function FeedTab() {
  const dummyData = [
    { id: '1', user: 'khh', title: 'ㄴㄴ', desc: '여기 분위기 진짜 좋아요.', type: '추천' },
    { id: '2', user: '익명', title: '우왕', desc: 'ㅇㅇ 여기 대박임', type: '주의' },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>👥 실시간 추천 피드</Text>
      <FlatList
        data={dummyData}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.userName}>{item.user}님</Text>
              <View style={styles.tag}>
                <Ionicons name={item.type === '추천' ? 'thumbs-up' : 'alert-circle'} size={14} color={item.type === '추천' ? '#007AFF' : '#FF3B30'} />
                <Text style={[styles.tagText, { color: item.type === '추천' ? '#007AFF' : '#FF3B30' }]}> {item.type}</Text>
              </View>
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardDesc}>{item.desc}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, color: '#1C1C1E' },
  card: { backgroundColor: '#F8F9FA', padding: 15, borderRadius: 15, marginBottom: 12, borderWeight: 1, borderColor: '#EEE' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  userName: { fontSize: 14, color: '#8E8E93', fontWeight: '600' },
  tag: { flexDirection: 'row', alignItems: 'center' },
  tagText: { fontSize: 12, fontWeight: 'bold' },
  cardTitle: { fontSize: 17, fontWeight: 'bold', color: '#1C1C1E' },
  cardDesc: { fontSize: 14, color: '#3A3A3C', marginTop: 4 },
});