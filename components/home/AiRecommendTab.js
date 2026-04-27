import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ── 피드에 등록된 장소 더미 데이터 (실제 연동 시 props or store로 교체)
const FEED_PLACES = [
  {
    id: 'f1',
    name: '온더플레이트',
    category: '카페',
    location: '성수동',
    desc: '통창 뷰가 예쁜 감성 카페. 주말 웨이팅 있음.',
    tags: ['뷰 맛집', '데이트', '감성'],
    rating: 4.8,
    user: 'khh',
  },
  {
    id: 'f2',
    name: '카페 오르에르',
    category: '카페',
    location: '망원동',
    desc: '조용하고 작업하기 좋은 로컬 카페. 원두 직접 로스팅.',
    tags: ['혼자', '조용한', '작업'],
    rating: 4.6,
    user: 'local_guide',
  },
  {
    id: 'f3',
    name: '런던베이글뮤지엄',
    category: '음식점',
    location: '안국',
    desc: '베이글 맛집. 오픈런 필수.',
    tags: ['핫플', '친구들과'],
    rating: 4.5,
    user: '익명',
  },
  {
    id: 'f4',
    name: '을지다락',
    category: '바/펍',
    location: '을지로',
    desc: '레트로 감성 루프탑 바. 야경 뷰 최고.',
    tags: ['데이트', '뷰 맛집', '야간'],
    rating: 4.7,
    user: 'seoulnight',
  },
  {
    id: 'f5',
    name: '국립현대미술관 서울관',
    category: '전시',
    location: '삼청동',
    desc: '무료 상설전 있음. 카페도 분위기 좋아요.',
    tags: ['혼자', '데이트', '조용한'],
    rating: 4.4,
    user: 'art_lover',
  },
  {
    id: 'f6',
    name: '선유도공원',
    category: '공원',
    location: '선유도',
    desc: '한강 뷰 산책 코스. 가을에 특히 예쁨.',
    tags: ['혼자', '친구들과', '힐링'],
    rating: 4.6,
    user: 'walker_k',
  },
  {
    id: 'f7',
    name: '프릳츠 커피',
    category: '카페',
    location: '도화동',
    desc: '스페셜티 커피 명소. 빵도 맛있음.',
    tags: ['혼자', '핫플', '조용한'],
    rating: 4.7,
    user: 'coffee_kim',
  },
];

const CATEGORIES = [
  { n: '카페',   i: 'cafe',       color: '#8B5CF6', bg: '#F3EEFF' },
  { n: '음식점', i: 'restaurant', color: '#FF6B35', bg: '#FFF3EE' },
  { n: '팝업',   i: 'gift',       color: '#EC4899', bg: '#FFF0F7' },
  { n: '공원',   i: 'leaf',       color: '#10B981', bg: '#EDFAF4' },
  { n: '전시',   i: 'image',      color: '#F59E0B', bg: '#FFFBEB' },
  { n: '바/펍',  i: 'wine',       color: '#3B82F6', bg: '#EFF6FF' },
];

const MOOD_TAGS = ['혼자', '데이트', '친구들과', '조용한', '핫플', '뷰 맛집'];

export default function AiRecommendTab() {
  const [selectedCat, setSelectedCat]     = useState(null);
  const [selectedMoods, setSelectedMoods] = useState([]);
  const [results, setResults]             = useState(null);
  const [loading, setLoading]             = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const toggleMood = (mood) => {
    setSelectedMoods((prev) =>
      prev.includes(mood) ? prev.filter((m) => m !== mood) : [...prev, mood],
    );
  };

  const handleRecommend = () => {
    if (!selectedCat) return;
    setLoading(true);
    setResults(null);

    setTimeout(() => {
      const filtered = FEED_PLACES.filter((p) => p.category === selectedCat);
      const scored = filtered
        .map((p) => {
          const moodMatch = selectedMoods.filter((m) => p.tags.includes(m)).length;
          return { ...p, score: p.rating + moodMatch * 0.3 };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      setResults(scored.length > 0 ? scored : []);
      setLoading(false);
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }).start();
    }, 1200);
  };

  const handleReset = () => {
    setSelectedCat(null);
    setSelectedMoods([]);
    setResults(null);
  };

  const canSearch = !!selectedCat;
  const activeCatMeta = CATEGORIES.find((c) => c.n === selectedCat);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerLabel}>AI POWERED</Text>
          <Text style={styles.headerTitle}>장소 추천</Text>
          <Text style={styles.headerSub}>피드에 등록된 장소 중 AI가 골라드려요</Text>
        </View>

        {/* ── Category ── */}
        <Text style={styles.sectionLabel}>어떤 장소를 찾으시나요?</Text>
        <View style={styles.grid}>
          {CATEGORIES.map((item) => {
            const isActive = selectedCat === item.n;
            return (
              <TouchableOpacity
                key={item.n}
                style={[styles.catCard, { backgroundColor: isActive ? item.color : item.bg }]}
                onPress={() => { setSelectedCat(isActive ? null : item.n); setResults(null); }}
                activeOpacity={0.8}
              >
                <View style={[styles.catIconWrap, { backgroundColor: isActive ? 'rgba(255,255,255,0.22)' : '#fff' }]}>
                  <Ionicons name={item.i} size={22} color={isActive ? '#fff' : item.color} />
                </View>
                <Text style={[styles.catText, { color: isActive ? '#fff' : '#1C1C1E' }]}>{item.n}</Text>
                {isActive && (
                  <View style={styles.catCheck}>
                    <Ionicons name="checkmark-circle" size={16} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Mood ── */}
        <Text style={styles.sectionLabel}>
          분위기 <Text style={styles.optional}>(선택)</Text>
        </Text>
        <View style={styles.moodRow}>
          {MOOD_TAGS.map((mood) => {
            const isOn = selectedMoods.includes(mood);
            return (
              <TouchableOpacity
                key={mood}
                style={[styles.moodTag, isOn && styles.moodTagActive]}
                onPress={() => toggleMood(mood)}
                activeOpacity={0.75}
              >
                <Text style={[styles.moodTagText, isOn && styles.moodTagTextActive]}>{mood}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Button ── */}
        <TouchableOpacity
          style={[styles.searchBtn, !canSearch && styles.searchBtnDisabled]}
          onPress={handleRecommend}
          disabled={!canSearch || loading}
          activeOpacity={0.85}
        >
          <View style={styles.btnRow}>
            <Ionicons name="sparkles" size={18} color={canSearch ? '#fff' : '#AEAEB2'} />
            <Text style={[styles.searchBtnText, !canSearch && { color: '#AEAEB2' }]}>
              {loading ? '추천 장소 찾는 중...' : 'AI 추천 받기'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* ── Results ── */}
        {results !== null && !loading && (
          <Animated.View style={{ opacity: fadeAnim }}>
            {/* Result header */}
            <View style={styles.resultHeader}>
              <View style={styles.resultTitleRow}>
                <Ionicons name="sparkles" size={15} color={activeCatMeta?.color ?? '#8B5CF6'} />
                <Text style={[styles.resultTitle, { color: activeCatMeta?.color ?? '#8B5CF6' }]}>
                  {selectedCat} 추천 결과
                </Text>
                {selectedMoods.length > 0 && (
                  <Text style={styles.resultMoodBadge}>{selectedMoods.join(' · ')}</Text>
                )}
              </View>
              <TouchableOpacity onPress={handleReset} style={styles.resetBtn}>
                <Ionicons name="refresh" size={14} color="#8E8E93" />
                <Text style={styles.resetText}>다시</Text>
              </TouchableOpacity>
            </View>

            {/* Empty */}
            {results.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="file-tray-outline" size={40} color="#C7C7CC" />
                <Text style={styles.emptyText}>아직 등록된 {selectedCat} 장소가 없어요</Text>
                <Text style={styles.emptySubText}>피드에 먼저 장소를 추천해 주세요!</Text>
              </View>
            ) : (
              results.map((place, idx) => (
                <View
                  key={place.id}
                  style={[styles.resultCard, idx === 0 && { borderWidth: 1.5, borderColor: (activeCatMeta?.color ?? '#8B5CF6') + '55' }]}
                >
                  {idx === 0 && (
                    <View style={[styles.rankBadge, { backgroundColor: activeCatMeta?.color ?? '#8B5CF6' }]}>
                      <Ionicons name="trophy" size={11} color="#fff" />
                      <Text style={styles.rankBadgeText}>BEST</Text>
                    </View>
                  )}
                  <View style={styles.resultCardLeft}>
                    <View style={[
                      styles.rankNum,
                      idx === 0 && { backgroundColor: (activeCatMeta?.color ?? '#8B5CF6') + '18' },
                    ]}>
                      <Text style={[
                        styles.rankNumText,
                        idx === 0 && { color: activeCatMeta?.color ?? '#8B5CF6' },
                      ]}>
                        {idx + 1}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.resultCardBody}>
                    <View style={styles.resultNameRow}>
                      <Text style={styles.resultName}>{place.name}</Text>
                      <View style={styles.ratingBadge}>
                        <Ionicons name="star" size={11} color="#F59E0B" />
                        <Text style={styles.ratingText}>{place.rating}</Text>
                      </View>
                    </View>
                    <Text style={styles.resultLocation}>📍 {place.location}</Text>
                    <Text style={styles.resultDesc}>{place.desc}</Text>
                    <View style={styles.tagRow}>
                      {place.tags.slice(0, 3).map((t) => (
                        <View key={t} style={styles.tagChip}>
                          <Text style={styles.tagChipText}>#{t}</Text>
                        </View>
                      ))}
                    </View>
                    <Text style={styles.resultUser}>👤 {place.user}님이 등록</Text>
                  </View>
                </View>
              ))
            )}
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:      { flex: 1, backgroundColor: '#F2F2F7' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 50 },

  header:      { marginBottom: 24 },
  headerLabel: { fontSize: 11, fontWeight: '700', color: '#8B5CF6', letterSpacing: 1.5, marginBottom: 2 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#1C1C1E', letterSpacing: -0.5 },
  headerSub:   { fontSize: 13, color: '#8E8E93', marginTop: 4 },

  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#1C1C1E', marginBottom: 10, marginTop: 4 },
  optional:     { fontSize: 12, fontWeight: '400', color: '#AEAEB2' },

  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  catCard:     { width: '30.5%', borderRadius: 16, padding: 14, alignItems: 'center', position: 'relative' },
  catIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  catText:     { fontSize: 13, fontWeight: '600' },
  catCheck:    { position: 'absolute', top: 8, right: 8 },

  moodRow:           { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  moodTag:           { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E5EA' },
  moodTagActive:     { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' },
  moodTagText:       { fontSize: 13, fontWeight: '600', color: '#8E8E93' },
  moodTagTextActive: { color: '#fff' },

  searchBtn:         { justifyContent: 'center', alignItems: 'center', backgroundColor: '#8B5CF6', paddingVertical: 16, borderRadius: 16, marginBottom: 24, shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 12, elevation: 6 },
  searchBtnDisabled: { backgroundColor: '#E5E5EA', shadowOpacity: 0 },
  btnRow:            { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchBtnText:     { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },

  resultHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  resultTitleRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, flexWrap: 'wrap' },
  resultTitle:     { fontSize: 15, fontWeight: '800' },
  resultMoodBadge: { fontSize: 11, color: '#8E8E93', backgroundColor: '#F2F2F7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  resetBtn:        { flexDirection: 'row', alignItems: 'center', gap: 3 },
  resetText:       { fontSize: 12, color: '#8E8E93', fontWeight: '500' },

  resultCard:     { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, position: 'relative' },
  rankBadge:      { position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  rankBadgeText:  { fontSize: 10, fontWeight: '800', color: '#fff' },
  resultCardLeft: { marginRight: 12, justifyContent: 'flex-start', paddingTop: 2 },
  rankNum:        { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center' },
  rankNumText:    { fontSize: 14, fontWeight: '800', color: '#8E8E93' },
  resultCardBody: { flex: 1 },
  resultNameRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  resultName:     { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  ratingBadge:    { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#FFFBEB', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  ratingText:     { fontSize: 12, fontWeight: '700', color: '#F59E0B' },
  resultLocation: { fontSize: 12, color: '#8E8E93', marginBottom: 6 },
  resultDesc:     { fontSize: 13, color: '#3A3A3C', lineHeight: 19, marginBottom: 8 },
  tagRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 8 },
  tagChip:        { backgroundColor: '#F2F2F7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  tagChipText:    { fontSize: 11, color: '#8E8E93', fontWeight: '600' },
  resultUser:     { fontSize: 11, color: '#AEAEB2' },

  emptyBox:     { alignItems: 'center', paddingVertical: 40, backgroundColor: '#fff', borderRadius: 16, gap: 8 },
  emptyText:    { fontSize: 15, fontWeight: '700', color: '#8E8E93' },
  emptySubText: { fontSize: 13, color: '#AEAEB2' },
});