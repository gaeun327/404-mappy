import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function MyPageTab() {
  return (
    <SafeAreaView style={styles.safeArea}>
      
      {/* 📍 동네 소통방(CommunityTab)과 100% 일치시킨 헤더 구조 */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerLabel}>MY PAGE</Text>
          <Text style={styles.headerTitle}>마이페이지</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} activeOpacity={0.8}>
          <Text style={styles.addBtnText}>로그아웃</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={40} color="#CCC" />
          </View>
          <Text style={styles.name}>탐험가님</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Lv.5 동네 대장</Text>
          </View>
        </View>
        
        <View style={styles.expSection}>
          <View style={styles.expHeader}>
            <Text style={styles.expLabel}>다음 등급까지 80%</Text>
            <Text style={styles.expVal}>800 / 1000</Text>
          </View>
          <View style={styles.barBg}>
            <View style={[styles.barFill, {width: '80%'}]} />
          </View>
        </View>

        <Text style={styles.secTitle}>⭐ 저장한 장소</Text>
        <View style={styles.item}><Text>성수동 소문난 감자탕</Text></View>
        <View style={styles.item}><Text>서울숲 튤립축제</Text></View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: '#F2F2F7' // 동네 소통방과 동일한 연회색 배경으로 변경
  },
  
  // ─── 💡 동네 소통방(CommunityTab)과 완벽하게 일치시킨 수치 대입 구역 ───
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingTop: 16, 
    paddingBottom: 12,
    backgroundColor: '#F2F2F7',
  },
  headerTitleContainer: {
    flexDirection: 'column',
  },
  headerLabel: { 
    fontSize: 11, 
    fontWeight: '700', 
    color: '#007AFF', 
    letterSpacing: 1.5, 
    marginBottom: 2 
  },
  headerTitle: { 
    fontSize: 24, 
    fontWeight: '800', 
    color: '#1C1C1E', 
    letterSpacing: -0.5 
  },
  addBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4, 
    backgroundColor: '#1C1C1E', 
    paddingHorizontal: 14, 
    paddingVertical: 9, 
    borderRadius: 20 
  },
  addBtnText: { 
    color: '#fff', 
    fontSize: 13, 
    fontWeight: '700' 
  },
  // ─────────────────────────────────────────────────────────────

  container: { 
    flex: 1,
    paddingHorizontal: 20, // 헤더와 좌우 정렬 라인을 맞춤
  },
  profileSection: { alignItems: 'center', marginVertical: 20 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  name: { fontSize: 18, fontWeight: 'bold', marginTop: 10 },
  badge: { backgroundColor: '#34C759', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginTop: 5 },
  badgeText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  expSection: { marginBottom: 30 },
  expHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  expLabel: { fontSize: 13, color: '#666' },
  barBg: { height: 10, backgroundColor: '#fff', borderRadius: 5 },
  barFill: { height: 10, backgroundColor: '#34C759', borderRadius: 5 },
  secTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  item: { padding: 15, backgroundColor: '#fff', borderRadius: 10, marginBottom: 8 }
});