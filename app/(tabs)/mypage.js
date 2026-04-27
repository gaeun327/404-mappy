import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView, SafeAreaView
} from 'react-native';
import { auth, db } from '../../firebaseConfig';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const getLevel = (count) => {
  if (count >= 50) return { name: "전설의 탐험가 👑", color: "#8B5CF6", next: null, max: 50 };
  if (count >= 30) return { name: "지역 마스터 🥇",   color: "#FFD700", next: 50,   max: 50 };
  if (count >= 15) return { name: "동네 보안관 🥉",   color: "#FF6B35", next: 30,   max: 30 };
  if (count >= 7)  return { name: "로컬 탐험가 🔍",   color: "#007AFF", next: 15,   max: 15 };
  if (count >= 3)  return { name: "동네 입문자 🗺️",   color: "#00B4D8", next: 7,    max: 7  };
  return           { name: "새싹 탐험가 🌱",          color: "#34C759", next: 3,    max: 3  };
};

const DEMO_POSTS = [
  {
    id: 'demo_1',
    title: '성수 카페 강추 🔥',
    desc: '여기 분위기 진짜 좋아요. 조용하고 커피도 맛있어요!',
    type: '추천',
    location: '성수동',
    likes: 24,
    comments: 5,
    time: '2분 전',
    isDemo: true,
  },
];

export default function MyPage() {
  const router = useRouter();
  const [myPlaces, setMyPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');

  useEffect(() => {
    if (auth.currentUser) fetchMyPlaces();
  }, []);

  const fetchMyPlaces = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'places'),
        where('userEmail', '==', auth.currentUser?.email),
      );
      const snap = await getDocs(q);
      setMyPlaces(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.log('데이터 로딩 에러:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (placeId) => {
    Alert.alert('장소 삭제', '정말 이 기록을 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          await deleteDoc(doc(db, 'places', placeId));
          setMyPlaces((prev) => prev.filter((p) => p.id !== placeId));
        },
      },
    ]);
  };

  const level = getLevel(myPlaces.length);
  const progressPercent = level.next ? (myPlaces.length / level.next) * 100 : 100;
  const progressLabel = level.next
    ? `다음 레벨까지 ${level.next - myPlaces.length}개`
    : '최고 레벨 달성! 🎉';
  const totalLikes = DEMO_POSTS.reduce((s, p) => s + p.likes, 0);

  const allPosts = [
    ...DEMO_POSTS,
    ...myPlaces.map((p) => ({
      id: p.id, title: p.title, desc: p.description ?? '',
      type: '추천', location: p.location ?? '',
      likes: 0, comments: 0, time: '',
      isDemo: false,
    })),
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={20} color="#1C1C1E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>내 정보</Text>
        <TouchableOpacity
          onPress={() => auth.signOut().then(() => router.replace('/'))}
          style={styles.logoutBtn}
        >
          <Text style={styles.logoutText}>로그아웃</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* ── Profile Card ── */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={32} color="#8B5CF6" />
            </View>
          </View>
          <View style={[styles.levelBadge, { backgroundColor: level.color }]}>
            <Text style={styles.levelText}>{level.name}</Text>
          </View>
          <Text style={styles.userEmail}>{auth.currentUser?.email}</Text>

          {/* 레벨 진행도 바 */}
          <View style={styles.progressWrap}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>{progressLabel}</Text>
              <Text style={styles.progressCount}>{myPlaces.length}개 등록</Text>
            </View>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, {
                width: `${progressPercent}%`,
                backgroundColor: level.color,
              }]} />
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{allPosts.length}</Text>
              <Text style={styles.statLabel}>등록 장소</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statBox}>
              <Text style={[styles.statVal, { color: '#FF2D55' }]}>{totalLikes}</Text>
              <Text style={styles.statLabel}>받은 좋아요</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statBox}>
              <Text style={[styles.statVal, { color: '#F59E0B' }]}>{myPlaces.length * 100}P</Text>
              <Text style={styles.statLabel}>내 포인트</Text>
            </View>
          </View>
        </View>

        {/* ── Tabs ── */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'posts' && styles.tabBtnActive]}
            onPress={() => setActiveTab('posts')}
            activeOpacity={0.8}
          >
            <Ionicons name="document-text-outline" size={14} color={activeTab === 'posts' ? '#fff' : '#8E8E93'} />
            <Text style={[styles.tabBtnText, activeTab === 'posts' && { color: '#fff' }]}>내가 공유한 로컬 스팟</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'saved' && styles.tabBtnActive]}
            onPress={() => setActiveTab('saved')}
            activeOpacity={0.8}
          >
            <Ionicons name="bookmark-outline" size={14} color={activeTab === 'saved' ? '#fff' : '#8E8E93'} />
            <Text style={[styles.tabBtnText, activeTab === 'saved' && { color: '#fff' }]}>저장한 장소</Text>
          </TouchableOpacity>
        </View>

        {/* ── Posts Tab ── */}
        {activeTab === 'posts' && (
          <View style={styles.section}>
            {loading ? (
              <ActivityIndicator size="small" color="#007AFF" style={{ marginTop: 20 }} />
            ) : allPosts.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="leaf-outline" size={40} color="#C7C7CC" />
                <Text style={styles.emptyText}>아직 등록한 장소가 없네요 🌱</Text>
              </View>
            ) : (
              allPosts.map((post) => (
                <View key={post.id} style={styles.postCard}>
                  <View style={styles.postAccent} />
                  <View style={styles.postBody}>
                    <View style={styles.postTopRow}>
                      <View style={styles.postTypeBadge}>
                        <Ionicons name="thumbs-up" size={11} color="#007AFF" />
                        <Text style={styles.postTypeText}>{post.type}</Text>
                      </View>
                      {post.location ? <Text style={styles.postLocation}>📍 {post.location}</Text> : null}
                      {post.time ? <Text style={styles.postTime}>{post.time}</Text> : null}
                    </View>
                    <Text style={styles.postTitle}>{post.title}</Text>
                    {post.desc ? <Text style={styles.postDesc} numberOfLines={2}>{post.desc}</Text> : null}
                    <View style={styles.postActionRow}>
                      {post.likes > 0 && (
                        <View style={styles.postStat}>
                          <Ionicons name="heart" size={13} color="#FF2D55" />
                          <Text style={styles.postStatText}>{post.likes}</Text>
                        </View>
                      )}
                      {post.comments > 0 && (
                        <View style={styles.postStat}>
                          <Ionicons name="chatbubble-outline" size={13} color="#8E8E93" />
                          <Text style={styles.postStatText}>{post.comments}</Text>
                        </View>
                      )}
                      {!post.isDemo && (
                        <TouchableOpacity onPress={() => handleDelete(post.id)} style={styles.deleteBtn}>
                          <Ionicons name="trash-outline" size={15} color="#FF3B30" />
                          <Text style={styles.deleteBtnText}>삭제</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* ── Saved Tab ── */}
        {activeTab === 'saved' && (
          <View style={styles.section}>
            <View style={styles.emptyBox}>
              <Ionicons name="bookmark-outline" size={40} color="#C7C7CC" />
              <Text style={styles.emptyText}>저장한 장소가 없어요</Text>
              <Text style={styles.emptySub}>피드에서 마음에 드는 장소를 저장해보세요!</Text>
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:      { flex: 1, backgroundColor: '#F2F2F7' },
  scrollContent: { paddingBottom: 40 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 20,
    paddingVertical: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#F2F2F7',
  },
  iconBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1C1C1E' },
  logoutBtn:   { paddingHorizontal: 4 },
  logoutText:  { color: '#FF3B30', fontSize: 14, fontWeight: '600' },
  profileCard: {
    backgroundColor: '#fff', margin: 16, borderRadius: 20,
    padding: 24, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  avatarWrap: { marginBottom: 10 },
  avatar: {
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: '#F3EEFF',
    alignItems: 'center', justifyContent: 'center',
  },
  levelBadge:    { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, marginBottom: 8 },
  levelText:     { color: '#fff', fontWeight: '800', fontSize: 13 },
  userEmail:     { fontSize: 15, fontWeight: '600', color: '#1C1C1E', marginBottom: 16 },
  progressWrap:  { width: '100%', marginBottom: 20 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 12, color: '#8E8E93' },
  progressCount: { fontSize: 12, color: '#8E8E93' },
  progressBg:    { height: 6, backgroundColor: '#F2F2F7', borderRadius: 3, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: 3 },
  statsRow:      { flexDirection: 'row', width: '100%' },
  statBox:       { flex: 1, alignItems: 'center', gap: 4 },
  statVal:       { fontSize: 20, fontWeight: '800', color: '#007AFF' },
  statLabel:     { fontSize: 11, color: '#8E8E93' },
  divider:       { width: 1, height: 36, backgroundColor: '#F2F2F7', alignSelf: 'center' },
  tabRow: {
    flexDirection: 'row', marginHorizontal: 16,
    backgroundColor: '#fff', borderRadius: 14,
    padding: 4, marginBottom: 14, gap: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 5,
    paddingVertical: 9, borderRadius: 10,
  },
  tabBtnActive:  { backgroundColor: '#1C1C1E' },
  tabBtnText:    { fontSize: 12, fontWeight: '600', color: '#8E8E93' },
  section:       { paddingHorizontal: 16 },
  postCard: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderRadius: 16, marginBottom: 10, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  postAccent:    { width: 4, backgroundColor: '#007AFF' },
  postBody:      { flex: 1, padding: 14 },
  postTopRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  postTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#EAF3FF', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  postTypeText:  { fontSize: 11, fontWeight: '700', color: '#007AFF' },
  postLocation:  { fontSize: 11, color: '#8E8E93' },
  postTime:      { fontSize: 11, color: '#AEAEB2', marginLeft: 'auto' },
  postTitle:     { fontSize: 16, fontWeight: '700', color: '#1C1C1E', marginBottom: 4 },
  postDesc:      { fontSize: 13, color: '#3A3A3C', lineHeight: 19, marginBottom: 10 },
  postActionRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  postStat:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  postStatText:  { fontSize: 12, color: '#8E8E93', fontWeight: '500' },
  deleteBtn:     { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 'auto' },
  deleteBtnText: { fontSize: 12, color: '#FF3B30', fontWeight: '600' },
  emptyBox:      { alignItems: 'center', paddingVertical: 50, gap: 8 },
  emptyText:     { fontSize: 15, fontWeight: '700', color: '#8E8E93', marginTop: 8 },
  emptySub:      { fontSize: 13, color: '#AEAEB2', textAlign: 'center' },
});