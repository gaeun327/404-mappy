import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const CATEGORIES = [
  { key: '전체',    icon: 'apps',              color: '#1C1C1E' },
  { key: '맛집공유', icon: 'restaurant',        color: '#FF6B35' },
  { key: '번개모임', icon: 'flash',             color: '#F59E0B' },
  { key: '자유수다', icon: 'chatbubbles',       color: '#10B981' },
  { key: '동네질문', icon: 'help-circle',       color: '#3B82F6' },
];

const ROOMS = [
  {
    id: '1',
    category: '자유수다',
    name: '우리동네 수다방',
    lastMsg: '오늘 날씨 진짜 좋네요~ 산책하기 딱!',
    unread: 12,
    active: 34,
    distance: '0.3km',
    time: '방금',
    members: 128,
    hot: true,
  },
  {
    id: '2',
    category: '맛집공유',
    name: '성수/뚝섬 맛집 탐방',
    lastMsg: '성수역 3번 출구 새로 생긴 라멘집 강추요',
    unread: 5,
    active: 18,
    distance: '0.7km',
    time: '2분 전',
    members: 256,
    hot: true,
  },
  {
    id: '3',
    category: '번개모임',
    name: '⚡ 오늘 저녁 치맥 번개',
    lastMsg: '6시 한강공원 어때요? 저 참여할게요',
    unread: 0,
    active: 7,
    distance: '1.2km',
    time: '5분 전',
    members: 12,
    hot: false,
  },
  {
    id: '4',
    category: '동네질문',
    name: '뚝섬 동네 정보방',
    lastMsg: '근처에 24시 약국 어디 있어요?',
    unread: 3,
    active: 9,
    distance: '0.5km',
    time: '11분 전',
    members: 89,
    hot: false,
  },
  {
    id: '5',
    category: '번개모임',
    name: '주말 한강 러닝 크루',
    lastMsg: '토요일 7시 뚝섬 집결! 참여하실 분~',
    unread: 0,
    active: 4,
    distance: '1.8km',
    time: '23분 전',
    members: 41,
    hot: false,
  },
  {
    id: '6',
    category: '맛집공유',
    name: '카페 정보 공유방 ☕',
    lastMsg: '망원동 오르에르 원두 진짜 맛있어요',
    unread: 1,
    active: 11,
    distance: '2.1km',
    time: '34분 전',
    members: 175,
    hot: false,
  },
];

const CATEGORY_META = {
  '자유수다': { color: '#10B981', bg: '#EDFAF4' },
  '맛집공유': { color: '#FF6B35', bg: '#FFF3EE' },
  '번개모임': { color: '#F59E0B', bg: '#FFFBEB' },
  '동네질문': { color: '#3B82F6', bg: '#EFF6FF' },
};

export default function CommunityTab() {
  const [activeCategory, setActiveCategory] = useState('전체');

  const filtered =
    activeCategory === '전체'
      ? ROOMS
      : ROOMS.filter((r) => r.category === activeCategory);

  const totalActive = ROOMS.reduce((sum, r) => sum + r.active, 0);

  const renderRoom = ({ item, index }) => {
    const meta = CATEGORY_META[item.category] ?? { color: '#8E8E93', bg: '#F2F2F7' };

    return (
      <TouchableOpacity style={styles.room} activeOpacity={0.8}>
        {/* Left: category icon circle */}
        <View style={[styles.roomIcon, { backgroundColor: meta.bg }]}>
          <Ionicons
            name={CATEGORIES.find((c) => c.key === item.category)?.icon ?? 'chatbubble'}
            size={20}
            color={meta.color}
          />
          {/* Active dot */}
          <View style={[styles.activeDot, { backgroundColor: item.active > 10 ? '#34C759' : '#AEAEB2' }]} />
        </View>

        {/* Center: info */}
        <View style={styles.roomInfo}>
          <View style={styles.roomTopRow}>
            <Text style={styles.roomName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.roomTime}>{item.time}</Text>
          </View>

          <View style={styles.roomMidRow}>
            {item.hot && (
              <View style={styles.hotBadge}>
                <Text style={styles.hotText}>🔥 HOT</Text>
              </View>
            )}
            <View style={[styles.catBadge, { backgroundColor: meta.bg }]}>
              <Text style={[styles.catBadgeText, { color: meta.color }]}>{item.category}</Text>
            </View>
          </View>

          <Text style={styles.lastMsg} numberOfLines={1}>{item.lastMsg}</Text>

          <View style={styles.roomBottomRow}>
            <View style={styles.metaItem}>
              <Ionicons name="people-outline" size={11} color="#AEAEB2" />
              <Text style={styles.metaText}>{item.members}명</Text>
            </View>
            <View style={styles.metaDot} />
            <View style={styles.metaItem}>
              <View style={[styles.onlineDot, { backgroundColor: item.active > 10 ? '#34C759' : '#AEAEB2' }]} />
              <Text style={styles.metaText}>활성 {item.active}명</Text>
            </View>
            <View style={styles.metaDot} />
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={11} color="#AEAEB2" />
              <Text style={styles.metaText}>{item.distance}</Text>
            </View>
          </View>
        </View>

        {/* Right: unread badge */}
        {item.unread > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{item.unread}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>NEARBY</Text>
          <Text style={styles.headerTitle}>동네 소통방</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} activeOpacity={0.8}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>방 만들기</Text>
        </TouchableOpacity>
      </View>

      {/* ── Live Banner ── */}
      <View style={styles.liveBanner}>
        <View style={styles.livePulse} />
        <Text style={styles.liveText}>
          지금 <Text style={styles.liveCount}>{totalActive}명</Text>이 근처에서 대화 중이에요
        </Text>
        <Ionicons name="chevron-forward" size={14} color="#8E8E93" />
      </View>

      {/* ── Category Filter ── */}
      <View style={styles.categoryWrap}>
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.key;
          return (
            <TouchableOpacity
              key={cat.key}
              style={[styles.catPill, isActive && { backgroundColor: '#1C1C1E' }]}
              onPress={() => setActiveCategory(cat.key)}
              activeOpacity={0.75}
            >
              <Ionicons
                name={cat.icon}
                size={13}
                color={isActive ? '#fff' : '#8E8E93'}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.catPillText, isActive && { color: '#fff' }]}>{cat.key}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Room List ── */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderRoom}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="chatbubbles-outline" size={44} color="#C7C7CC" />
            <Text style={styles.emptyText}>아직 채팅방이 없어요</Text>
            <Text style={styles.emptySub}>첫 번째 방을 만들어보세요!</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F2F2F7' },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 20,
    paddingTop: 16, paddingBottom: 12,
  },
  headerLabel: { fontSize: 11, fontWeight: '700', color: '#007AFF', letterSpacing: 1.5, marginBottom: 2 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#1C1C1E', letterSpacing: -0.5 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#1C1C1E', paddingHorizontal: 14,
    paddingVertical: 9, borderRadius: 20,
  },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Live Banner
  liveBanner: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 20, marginBottom: 14,
    backgroundColor: '#fff', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  livePulse: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#34C759',
  },
  liveText:  { flex: 1, fontSize: 13, color: '#3A3A3C' },
  liveCount: { fontWeight: '800', color: '#1C1C1E' },

  // Category
  categoryWrap: {
    flexDirection: 'row', paddingHorizontal: 20,
    gap: 8, marginBottom: 14, flexWrap: 'wrap',
  },
  catPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: '#E5E5EA',
  },
  catPillText: { fontSize: 13, fontWeight: '600', color: '#8E8E93' },

  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 30 },

  // Room card
  room: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 16,
    padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  roomIcon: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12, position: 'relative',
  },
  activeDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 10, height: 10, borderRadius: 5,
    borderWidth: 2, borderColor: '#fff',
  },
  roomInfo:      { flex: 1, gap: 3 },
  roomTopRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  roomName:      { fontSize: 15, fontWeight: '700', color: '#1C1C1E', flex: 1, marginRight: 8 },
  roomTime:      { fontSize: 11, color: '#AEAEB2' },
  roomMidRow:    { flexDirection: 'row', gap: 5, alignItems: 'center' },
  hotBadge:      { backgroundColor: '#FFF3EE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  hotText:       { fontSize: 10, fontWeight: '700', color: '#FF6B35' },
  catBadge:      { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  catBadgeText:  { fontSize: 11, fontWeight: '600' },
  lastMsg:       { fontSize: 13, color: '#8E8E93', marginTop: 1 },
  roomBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  metaItem:      { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText:      { fontSize: 11, color: '#AEAEB2' },
  metaDot:       { width: 2, height: 2, borderRadius: 1, backgroundColor: '#D1D1D6' },
  onlineDot:     { width: 6, height: 6, borderRadius: 3 },

  // Unread badge
  unreadBadge: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: '#FF3B30', alignItems: 'center',
    justifyContent: 'center', paddingHorizontal: 5, marginLeft: 8,
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  // Empty
  emptyBox:  { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: '#8E8E93', marginTop: 8 },
  emptySub:  { fontSize: 13, color: '#AEAEB2' },
});