import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { db } from '../firebaseConfig';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

const getLevel = (count) => {
  if (count >= 50) return { name: '전설의 탐험가 👑', color: '#8B5CF6' };
  if (count >= 30) return { name: '지역 마스터 🥇',   color: '#FFD700' };
  if (count >= 15) return { name: '동네 보안관 🥉',   color: '#FF6B35' };
  if (count >= 7)  return { name: '로컬 탐험가 🔍',   color: '#007AFF' };
  if (count >= 3)  return { name: '동네 입문자 🗺️',   color: '#00B4D8' };
  return           { name: '새싹 탐험가 🌱',           color: '#34C759' };
};

export default function UserProfileScreen() {
  const router = useRouter();
  const { uid, nickname } = useLocalSearchParams();
  const [userData, setUserData] = useState(null);
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const load = async () => {
      try {
        // 유저 정보
        const userSnap = await getDoc(doc(db, 'users', uid));
        if (userSnap.exists()) setUserData(userSnap.data());

        // 등록한 장소
        const q = query(collection(db, 'places'), where('userEmail', '==', userSnap.data()?.email ?? ''));
        const snap = await getDocs(q);
        setPlaces(snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)));
      } catch (e) { console.log('유저 프로필 오류:', e); }
      finally { setLoading(false); }
    };
    load();
  }, [uid]);

  const goToDetail = (place) => {
    router.push({
      pathname: '/detail',
      params: {
        id: place.id,
        title: place.title ?? '',
        description: place.description ?? '',
        type: place.type ?? 'blue',
        user: place.userNickname ?? '',
        userEmail: place.userEmail ?? '',
        address: place.address ?? '',
        detailAddress: place.detailAddress ?? '',
        imagePaths: encodeURIComponent(JSON.stringify(place.imagePaths ?? [])),
        tags: JSON.stringify(place.tags ?? []),
        category: place.category ?? '',
      }
    });
  };

  const displayNickname = userData?.nickname ?? nickname ?? '익명';
  const level = getLevel(places.length);
  const friendCount = (userData?.friends ?? []).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1C1C1E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{displayNickname}님의 프로필</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

          {/* 프로필 카드 */}
          <View style={styles.profileCard}>
            {userData?.profileImageUrl ? (
              <Image source={{ uri: userData.profileImageUrl }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarTxt}>
                  {displayNickname[0]?.toUpperCase() ?? '?'}
                </Text>
              </View>
            )}

            <View style={[styles.levelBadge, { backgroundColor: level.color }]}>
              <Text style={styles.levelTxt}>{level.name}</Text>
            </View>

            <Text style={styles.nickname}>{displayNickname}</Text>
            <Text style={styles.email}>{userData?.email ?? ''}</Text>

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={[styles.statVal, { color: '#007AFF' }]}>{places.length}</Text>
                <Text style={styles.statLabel}>등록 장소</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={[styles.statVal, { color: '#F59E0B' }]}>{friendCount}</Text>
                <Text style={styles.statLabel}>친구</Text>
              </View>
            </View>
          </View>

          {/* 등록 장소 목록 */}
          <Text style={styles.sectionTitle}>등록한 장소 {places.length}개</Text>

          {places.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="location-outline" size={40} color="#C7C7CC" />
              <Text style={styles.emptyTxt}>아직 등록한 장소가 없어요</Text>
            </View>
          ) : (
            places.map(place => (
              <TouchableOpacity
                key={place.id}
                style={styles.placeCard}
                onPress={() => goToDetail(place)}
                activeOpacity={0.8}
              >
                <View style={[styles.accentBar, { backgroundColor: place.type === 'blue' ? '#007AFF' : '#FF3B30' }]} />
                <View style={styles.placeBody}>
                  <View style={styles.placeTopRow}>
                    <Text style={styles.placeTitle} numberOfLines={1}>{place.title}</Text>
                    <View style={[styles.typePill, { backgroundColor: place.type === 'blue' ? '#EAF3FF' : '#FFF0EF' }]}>
                      <Text style={[styles.typePillTxt, { color: place.type === 'blue' ? '#007AFF' : '#FF3B30' }]}>
                        {place.type === 'blue' ? '👍 추천' : '👎 주의'}
                      </Text>
                    </View>
                  </View>
                  {place.address ? (
                    <View style={styles.addrRow}>
                      <Ionicons name="location-outline" size={12} color="#8E8E93" />
                      <Text style={styles.addrTxt} numberOfLines={1}>{place.address}</Text>
                    </View>
                  ) : null}
                  {place.description ? (
                    <Text style={styles.placeDesc} numberOfLines={2}>{place.description}</Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F2F2F7',
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },

  content: { padding: 16, paddingBottom: 40 },

  profileCard: {
    backgroundColor: 'white', borderRadius: 20, padding: 24,
    alignItems: 'center', marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  avatarImg: { width: 80, height: 80, borderRadius: 40, marginBottom: 10 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#E6F1FB', alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  avatarTxt: { fontSize: 28, fontWeight: '800', color: '#185FA5' },
  levelBadge: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 12, marginBottom: 8 },
  levelTxt: { color: 'white', fontWeight: '800', fontSize: 12 },
  nickname: { fontSize: 18, fontWeight: '800', color: '#1C1C1E', marginBottom: 4 },
  email: { fontSize: 13, color: '#8E8E93', marginBottom: 16 },

  statsRow: { flexDirection: 'row', width: '100%' },
  statBox: { flex: 1, alignItems: 'center', gap: 4 },
  statVal: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 12, color: '#8E8E93' },
  statDivider: { width: 1, height: 36, backgroundColor: '#F2F2F7', alignSelf: 'center' },

  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#1C1C1E', marginBottom: 12, paddingHorizontal: 4 },

  placeCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'white',
    borderRadius: 16, marginBottom: 10, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  accentBar: { width: 4, alignSelf: 'stretch' },
  placeBody: { flex: 1, padding: 14 },
  placeTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  placeTitle: { fontSize: 15, fontWeight: '700', color: '#1C1C1E', flex: 1 },
  typePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  typePillTxt: { fontSize: 11, fontWeight: '700' },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  addrTxt: { fontSize: 12, color: '#8E8E93', flex: 1 },
  placeDesc: { fontSize: 13, color: '#3A3A3C', lineHeight: 18 },

  emptyBox: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTxt: { fontSize: 14, color: '#C7C7CC' },
});