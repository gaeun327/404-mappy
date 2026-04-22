import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function MyPageTab() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.profileSection}>
        <View style={styles.avatar}><Ionicons name="person" size={40} color="#CCC" /></View>
        <Text style={styles.name}>탐험가님</Text>
        <View style={styles.badge}><Text style={styles.badgeText}>Lv.5 동네 대장</Text></View>
      </View>
      
      <View style={styles.expSection}>
        <View style={styles.expHeader}>
          <Text style={styles.expLabel}>다음 등급까지 80%</Text>
          <Text style={styles.expVal}>800 / 1000</Text>
        </View>
        <View style={styles.barBg}><View style={[styles.barFill, {width: '80%'}]} /></View>
      </View>

      <Text style={styles.secTitle}>⭐ 저장한 장소</Text>
      <View style={styles.item}><Text>성수동 소문난 감자탕</Text></View>
      <View style={styles.item}><Text>서울숲 튤립축제</Text></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  profileSection: { alignItems: 'center', marginVertical: 20 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F2F2F7', justifyContent: 'center', alignItems: 'center' },
  name: { fontSize: 18, fontWeight: 'bold', marginTop: 10 },
  badge: { backgroundColor: '#34C759', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginTop: 5 },
  badgeText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  expSection: { marginBottom: 30 },
  expHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  expLabel: { fontSize: 13, color: '#666' },
  barBg: { height: 10, backgroundColor: '#F2F2F7', borderRadius: 5 },
  barFill: { height: 10, backgroundColor: '#34C759', borderRadius: 5 },
  secTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  item: { padding: 15, backgroundColor: '#F8F9FA', borderRadius: 10, marginBottom: 8 }
});