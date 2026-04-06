import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { auth, db } from '../firebaseConfig';
import { collection, query, where, getDocs, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function MyPageScreen() {
  const router = useRouter();
  const [myPlaces, setMyPlaces] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchMyPlaces(); }, []);

  const fetchMyPlaces = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, "places"),
        where("userEmail", "==", auth.currentUser?.email),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      setMyPlaces(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.log(e); }
    finally { setLoading(false); }
  };

  // 🏆 등급 계산 로직
  const getUserLevel = (count) => {
    if (count >= 20) return { name: "전설의 미식가", color: "#FFD700", next: "MAX" };
    if (count >= 10) return { name: "맛집 사냥꾼", color: "#E5E4E2", next: 20 - count };
    if (count >= 5) return { name: "미식가 꿈나무", color: "#CD7F32", next: 10 - count };
    return { name: "맛집 초보", color: "#888", next: 5 - count };
  };

  const level = getUserLevel(myPlaces.length);
  const totalPoints = myPlaces.length * 100; // 글 하나당 100점

  return (
    <View style={styles.container}>
      {/* 상단 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} /></TouchableOpacity>
        <Text style={styles.headerTitle}>내 프로필</Text>
        <TouchableOpacity onPress={() => auth.signOut() && router.replace('/')}>
          <Text style={{color: '#FF3B30'}}>로그아웃</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 💳 프로필 카드 (게이미피케이션) */}
        <View style={styles.profileCard}>
          <View style={[styles.levelBadge, {backgroundColor: level.color}]}>
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
              <Text style={styles.statVal}>{totalPoints}P</Text>
              <Text style={styles.statLabel}>내 포인트</Text>
            </View>
          </View>

          {level.next !== "MAX" && (
            <Text style={styles.nextLevelInfo}>다음 등급까지 {level.next}개의 장소가 더 필요해요! 🔥</Text>
          )}
        </View>

        {/* 🏅 배지 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>획득한 배지</Text>
          <View style={styles.badgeRow}>
            <Badge icon="ice-cream" label="첫 등록" active={myPlaces.length > 0} />
            <Badge icon="flame" label="5곳 돌파" active={myPlaces.length >= 5} />
            <Badge icon="trophy" label="마스터" active={myPlaces.length >= 20} />
            <Badge icon="camera" label="리뷰왕" active={myPlaces.length >= 3} />
          </View>
        </View>

        {/* 📍 내가 쓴 리스트 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>내가 공유한 장소</Text>
          {loading ? <ActivityIndicator /> : (
            myPlaces.map(item => (
              <View key={item.id} style={styles.placeItem}>
                <View style={styles.placeInfo}>
                  <Text style={styles.placeCategory}>{item.category || '기타'}</Text>
                  <Text style={styles.placeTitle}>{item.title}</Text>
                  <View style={styles.starRow}>
                    {[1,2,3,4,5].map(i => (
                      <Ionicons key={i} name={i <= item.rating ? "star" : "star-outline"} size={12} color="#FFD700" />
                    ))}
                  </View>
                </View>
                <TouchableOpacity onPress={() => { /* 삭제 로직 */ }}>
                  <Ionicons name="trash-outline" size={20} color="#ccc" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// 배지 컴포넌트
const Badge = ({ icon, label, active }) => (
  <View style={[styles.badgeContainer, !active && { opacity: 0.2 }]}>
    <View style={styles.badgeIcon}><Ionicons name={icon} size={24} color={active ? "#FFD700" : "#888"} /></View>
    <Text style={styles.badgeLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60, backgroundColor: 'white' },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  profileCard: { backgroundColor: 'white', margin: 20, borderRadius: 20, padding: 25, alignItems: 'center', elevation: 5, shadowOpacity: 0.1 },
  levelBadge: { paddingHorizontal: 15, paddingVertical: 5, borderRadius: 20, marginBottom: 10 },
  levelText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  userEmail: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  statsRow: { flexDirection: 'row', marginTop: 25, alignItems: 'center' },
  statBox: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: 'bold', color: '#007AFF' },
  statLabel: { fontSize: 12, color: '#888', marginTop: 5 },
  divider: { width: 1, height: 30, backgroundColor: '#eee' },
  nextLevelInfo: { marginTop: 20, color: '#666', fontSize: 13, backgroundColor: '#f0f7ff', padding: 10, borderRadius: 10 },
  section: { paddingHorizontal: 20, marginBottom: 30 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  badgeRow: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: 'white', padding: 20, borderRadius: 15 },
  badgeContainer: { alignItems: 'center' },
  badgeIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#fdfdfd', justifyContent: 'center', alignItems: 'center', marginBottom: 5, borderWidth: 1, borderColor: '#eee' },
  badgeLabel: { fontSize: 11, color: '#555' },
  placeItem: { flexDirection: 'row', backgroundColor: 'white', padding: 15, borderRadius: 15, marginBottom: 10, alignItems: 'center' },
  placeInfo: { flex: 1 },
  placeCategory: { fontSize: 10, color: '#888' },
  placeTitle: { fontSize: 16, fontWeight: 'bold', marginVertical: 3 },
  starRow: { flexDirection: 'row' }
});