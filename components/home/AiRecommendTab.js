import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  SafeAreaView, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../../firebaseConfig';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { useFocusEffect } from 'expo-router';
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
  '혼자 공부하기 좋은 곳',
  '친구들과 갈 맛집',
  '데이트하기 좋은 카페',
  '야경 보기 좋은 곳',
  '가성비 좋은 곳',
  '요즘 핫한 팝업',
];

export default function AiRecommendTab() {
  const router = useRouter();
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const scrollRef = useRef(null);
  const [allPlaces, setAllPlaces] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
text: '오늘은 어떤 곳을 찾고 계신가요? ✨\n친구들의 장소 기록에서 딱 맞는 곳을 찾아드릴게요.',      places: [],
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
      // 피드 데이터를 Gemini에게 컨텍스트로 전달
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

     const systemPrompt = `당신은 MAPPY 앱의 장소 추천 AI입니다.
사용자의 요청에 맞는 장소를 지인들이 등록한 장소 데이터에서 찾아 추천해주세요.

등록된 장소 데이터 (JSON):
${JSON.stringify(placesContext, null, 2)}

규칙:
1. 반드시 위 데이터에 존재하는 장소만 추천하세요.

2. 사용자의 요청과 각 장소의 카테고리, 설명, 태그,
추천·주의 기록, 좋아요 수를 종합해서 적합한 장소를 선택하세요.

3. 각 장소를 추천한 이유를 반드시 작성하세요.
추천 이유는 위에 제공된 장소 데이터에 근거해야 하며,
데이터에 없는 정보는 추측하거나 만들어내지 마세요.

4. 응답은 반드시 아래 JSON 형식으로만 작성하세요.
다른 텍스트는 작성하지 마세요.

{
  "message": "추천 결과를 소개하는 친근한 메시지",
  "recommendations": [
    {
      "id": "장소id",
      "reason": "이 장소를 추천한 이유"
    }
  ]
}

5. 최대 3개의 장소만 추천하세요.

6. 적합한 장소가 없으면 recommendations를 빈 배열로 작성하고,
message에 조건에 맞는 장소가 없다고 안내하세요.

7. message와 reason은 한국어로 친근하고 자연스럽게 작성하세요.

8. 추천 이유는 장소당 1~2문장으로 짧게 작성하세요.

9. 사용자가 요청한 조건과 직접 관련 있는 정보를 우선적으로 고려하세요.

10. 좋아요 수는 참고 요소로만 사용하고,
사용자의 요청 조건과의 일치도를 더 중요하게 판단하세요.

11. '친구들이 많이 좋아하는 곳', '인기 있는 곳' 등
제공된 데이터만으로 확인할 수 없는 사실은 단정하지 마세요.`;

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
            generationConfig: {
  temperature: 0.4,
  maxOutputTokens: 2000,
  responseMimeType: 'application/json',
responseSchema: {
  type: 'OBJECT',
  properties: {
    message: {
      type: 'STRING',
    },

    recommendations: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: {
            type: 'STRING',
          },
          reason: {
            type: 'STRING',
          },
        },
        required: ['id', 'reason'],
      },
    },
  },

  required: [
    'message',
    'recommendations',
  ],
},
},
          }),
        }
      );

      const data = await response.json();
      console.log('Gemini 응답:', JSON.stringify(data).slice(0, 300));
const raw = (
  data.candidates?.[0]?.content?.parts ?? []
)
  .map(part => part.text ?? '')
  .join('')
  .trim();      console.log('raw text:', raw);

      let parsed = { message: '죄송해요, 추천을 찾지 못했어요.', recommendations: [] };
      try {
        // 마크다운 코드블록, 앞뒤 공백 제거
        const clean = raw.replace(/```json/g, '').replace(/```/g, '').trim();
        parsed = JSON.parse(clean);
      } catch (e) {
  console.log('JSON 파싱 오류:', e, 'raw:', raw);

  parsed = {
    message: '추천 결과를 불러오지 못했어요. 다시 한 번 질문해주세요!',
    recommendations: [],
  };
}

    const recommendedPlaces = (parsed.recommendations ?? [])
  .map((recommendation) => {
    const place = allPlaces.find(
      (p) => p.id === recommendation.id
    );

    if (!place) return null;

    return {
      ...place,
      aiReason: recommendation.reason,
    };
  })
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
        keyboardVerticalOffset={0}
      >
        {/* 헤더 */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.aiDot} />
            <Text style={styles.headerLabel}>AI MAPPY</Text>
          </View>
<Text style={styles.headerTitle}>장소 추천</Text>

<Text style={styles.headerSub}>
  {dataLoading
    ? '친구들의 장소 기록을 불러오는 중...'
    : `친구들과 공유한 ${allPlaces.length}개의 장소를 바탕으로 추천해요`}
</Text>
        </View>

        {/* 채팅 영역 */}
        <ScrollView
          ref={scrollRef}
          style={styles.chatArea}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
        >
          {/* MAPPY 추천 기준 */}
{messages.length === 1 && !dataLoading && (
  <View style={styles.criteriaCard}>
    <View style={styles.criteriaHeader}>
      <View style={styles.criteriaIcon}>
        <Ionicons name="sparkles" size={14} color="#8B5CF6" />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.criteriaTitle}>
          MAPPY의 추천 기준
        </Text>
        <Text style={styles.criteriaSub}>
          내 요청과 지인들의 장소 기록을 함께 분석해요
        </Text>
      </View>
    </View>

    <View style={styles.criteriaItems}>
      <View style={styles.criteriaItem}>
        <Ionicons name="people-outline" size={15} color="#8B5CF6" />
        <Text style={styles.criteriaItemText}>지인 장소</Text>
      </View>

      <View style={styles.criteriaItem}>
        <Ionicons name="pricetag-outline" size={15} color="#8B5CF6" />
        <Text style={styles.criteriaItemText}>태그</Text>
      </View>

      <View style={styles.criteriaItem}>
        <Ionicons name="thumbs-up-outline" size={15} color="#8B5CF6" />
        <Text style={styles.criteriaItemText}>추천·주의</Text>
      </View>

      <View style={styles.criteriaItem}>
        <Ionicons name="heart-outline" size={15} color="#8B5CF6" />
        <Text style={styles.criteriaItemText}>좋아요</Text>
      </View>
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
                  {msg.places.map((place) => (
                   <TouchableOpacity
  key={place.id}
  style={styles.placeCard}
  onPress={() => goToDetail(place)}
  activeOpacity={0.85}
>
                      
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
                        {place.aiReason ? (
  <View style={styles.reasonBox}>
    <View style={styles.reasonTitleRow}>
      <Ionicons
        name="sparkles"
        size={12}
        color="#8B5CF6"
      />
      <Text style={styles.reasonTitle}>
        MAPPY 추천 이유
      </Text>
    </View>

    <Text style={styles.reasonText}>
      {place.aiReason}
    </Text>
  </View>
) : null}
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

{/* 빠른 질문 메뉴 */}
<View style={styles.quickMenuArea}>

  {/* 펼쳐지는 질문 목록 */}
  {showQuickMenu && (
    <View style={styles.quickMenuList}>
      {QUICK_PROMPTS.map((q, i) => (
        <TouchableOpacity
          key={i}
          style={styles.quickMenuItem}
          onPress={() => {
            setShowQuickMenu(false);
            sendMessage(q);
          }}
          disabled={aiLoading || dataLoading}
          activeOpacity={0.7}
        >
          <Text style={styles.quickMenuItemText}>
            {q}
          </Text>

          <Ionicons
            name="chevron-forward"
            size={15}
            color="#C7C7CC"
          />
        </TouchableOpacity>
      ))}
    </View>
  )}

  {/* 빠른 질문 열기/닫기 */}
  <TouchableOpacity
    style={styles.quickMenuToggle}
    onPress={() => setShowQuickMenu((prev) => !prev)}
    activeOpacity={0.7}
  >
    <View style={styles.quickMenuToggleLeft}>
      <Ionicons
        name="sparkles"
        size={15}
        color="#8B5CF6"
      />

      <Text style={styles.quickMenuToggleText}>
        빠른 질문
      </Text>
    </View>

    <Ionicons
      name={showQuickMenu ? 'chevron-down' : 'chevron-up'}
      size={17}
      color="#8E8E93"
    />
  </TouchableOpacity>

</View>

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
              returnKeyType="default"
              
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
 quickWrap: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 8,
},

quickBtn: {
  flexDirection: 'row',
  alignItems: 'center',

  paddingHorizontal: 12,
  paddingVertical: 9,

  borderRadius: 18,

  backgroundColor: '#FFFFFF',

  borderWidth: 1,
  borderColor: '#EEE8FF',
},

quickBtnTxt: {
  fontSize: 12,
  color: '#3A3A3C',
  fontWeight: '600',
},

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
  criteriaCard: {
  backgroundColor: '#F8F5FF',
  borderRadius: 18,
  padding: 16,
  marginBottom: 20,
  borderWidth: 1,
  borderColor: '#EEE8FF',
},

criteriaHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
  marginBottom: 14,
},

criteriaIcon: {
  width: 30,
  height: 30,
  borderRadius: 15,
  backgroundColor: '#EEE8FF',
  alignItems: 'center',
  justifyContent: 'center',
},

criteriaTitle: {
  fontSize: 14,
  fontWeight: '800',
  color: '#1C1C1E',
  marginBottom: 2,
},

criteriaSub: {
  fontSize: 11,
  color: '#8E8E93',
},

criteriaItems: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 8,
},

criteriaItem: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 5,
  backgroundColor: '#FFFFFF',
  paddingHorizontal: 10,
  height: 32,
  borderRadius: 16,
},

criteriaItemText: {
  fontSize: 12,
  fontWeight: '600',
  color: '#5C5C5E',
},
reasonBox: {
  backgroundColor: '#F8F5FF',
  borderRadius: 10,
  paddingHorizontal: 10,
  paddingVertical: 8,
  marginTop: 4,
  marginBottom: 7,
},

reasonTitleRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 4,
  marginBottom: 4,
},

reasonTitle: {
  fontSize: 11,
  fontWeight: '800',
  color: '#8B5CF6',
},

reasonText: {
  fontSize: 12,
  lineHeight: 17,
  color: '#5C5C5E',
  fontWeight: '500',
},
quickMenuArea: {
  backgroundColor: '#FFFFFF',
  borderTopWidth: 1,
  borderTopColor: '#F0F0F5',
},

quickMenuList: {
  backgroundColor: '#FFFFFF',
  paddingHorizontal: 16,
  paddingTop: 8,
  borderRadius: 16,
  overflow: 'hidden',
},

quickMenuItem: {
  minHeight: 46,
  paddingHorizontal: 14,

  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',

  backgroundColor: '#F7F7F8',

  borderRadius: 16,
  marginBottom: 6,
},


quickMenuItemText: {
  flex: 1,
  fontSize: 13,
  fontWeight: '600',
  color: '#3A3A3C',
},

quickMenuToggle: {
  height: 42,
  paddingHorizontal: 18,

  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',

  backgroundColor: '#FFFFFF',
},

quickMenuToggleLeft: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
},

quickMenuToggleText: {
  fontSize: 13,
  fontWeight: '700',
  color: '#5C5C5E',
},
});