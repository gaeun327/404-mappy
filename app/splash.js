import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Image, TouchableOpacity, Linking, Animated, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // 아이콘 사용을 위해 추가

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function SplashScreen() {
  const progress = useRef(new Animated.Value(0)).current;
  const pinAnim = useRef(new Animated.Value(0)).current; // 핀 애니메이션 값

  useEffect(() => {
    // 1. 하단 로딩 바 애니메이션 (4초)
    Animated.timing(progress, {
      toValue: 1,
      duration: 4000,
      useNativeDriver: false,
    }).start();

    // 2. 2초 뒤에 핀 버튼이 '뿅' 나타나는 애니메이션
    Animated.sequence([
      Animated.delay(2000), // 2초 대기
      Animated.spring(pinAnim, {
        toValue: 1,
        friction: 4, // 탄성 조절 (작을수록 많이 흔들림)
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      {/* 1. 상단: 앱 로고 영역 */}
      <View style={styles.logoContainer}>
        <View style={styles.logoWrapper}>
          {/* 핀 아이콘: 느낌표처럼 보이게 로고 위에 배치 */}
          <Animated.View style={[styles.pinBtn, {
            transform: [
              { scale: pinAnim },
              { translateY: pinAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0] // 아래에서 위로 튀어오름
                }) 
              }
            ],
            opacity: pinAnim
          }]}>
            <Ionicons name="location" size={40} color="#FF3B30" />
            <View style={styles.pinDot} /> {/* 느낌표 점처럼 보이게 하는 하단 점 */}
          </Animated.View>
          
          <Text style={styles.logoText}>MAPPY</Text>
        </View>
        <Text style={styles.subText}>지인 기반 신뢰 지도</Text>
      </View>

      {/* 2. 하단: 수익화 광고 영역 */}
      <View style={styles.adContainer}>
        <TouchableOpacity 
          activeOpacity={0.9}
          onPress={() => Linking.openURL('https://m.search.naver.com/search.naver?query=성수동맛집')} 
          style={styles.adBox}
        >
          <Image 
            source={{ uri: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=1000' }} 
            style={styles.adImage}
            resizeMode="cover"
          />
          <View style={styles.adContent}>
            <View style={styles.adTitleRow}>
              <Text style={styles.adTag}>AD</Text>
              <Text style={styles.adTitle}>[광고] 이번 주말 성수동 핫플 예약?</Text>
            </View>
            <Text style={styles.adDesc}>매피가 직접 검증한 프리미엄 맛집 지도</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.loadingArea}>
          <View style={styles.progressBarBg}>
            <Animated.View style={[styles.progressBar, {
              width: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%']
              })
            }]} />
          </View>
          <Text style={styles.loadingText}>로컬 데이터를 불러오는 중...</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#007AFF' },
  logoContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  logoWrapper: { alignItems: 'center' },
  // 핀 디자인: 느낌표 느낌을 위해 위치 조정
  pinBtn: {
    position: 'absolute',
    top: -45,
    alignItems: 'center',
    zIndex: 1,
  },
  pinDot: {
    width: 8,
    height: 8,
    backgroundColor: '#FF3B30',
    borderRadius: 4,
    marginTop: -5, // 아이콘과 붙여서 느낌표처럼 보이게 함
  },
  logoText: { fontSize: 70, fontWeight: 'bold', color: 'white', letterSpacing: -2 },
  subText: { fontSize: 20, color: 'white', marginTop: 10, fontWeight: '600', opacity: 0.9 },
  
  adContainer: {
    height: SCREEN_HEIGHT * 0.4, 
    backgroundColor: 'white',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 45 : 30,
    justifyContent: 'space-between',
  },
  adBox: {
    flex: 0.88,
    backgroundColor: '#F8F9FA',
    borderRadius: 25,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F2F2F7',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  adImage: { width: '100%', height: '70%', backgroundColor: '#E5E5EA' },
  adContent: { flex: 1, paddingHorizontal: 18, justifyContent: 'center', backgroundColor: 'white' },
  adTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  adTag: { backgroundColor: '#F2F2F7', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4, fontSize: 10, fontWeight: 'bold', color: '#8E8E93', marginRight: 8 },
  adTitle: { fontSize: 16, fontWeight: 'bold', color: '#1C1C1E' },
  adDesc: { fontSize: 13, color: '#8E8E93' },
  loadingArea: { marginTop: 10 },
  progressBarBg: { height: 4, backgroundColor: '#E5E5EA', borderRadius: 2, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: '#007AFF' },
  loadingText: { textAlign: 'center', fontSize: 10, color: '#C7C7CC', marginTop: 8, fontWeight: '700' }
});