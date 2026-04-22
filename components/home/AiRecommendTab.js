import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function AiRecommendTab() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("어떤 장소를 찾으시나요?");

  const getAiPost = (type) => {
    setLoading(true);
    setTimeout(() => {
      setResult(`${type} 카테고리에서 요즘 핫한 '성수 팝업'을 추천해요! ✨`);
      setLoading(false);
    }, 1000);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🪄 AI 장소 추천</Text>
      <View style={styles.grid}>
        {[ {n:'음식점', i:'restaurant'}, {n:'카페', i:'cafe'}, {n:'팝업스토어', i:'gift'}, {n:'공원', i:'leaf'} ].map(item => (
          <TouchableOpacity key={item.n} style={styles.card} onPress={() => getAiPost(item.n)}>
            <Ionicons name={item.i} size={24} color="#007AFF" />
            <Text style={styles.cardText}>{item.n}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.resultBox}>
        {loading ? <ActivityIndicator color="#007AFF" /> : <Text style={styles.resultText}>{result}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: { width: '48%', backgroundColor: '#F2F2F7', padding: 20, borderRadius: 15, alignItems: 'center', marginBottom: 12 },
  cardText: { marginTop: 8, fontWeight: '600' },
  resultBox: { marginTop: 10, padding: 20, backgroundColor: '#E1F0FF', borderRadius: 15 },
  resultText: { color: '#007AFF', textAlign: 'center', fontWeight: '500' }
});