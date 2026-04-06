import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { auth, db } from '../firebaseConfig';
import { collection, query, where, getDocs, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// 🏆 테스트용: 무조건 마스터로 고정
const TEST_LEVEL = () => {
  return { name: "마스터 👑", color: "#FFD700" };
};

export default function MyPage() {
  const router = useRouter();
  const [myPlaces, setMyPlaces] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (auth.currentUser) {
      fetchMyPlaces();
    }
  }, []);

  const fetchMyPlaces = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, "places"),
        where("userEmail", "==", auth.currentUser?.email)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMyPlaces(list);
    } catch (e) {
      console.log("데이터 로딩 에러:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (placeId) => {
    Alert.alert("장소 삭제", "정말 이 기록을 삭제하시겠습니까?", [
      { text: "취소", style: "cancel" },
      { 
        text: "삭제", 
        style: "destructive", 
        onPress: async () => {
          await deleteDoc(doc(db, "places", placeId));
          setMyPlaces(prev => prev.filter(p => p.id !== placeId));
        } 
      }
    ]);
  };

  // 🔥 [핵심] DB에 저장된 level 필드나 개수에 상관없이 마스터로 고정!
  const level = TEST_LEVEL();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="#1C1C1E" /></TouchableOpacity>
        <Text style={styles.headerTitle}>내 정보</Text>
        <TouchableOpacity onPress={() => auth.signOut().then(() => router.replace('/'))}>
          <Text style={styles.logoutText}>로그아웃</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.profileCard}>
          {/* 🔴 이제 무조건 '마스터 👑'라고 떠야 정상입니다! */}
          <View style={[styles.levelBadge, { backgroundColor: level.color }]}>
            <Text style={styles.levelText}>{level.name}</Text>
          </View>
          <Text style={styles.userEmail}>{auth.currentUser?.email}</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{myPlaces.length}</Text>
              <Text style={styles.statLabel}>등록 장소</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{myPlaces.length * 100}P</Text>
              <Text style={styles.statLabel}>내 포인트</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>내가 공유한 로컬 스팟</Text>
          {loading ? (
            <ActivityIndicator size="small" color="#007AFF" style={{ marginTop: 20 }} />
          ) : myPlaces.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>아직 등록한 장소가 없네요.🌱</Text>
            </View>
          ) : (
            myPlaces.map(item => (
              <View key={item.id} style={styles.placeItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.placeTitle}>{item.title}</Text>
                </View>
                <TouchableOpacity onPress={() => handleDelete(item.id)}>
                  <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 15, backgroundColor: 'white' },
  headerTitle: { fontSize: 17, fontWeight: 'bold' },
  logoutText: { color: '#FF3B30', fontSize: 14, fontWeight: '500' },
  profileCard: { backgroundColor: 'white', margin: 20, borderRadius: 24, padding: 25, alignItems: 'center', elevation: 3 },
  levelBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, marginBottom: 10 },
  levelText: { color: 'white', fontWeight: 'bold', fontSize: 13 },
  userEmail: { fontSize: 16, fontWeight: '600' },
  statsRow: { flexDirection: 'row', marginTop: 25, width: '100%' },
  statBox: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: 'bold', color: '#007AFF' },
  statLabel: { fontSize: 12, color: '#8E8E93', marginTop: 4 },
  divider: { width: 1, height: 30, backgroundColor: '#E5E5EA' },
  section: { paddingHorizontal: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  placeItem: { flexDirection: 'row', backgroundColor: 'white', padding: 18, borderRadius: 18, marginBottom: 12, alignItems: 'center' },
  placeTitle: { fontSize: 16, fontWeight: '600' },
  emptyContainer: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: '#8E8E93', fontSize: 14 }
});