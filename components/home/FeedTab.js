import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Animated,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const DUMMY_DATA = [
  {
    id: '1',
    user: 'khh',
    title: '성수 카페 강추 🔥',
    desc: '여기 분위기 진짜 좋아요. 조용하고 커피도 맛있어요!',
    type: '추천',
    likes: 24,
    comments: 5,
    time: '2분 전',
    liked: false,
  },
  {
    id: '2',
    user: '익명',
    title: '주차 주의!!',
    desc: 'ㅇㅇ 여기 주차장 없어서 진짜 고생했음. 대중교통 이용 추천.',
    type: '주의',
    likes: 8,
    comments: 2,
    time: '15분 전',
    liked: false,
  },
  {
    id: '3',
    user: 'seoul_life',
    title: '홍대 새로 생긴 라멘집',
    desc: '웨이팅 있지만 충분히 기다릴 가치 있음. 국물이 진짜 진해요.',
    type: '추천',
    likes: 61,
    comments: 13,
    time: '1시간 전',
    liked: true,
  },
  {
    id: '4',
    user: '도시탐험가',
    title: '연남동 골목 야간 주의',
    desc: '밤에 혼자 다니기엔 조명이 좀 부족해요. 낮에 방문 추천합니다.',
    type: '주의',
    likes: 19,
    comments: 4,
    time: '3시간 전',
    liked: false,
  },
];

const FILTER_OPTIONS = ['전체', '추천', '주의'];

export default function FeedTab() {
  const [activeFilter, setActiveFilter] = useState('전체');
  const [feedData, setFeedData] = useState(DUMMY_DATA);
  const [showWriteModal, setShowWriteModal] = useState(false);

  const filteredData =
    activeFilter === '전체'
      ? feedData
      : feedData.filter((item) => item.type === activeFilter);

  const handleLike = (id) => {
    setFeedData((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              liked: !item.liked,
              likes: item.liked ? item.likes - 1 : item.likes + 1,
            }
          : item,
      ),
    );
  };

  const renderFilterPill = (label) => {
    const isActive = activeFilter === label;
    const isRecommend = label === '추천';
    const isWarning = label === '주의';

    let activeBg = '#007AFF';
    if (isRecommend) activeBg = '#007AFF';
    if (isWarning) activeBg = '#FF3B30';

    return (
      <TouchableOpacity
        key={label}
        onPress={() => setActiveFilter(label)}
        style={[
          styles.filterPill,
          isActive && { backgroundColor: activeBg, borderColor: activeBg },
        ]}
        activeOpacity={0.75}
      >
        {isRecommend && (
          <Ionicons
            name="thumbs-up"
            size={12}
            color={isActive ? '#fff' : '#8E8E93'}
            style={{ marginRight: 4 }}
          />
        )}
        {isWarning && (
          <Ionicons
            name="alert-circle"
            size={12}
            color={isActive ? '#fff' : '#8E8E93'}
            style={{ marginRight: 4 }}
          />
        )}
        <Text style={[styles.filterPillText, isActive && { color: '#fff' }]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderCard = ({ item }) => {
    const isRecommend = item.type === '추천';
    const accentColor = isRecommend ? '#007AFF' : '#FF3B30';
    const tagBg = isRecommend ? '#EAF3FF' : '#FFF0EF';

    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.85}>
        {/* Left accent bar */}
        <View style={[styles.cardAccentBar, { backgroundColor: accentColor }]} />

        <View style={styles.cardInner}>
          {/* Header */}
          <View style={styles.cardHeader}>
            {/* Avatar + username */}
            <View style={styles.userRow}>
              <View style={[styles.avatar, { backgroundColor: accentColor + '22' }]}>
                <Text style={[styles.avatarText, { color: accentColor }]}>
                  {item.user === '익명' ? '?' : item.user[0].toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={styles.userName}>{item.user}</Text>
                <Text style={styles.timeText}>{item.time}</Text>
              </View>
            </View>

            {/* Type tag */}
            <View style={[styles.tag, { backgroundColor: tagBg }]}>
              <Ionicons
                name={isRecommend ? 'thumbs-up' : 'alert-circle'}
                size={12}
                color={accentColor}
              />
              <Text style={[styles.tagText, { color: accentColor }]}>
                {item.type}
              </Text>
            </View>
          </View>

          {/* Content */}
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardDesc}>{item.desc}</Text>

          {/* Social actions */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleLike(item.id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={item.liked ? 'heart' : 'heart-outline'}
                size={18}
                color={item.liked ? '#FF2D55' : '#8E8E93'}
              />
              <Text
                style={[
                  styles.actionCount,
                  item.liked && { color: '#FF2D55' },
                ]}
              >
                {item.likes}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
              <Ionicons
                name="chatbubble-outline"
                size={17}
                color="#8E8E93"
              />
              <Text style={styles.actionCount}>{item.comments}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
              <Ionicons
                name="bookmark-outline"
                size={17}
                color="#8E8E93"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { marginLeft: 'auto' }]}
              activeOpacity={0.7}
            >
              <Ionicons
                name="share-outline"
                size={17}
                color="#8E8E93"
              />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerLabel}>LIVE FEED</Text>
            <Text style={styles.headerTitle}>실시간 추천 피드</Text>
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
              <Ionicons name="notifications-outline" size={22} color="#1C1C1E" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
              <Ionicons name="search-outline" size={22} color="#1C1C1E" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Filter Pills ── */}
        <View style={styles.filterRow}>
          {FILTER_OPTIONS.map(renderFilterPill)}
          <Text style={styles.resultCount}>
            {filteredData.length}개
          </Text>
        </View>

        {/* ── Feed List ── */}
        <FlatList
          data={filteredData}
          keyExtractor={(item) => item.id}
          renderItem={renderCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="file-tray-outline" size={48} color="#C7C7CC" />
              <Text style={styles.emptyText}>아직 피드가 없어요</Text>
              <Text style={styles.emptySubText}>첫 번째 글을 작성해보세요!</Text>
            </View>
          }
        />

        {/* ── FAB: 글 작성 버튼 ── */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowWriteModal(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="pencil" size={22} color="#fff" />
          <Text style={styles.fabText}>글 작성</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#F2F2F7',
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#007AFF',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1C1C1E',
    letterSpacing: -0.5,
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 4,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },

  // ── Filter ──
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
  },
  resultCount: {
    marginLeft: 'auto',
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
  },

  // ── List ──
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },

  // ── Card ──
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 18,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  cardAccentBar: {
    width: 4,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  cardInner: {
    flex: 1,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
  },
  userName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  timeText: {
    fontSize: 11,
    color: '#AEAEB2',
    marginTop: 1,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 5,
    letterSpacing: -0.2,
  },
  cardDesc: {
    fontSize: 14,
    color: '#3A3A3C',
    lineHeight: 20,
    marginBottom: 12,
  },

  // ── Social Actions ──
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
    paddingTop: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionCount: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
  },

  // ── Empty State ──
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#8E8E93',
    marginTop: 8,
  },
  emptySubText: {
    fontSize: 13,
    color: '#AEAEB2',
  },

  // ── FAB ──
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  fabText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});