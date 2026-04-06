import React from 'react';
import { StyleSheet, View, Text, Image, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

export default function DetailScreen() {
  const router = useRouter();
  const { title, description, type, user } = useLocalSearchParams(); // 홈에서 보낸 데이터 받기

  return (
    <ScrollView style={styles.container}>
      {/* 🖼️ 장소 사진 (일단 샘플 이미지, 나중에 DB 연결 시 실제 사진) */}
      <Image 
        source={{ uri: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800' }} 
        style={styles.image} 
      />

      {/* 🔙 뒤로가기 버튼 */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={{ fontSize: 20 }}>⬅️</Text>
      </TouchableOpacity>

      <View style={styles.contentBox}>
        <View style={styles.header}>
          <View style={[styles.tag, { backgroundColor: type === 'good' ? '#E1F0FF' : '#FFE5E5' }]}>
            <Text style={{ color: type === 'good' ? '#007AFF' : '#FF4B4B', fontWeight: 'bold' }}>
              {type === 'good' ? '👍 추천' : '👎 비추천'}
            </Text>
          </View>
          <Text style={styles.userText}>{user}님의 기록</Text>
        </View>

        <Text style={styles.title}>{title}</Text>
        <View style={styles.divider} />
        
        <Text style={styles.sectionTitle}>지인의 한줄 평 💬</Text>
        <Text style={styles.description}>{description || "상세 내용이 없습니다."}</Text>

        <View style={styles.infoCard}>
          <Text style={styles.infoText}>📍 위치: 지도에서 확인됨</Text>
          <Text style={styles.infoText}>⏰ 등록일: 2024. 05. 22</Text>
        </View>

        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: type === 'good' ? '#007AFF' : '#FF4B4B' }]}>
          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>여기 가볼래요!</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  image: { width: width, height: 300, resizeMode: 'cover' },
  backBtn: { position: 'absolute', top: 50, left: 20, backgroundColor: 'white', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  contentBox: { padding: 25, marginTop: -30, backgroundColor: 'white', borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  userText: { color: '#888', fontWeight: 'bold' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#333' },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  description: { fontSize: 16, color: '#555', lineHeight: 24, marginBottom: 30 },
  infoCard: { backgroundColor: '#f9f9f9', padding: 20, borderRadius: 15, marginBottom: 30 },
  infoText: { color: '#777', marginBottom: 5 },
  actionBtn: { width: '100%', padding: 20, borderRadius: 15, alignItems: 'center', marginBottom: 50 }
});