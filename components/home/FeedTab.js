import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, RefreshControl, SafeAreaView, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../../firebaseConfig';
import { collection, query, orderBy, getDocs, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

// createdAt → "N분 전 / N시간 전 / N일 전" 변환
const timeAgo = (createdAt) => {
  if (!createdAt) return '';
  const date = createdAt?.toDate ? createdAt.toDate() : new Date(createdAt);
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
};

const FILTER_OPTIONS = ['전체', '추천', '주의'];

export default function FeedTab() {
  const router = useRouter();
  const [feedData, setFeedData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('전체');
  const [activeCategory, setActiveCategory] = useState('전체');
  const [searchText, setSearchText] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const fetchFeed = async () => {
    try {
      const myEmail = auth.currentUser?.email;
      const q = query(collection(db, 'places'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setFeedData(snap.docs.map(d => {
        const data = d.data();
        const likes = data.likes ?? [];
        return { id: d.id, ...data, likeCount: likes.length, liked: myEmail ? likes.includes(myEmail) : false };
      }));
    } catch (e) {
      console.log('피드 불러오기 오류:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchFeed(); }, []));

  const onRefresh = () => { setRefreshing(true); fetchFeed(); };

  const toggleLike = async (itemId) => {
    const myEmail = auth.currentUser?.email;
    if (!myEmail) return;
    const item = feedData.find(d => d.id === itemId);
    if (!item) return;
    const placeRef = doc(db, 'places', itemId);
    if (item.liked) {
      await updateDoc(placeRef, { likes: arrayRemove(myEmail) });
      setFeedData(prev => prev.map(d => d.id === itemId ? { ...d, liked: false, likeCount: d.likeCount - 1 } : d));
    } else {
      await updateDoc(placeRef, { likes: arrayUnion(myEmail) });
      setFeedData(prev => prev.map(d => d.id === itemId ? { ...d, liked: true, likeCount: d.likeCount + 1 } : d));
    }
  };

  const filteredData = feedData
    .filter(item => activeFilter === '전체' || (activeFilter === '추천' ? item.type === 'blue' : item.type === 'red'))
    .filter(item => activeCategory === '전체' || item.category === activeCategory)
    .filter(item => {
      if (!searchText.trim()) return true;
      const q = searchText.toLowerCase();
      return (
        (item.title ?? '').toLowerCase().includes(q) ||
        (item.description ?? '').toLowerCase().includes(q) ||
        (item.address ?? '').toLowerCase().includes(q) ||
        (item.tags ?? []).some(t => t.toLowerCase().includes(q))
      );
    });

  const goToDetail = (item) => {
    router.push({
      pathname: '/detail',
      params: {
        id: item.id,
        title: item.title,
        description: item.description,
        type: item.type,
        user: item.userNickname,
        userEmail: item.userEmail ?? '',
        address: item.address ?? '',
        detailAddress: item.detailAddress ?? '',
        imagePaths: encodeURIComponent(JSON.stringify(item.imagePaths ?? [])),
        tags: JSON.stringify(item.tags ?? []),
        category: item.category ?? '',
      }
    });
  };

  const renderFilterPill = (label) => {
    const isActive = activeFilter === label;
    const activeBg = label === '주의' ? '#FF3B30' : '#007AFF';
    return (
      <TouchableOpacity
        key={label}
        onPress={() => setActiveFilter(label)}
        style={[styles.filterPill, isActive && { backgroundColor: activeBg, borderColor: activeBg }]}
        activeOpacity={0.75}
      >
        {label === '추천' && (
          <Ionicons name="thumbs-up" size={12} color={isActive ? '#fff' : '#8E8E93'} style={{ marginRight: 4 }} />
        )}
        {label === '주의' && (
          <Ionicons name="alert-circle" size={12} color={isActive ? '#fff' : '#8E8E93'} style={{ marginRight: 4 }} />
        )}
        <Text style={[styles.filterPillText, isActive && { color: '#fff' }]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  const renderCard = ({ item }) => {
    const isRecommend = item.type === 'blue';
    const accentColor = isRecommend ? '#007AFF' : '#FF3B30';
    const tagBg = isRecommend ? '#EAF3FF' : '#FFF0EF';
    const nickname = item.userNickname ?? '익명';

    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => goToDetail(item)}>
        <View style={[styles.cardAccentBar, { backgroundColor: accentColor }]} />
        <View style={styles.cardInner}>
          <View style={styles.cardHeader}>
            <View style={styles.userRow}>
              <View style={[styles.avatar, { backgroundColor: accentColor + '22' }]}>
                <Text style={[styles.avatarText, { color: accentColor }]}>
                  {nickname === '익명' ? '?' : nickname[0].toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={styles.userName}>{nickname}</Text>
                <Text style={styles.timeText}>{timeAgo(item.createdAt)}</Text>
              </View>
            </View>
            <View style={[styles.tag, { backgroundColor: tagBg }]}>
              <Ionicons name={isRecommend ? 'thumbs-up' : 'alert-circle'} size={12} color={accentColor} />
              <Text style={[styles.tagText, { color: accentColor }]}>{isRecommend ? '추천' : '주의'}</Text>
            </View>
          </View>

          <Text style={styles.cardTitle}>{item.title}</Text>
          {item.description ? (
            <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
          ) : null}

          {/* 주소 */}
          {item.address ? (
            <View style={styles.addressRow}>
              <Ionicons name="location-outline" size={12} color="#8E8E93" />
              <Text style={styles.addressText} numberOfLines={1}>{item.address}</Text>
            </View>
          ) : null}

          {/* 태그 */}
          {item.tags?.length > 0 && (
            <View style={styles.tagRow}>
              {item.tags.slice(0, 3).map((tag, i) => (
                <View key={i} style={styles.tagChip}>
                  <Text style={styles.tagChipTxt}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={() => toggleLike(item.id)}>
              <Ionicons name={item.liked ? 'heart' : 'heart-outline'} size={18} color={item.liked ? '#FF2D55' : '#8E8E93'} />
              {item.likeCount > 0 && <Text style={[styles.actionCount, item.liked && { color: '#FF2D55' }]}>{item.likeCount}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={() => goToDetail(item)}>
              <Ionicons name="chatbubble-outline" size={17} color="#8E8E93" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
              <Ionicons name="bookmark-outline" size={17} color="#8E8E93" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerLabel}>FEED</Text>
            <Text style={styles.headerTitle}>피드</Text>
          </View>
          <TouchableOpacity style={[styles.iconBtn, isSearching && { backgroundColor: '#EAF3FF' }]} onPress={() => { setIsSearching(prev => !prev); setSearchText(''); }} activeOpacity={0.7}>
            <Ionicons name={isSearching ? 'close' : 'search-outline'} size={22} color={isSearching ? '#007AFF' : '#1C1C1E'} />
          </TouchableOpacity>
        </View>

        {isSearching && (
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={16} color="#8E8E93" />
            <TextInput
              style={styles.searchInput}
              placeholder="장소 이름, 태그, 주소 검색..."
              placeholderTextColor="#C7C7CC"
              value={searchText}
              onChangeText={setSearchText}
              autoFocus
              returnKeyType="search"
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText('')}>
                <Ionicons name="close-circle" size={16} color="#C7C7CC" />
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.filterRow}>
          {FILTER_OPTIONS.map(renderFilterPill)}
          <Text style={styles.resultCount}>{filteredData.length}개</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, alignItems: 'center', height: 44 }}>
          {[
            { id: '전체',     label: '전체' },
            { id: 'food',     label: '🍽️ 음식점' },
            { id: 'cafe',     label: '☕ 카페' },
            { id: 'nature',   label: '🌿 자연·공원' },
            { id: 'culture',  label: '🎨 문화·전시' },
            { id: 'popup',    label: '🎪 팝업' },
            { id: 'shop',     label: '🛍️ 쇼핑' },
            { id: 'hospital', label: '🏥 병원·약국' },
            { id: 'beauty',   label: '💇 미용' },
            { id: 'parking',  label: '🚗 주차장' },
            { id: 'stay',     label: '🏨 숙소' },
            { id: 'fitness',  label: '🏋️ 운동' },
            { id: 'study',    label: '📚 카공' },
            { id: 'play',     label: '🎮 오락' },
            { id: 'etc',      label: '📍 기타' },
          ].map(cat => (
            <TouchableOpacity
              key={cat.id}
              onPress={() => setActiveCategory(cat.id)}
              style={[styles.categoryPill, activeCategory === cat.id && styles.categoryPillActive]}
            >
              <Text style={[styles.categoryPillTxt, activeCategory === cat.id && styles.categoryPillTxtActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        ) : (
          <FlatList
            data={filteredData}
            keyExtractor={(item) => item.id}
            renderItem={renderCard}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#007AFF" />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="file-tray-outline" size={48} color="#C7C7CC" />
                <Text style={styles.emptyText}>아직 피드가 없어요</Text>
                <Text style={styles.emptySubText}>첫 번째 장소를 등록해보세요!</Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F2F2F7' },
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, backgroundColor: '#F2F2F7',
  },
  headerLabel: { fontSize: 11, fontWeight: '700', color: '#007AFF', letterSpacing: 1.5, marginBottom: 2 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#1C1C1E', letterSpacing: -0.5 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    marginHorizontal: 20, marginBottom: 10,
    borderWidth: 1.5, borderColor: '#E5E5EA',
  },
  searchInput: { flex: 1, fontSize: 15, color: '#1C1C1E' },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },

  filterRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14, gap: 8 },
  filterPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E5EA',
  },
  filterPillText: { fontSize: 13, fontWeight: '600', color: '#8E8E93' },
  resultCount: { marginLeft: 'auto', fontSize: 13, color: '#8E8E93', fontWeight: '500' },
  categoryScroll: { marginTop: -6, height: 44, marginBottom: 6 },
  categoryPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E5EA',
  },
  categoryPillActive: { backgroundColor: '#1C1C1E', borderColor: '#1C1C1E' },
  categoryPillTxt: { fontSize: 13, fontWeight: '600', color: '#8E8E93' },
  categoryPillTxtActive: { color: '#fff' },

  listContent: { paddingHorizontal: 16, paddingBottom: 100 },

  card: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 18,
    marginBottom: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
  },
  cardAccentBar: { width: 4, borderTopLeftRadius: 18, borderBottomLeftRadius: 18 },
  cardInner: { flex: 1, padding: 14 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700' },
  userName: { fontSize: 13, fontWeight: '700', color: '#1C1C1E' },
  timeText: { fontSize: 11, color: '#AEAEB2', marginTop: 1 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  tagText: { fontSize: 12, fontWeight: '700' },

  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1C1C1E', marginBottom: 5, letterSpacing: -0.2 },
  cardDesc: { fontSize: 14, color: '#3A3A3C', lineHeight: 20, marginBottom: 8 },

  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  addressText: { fontSize: 12, color: '#8E8E93', flex: 1 },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  tagChip: { backgroundColor: '#F2F2F7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  tagChipTxt: { fontSize: 11, color: '#3A3A3C', fontWeight: '500' },

  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    borderTopWidth: 1, borderTopColor: '#F2F2F7', paddingTop: 10,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionCount: { fontSize: 13, color: '#8E8E93', fontWeight: '500' },

  emptyState: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: '#8E8E93', marginTop: 8 },
  emptySubText: { fontSize: 13, color: '#AEAEB2' },
});