import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  SafeAreaView, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../../firebaseConfig';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

const CATEGORY_MAP = {
  food: '🍽️ 음식점', cafe: '☕ 카페·디저트', nature: '🌿 자연·공원',
  culture: '🎨 문화·전시', popup: '🎪 팝업·이벤트', shop: '🛍️ 쇼핑',
  hospital: '🏥 병원·약국', beauty: '💇 미용', parking: '🚗 주차장',
  stay: '🏨 숙소', fitness: '🏋️ 운동·헬스', study: '📚 카공·스터디',
  play: '🎮 오락·취미', etc: '📍 기타',
};

const QUICK_PROMPTS = [
  '혼자 조용히 공부하기 좋은 곳 추천해줘',
  '친구들이랑 갈 만한 맛집 있어?',
  '데이트하기 좋은 분위기 있는 카페',
  '야경 볼 수 있는 곳 알려줘',
  '가성비 좋은 곳 추천해줘',
  '요즘 핫한 팝업 있어?',
];

export default function AiRecommendTab() {
  const router = useRouter();
  const scrollRef = useRef(null);
  const [allPlaces, setAllPlaces] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: '안녕하세요! 어떤 장소를 찾고 계신가요? 🗺️\n자유롭게 말씀해주세요!',
      places: [],
    }
  ]);
  const [input, setInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useFocusEffect(useCallback(() => {
    fetchPlaces();
  }, []));

  const fetchPlaces = async () => {
    setDataLoading(true);
    try {
      const myUid = auth.currentUser?.uid;
      if (!myUid) return;

      const myDoc = await getDoc(doc(db, 'users', myUid));
      const friendUids = myDoc.exists() ? (myDoc.data().friends ?? []) : [];
      const allowedUids = [myUid, ...friendUids];

      const q = query(collection(db, 'places'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const filtered = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => allowedUids.includes(p.userUid));
      setAllPlaces(filtered);
    } catch (e) { console.log('장소 불러오기 오류:', e); }
    finally { setDataLoading(false); }
  };

  const sendMessage = async (text) => {
    if (!text.trim() || aiLoading) return;
    const userMsg = { role: 'user', text: text.trim(), places: [] };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setAiLoading(true);

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      // 피드 데이터를 Claude에게 컨텍스트로 전달
      const placesContext = allPlaces.slice(0, 50).map(p => ({
        id: p.id,
        title: p.title,
        category: CATEGORY_MAP[p.category] ?? p.category ?? '기타',
        type: p.type === 'blue' ? '추천' : '주의',
        address: p.address ?? '',
        description: p.description ?? '',
        tags: p.tags ?? [],
        likes: (p.likes ?? []).length,
      }));

      const systemPrompt = `당신은 Mappy 앱의 장소 추천 AI입니다. 
사용자의 요청에 맞는 장소를 피드 데이터에서 찾아 추천해주세요.

피드에 등록된 장소 데이터 (JSON):
${JSON.stringify(placesContext, null, 2)}

규칙:
1. 반드시 위 데이터에 있는 장소만 추천하세요.
2. 응답은 반드시 아래 JSON 형식으로만 해주세요 (다른 텍스트 없이):
{
  "message": "사용자에게 전달할 친근한 추천 메시지 (2-3문장)",
  "recommendedIds": ["장소id1", "장소id2", "장소id3"]
}
3. 적합한 장소가 없으면 recommendedIds를 빈 배열로 하고 message에 안내 메시지를 써주세요.
4. 최대 3개까지만 추천하세요.
5. message는 한국어로, 친근하고 자연스럽게 써주세요.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              { role: 'user', parts: [{ text: systemPrompt }] },
              { role: 'model', parts: [{ text: '네, 피드 데이터를 분석해서 JSON 형식으로 추천해드릴게요.' }] },
              { role: 'user', parts: [{ text: text.trim() }] },
            ],
            generationConfig: { temperature: 0.7, maxOutputTokens: 1000 },
          }),
        }
      );

      const data = await response.json();
      console.log('Gemini 응답:', JSON.stringify(data).slice(0, 300));
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
      console.log('raw text:', raw);

      let parsed = { message: '죄송해요, 추천을 찾지 못했어요.', recommendedIds: [] };
      try {
        // 마크다운 코드블록, 앞뒤 공백 제거
        const clean = raw.replace(/```json/g, '').replace(/```/g, '').trim();
        parsed = JSON.parse(clean);
      } catch (e) {
        console.log('JSON 파싱 오류:', e, 'raw:', raw);
        // JSON 파싱 실패시 raw 텍스트 그대로 메시지로
        parsed.message = raw || '죄송해요, 다시 시도해주세요.';
      }

      const recommendedPlaces = (parsed.recommendedIds ?? [])
        .map(id => allPlaces.find(p => p.id === id))
        .filter(Boolean);

      const aiMsg = {
        role: 'assistant',
        text: parsed.message,
        places: recommendedPlaces,
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e) {
      console.log('AI 오류:', e);
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: '오류가 발생했어요. 잠시 후 다시 시도해주세요.',
        places: [],
      }]);
    } finally {
      setAiLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const goToDetail = (place) => {
    router.push({
      pathname: '/detail',
      params: {
        id: place.id,
        title: place.title,
        description: place.description,
        type: place.type,
        user: place.userNickname,
        userEmail: place.userEmail ?? '',
        address: place.address ?? '',
        detailAddress: place.detailAddress ?? '',
        imagePaths: encodeURIComponent(JSON.stringify(place.imagePaths ?? [])),
        tags: JSON.stringify(place.tags ?? []),
        category: place.category ?? '',
      }
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {/* 헤더 */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.aiDot} />
            <Text style={styles.headerLabel}>AI MAPPY</Text>
          </View>
          <Text style={styles.headerTitle}>장소 추천</Text>
          <Text style={styles.headerSub}>
            {dataLoading ? '데이터 불러오는 중...' : `${allPlaces.length}개 장소 분석 완료`}
          </Text>
        </View>

        {/* 채팅 영역 */}
        <ScrollView
          ref={scrollRef}
          style={styles.chatArea}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 빠른 질문 버튼 */}
          {messages.length === 1 && (
            <View style={styles.quickSection}>
              <Text style={styles.quickLabel}>자주 찾는 질문</Text>
              <View style={styles.quickWrap}>
                {QUICK_PROMPTS.map((q, i) => (
                  <TouchableOpacity key={i} style={styles.quickBtn} onPress={() => sendMessage(q)} activeOpacity={0.7}>
                    <Ionicons name="search-outline" size={13} color="#8B5CF6" style={{ marginRight: 6 }} />
                    <Text style={styles.quickBtnTxt}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* 메시지 목록 */}
          {messages.map((msg, idx) => (
            <View key={idx}>
              <View style={[styles.bubble, msg.role === 'user' ? styles.bubbleUser : styles.bubbleAi]}>
                {msg.role === 'assistant' && (
                  <View style={styles.aiAvatar}>
                    <Ionicons name="sparkles" size={13} color="white" />
                  </View>
                )}
                <View style={[styles.bubbleInner, msg.role === 'user' ? styles.bubbleInnerUser : styles.bubbleInnerAi]}>
                  <Text style={[styles.bubbleTxt, msg.role === 'user' && { color: 'white' }]}>{msg.text}</Text>
                </View>
              </View>

              {/* 추천 장소 카드 */}
              {msg.places?.length > 0 && (
                <View style={styles.placeCards}>
                  <Text style={styles.placeCardsLabel}>추천 장소 {msg.places.length}곳</Text>
                  {msg.places.map((place, pi) => (
                    <TouchableOpacity key={pi} style={styles.placeCard} onPress={() => goToDetail(place)} activeOpacity={0.85}>
                      <View style={[styles.placeRankBadge, pi === 0 && styles.placeRankBadgeFirst]}>
                        <Text style={[styles.placeRank, pi === 0 && { color: '#fff' }]}>{pi + 1}</Text>
                      </View>
                      <View style={styles.placeCardBody}>
                        <View style={styles.placeNameRow}>
                          <Text style={styles.placeName} numberOfLines={1}>{place.title}</Text>
                          <View style={[styles.typePill, { backgroundColor: place.type === 'blue' ? '#EAF3FF' : '#FFF0EF' }]}>
                            <Text style={[styles.typePillTxt, { color: place.type === 'blue' ? '#007AFF' : '#FF3B30' }]}>
                              {place.type === 'blue' ? '👍 추천' : '👎 주의'}
                            </Text>
                          </View>
                        </View>
                        {place.address ? (
                          <View style={styles.addrRow}>
                            <Ionicons name="location-outline" size={11} color="#AEAEB2" />
                            <Text style={styles.placeAddr} numberOfLines={1}>{place.address}</Text>
                          </View>
                        ) : null}
                        {place.description ? <Text style={styles.placeDesc} numberOfLines={2}>{place.description}</Text> : null}
                        {place.tags?.length > 0 && (
                          <View style={styles.tagRow}>
                            {place.tags.slice(0, 3).map((t, ti) => (
                              <View key={ti} style={styles.tagChip}>
                                <Text style={styles.tagChipTxt}>{t}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                      <View style={styles.chevronWrap}>
                        <Ionicons name="chevron-forward" size={14} color="#8B5CF6" />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ))}

          {/* AI 로딩 */}
          {aiLoading && (
            <View style={styles.bubbleAi}>
              <View style={styles.aiAvatar}>
                <Ionicons name="sparkles" size={13} color="white" />
              </View>
              <View style={styles.loadingBubble}>
                <ActivityIndicator size="small" color="#8B5CF6" />
                <Text style={styles.loadingTxt}>장소 분석 중</Text>
                <Text style={styles.loadingDots}>...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* 입력창 */}
        <View style={styles.inputBar}>
          <View style={styles.inputWrap}>
            <Ionicons name="location-outline" size={16} color="#8B5CF6" style={{ marginLeft: 14 }} />
            <TextInput
              style={styles.input}
              placeholder={dataLoading ? '데이터 로딩 중...' : '어떤 장소를 찾으세요?'}
              placeholderTextColor="#C7C7CC"
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={200}
              editable={!dataLoading}
              returnKeyType="send"
              onSubmitEditing={() => sendMessage(input)}
            />
          </View>
          <TouchableOpacity
            style={[styles.sendBtn, { opacity: input.trim() && !aiLoading ? 1 : 0.35 }]}
            onPress={() => sendMessage(input)}
            disabled={!input.trim() || aiLoading || dataLoading}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-up" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAFAFA' },

  header: {
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1, borderBottomColor: '#F0F0F5',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  aiDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#8B5CF6' },
  headerLabel: { fontSize: 11, fontWeight: '800', color: '#8B5CF6', letterSpacing: 2 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#1C1C1E', letterSpacing: -0.5, marginBottom: 2 },
  headerSub: { fontSize: 12, color: '#AEAEB2', fontWeight: '500' },

  chatArea: { flex: 1, backgroundColor: '#FAFAFA' },
  chatContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20 },

  quickSection: { marginBottom: 24 },
  quickLabel: { fontSize: 12, fontWeight: '700', color: '#AEAEB2', letterSpacing: 0.5, marginBottom: 10 },
  quickWrap: { gap: 8 },
  quickBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 11, borderRadius: 14,
    backgroundColor: 'white',
    borderWidth: 1, borderColor: '#EEE8FF',
    shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 1,
  },
  quickBtnTxt: { fontSize: 13, color: '#3A3A3C', fontWeight: '500', flex: 1 },

  bubble: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 14 },
  bubbleUser: { justifyContent: 'flex-end', marginBottom: 14 },
  bubbleAi: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 14 },
  aiAvatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#8B5CF6',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
    shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3,
  },
  bubbleInner: { maxWidth: '78%', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12 },
  bubbleInnerUser: {
    backgroundColor: '#8B5CF6', borderBottomRightRadius: 4,
    shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  bubbleInnerAi: {
    backgroundColor: 'white', borderBottomLeftRadius: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  bubbleTxt: { fontSize: 15, color: '#1C1C1E', lineHeight: 23 },

  loadingBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'white', borderRadius: 20, borderBottomLeftRadius: 4,
    paddingHorizontal: 16, paddingVertical: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  loadingTxt: { fontSize: 14, color: '#8B5CF6', fontWeight: '600' },
  loadingDots: { fontSize: 14, color: '#C4B5FD' },

  placeCards: { marginLeft: 38, marginBottom: 14, gap: 10 },
  placeCardsLabel: { fontSize: 11, fontWeight: '700', color: '#AEAEB2', letterSpacing: 0.5, marginBottom: 6 },
  placeCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'white', borderRadius: 18, padding: 14, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
    borderWidth: 1, borderColor: '#F5F5F5',
  },
  placeRankBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#F3EEFF', alignItems: 'center', justifyContent: 'center',
  },
  placeRankBadgeFirst: { backgroundColor: '#8B5CF6' },
  placeRank: { fontSize: 13, fontWeight: '800', color: '#8B5CF6' },
  placeCardBody: { flex: 1 },
  placeNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' },
  placeName: { fontSize: 15, fontWeight: '700', color: '#1C1C1E', flex: 1 },
  typePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  typePillTxt: { fontSize: 11, fontWeight: '700' },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 4 },
  placeAddr: { fontSize: 11, color: '#AEAEB2', flex: 1 },
  placeDesc: { fontSize: 13, color: '#6B6B6B', lineHeight: 18, marginBottom: 6 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  tagChip: { backgroundColor: '#F5F0FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  tagChipTxt: { fontSize: 11, color: '#8B5CF6', fontWeight: '600' },
  chevronWrap: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#F5F0FF', alignItems: 'center', justifyContent: 'center',
  },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 30 : 12,
    backgroundColor: 'white',
    borderTopWidth: 1, borderTopColor: '#F0F0F5',
  },
  inputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5F0FF', borderRadius: 24,
    borderWidth: 1.5, borderColor: '#EEE8FF',
  },
  input: {
    flex: 1, paddingHorizontal: 12, paddingVertical: 12,
    fontSize: 15, color: '#1C1C1E', maxHeight: 100,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#8B5CF6', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 5,
  },
});