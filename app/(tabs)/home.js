import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Animated, PanResponder, Dimensions, TextInput, TouchableOpacity, Text, ScrollView, Alert } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location'; // GPS 라이브러리

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_MIN_HEIGHT = 100; // 바텀시트 높이를 살짝 낮춤

export default function HomeScreen() {
  const mapRef = useRef(null);
  const [location, setLocation] = useState(null);
  const panY = useRef(new Animated.Value(SCREEN_HEIGHT - SHEET_MIN_HEIGHT)).current;

  // 🛰️ 실제 GPS 내 위치 가져오기 및 이동
  const moveToUserLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 거부', '위치 권한을 허용해야 GPS 기능을 사용할 수 있습니다.');
      return;
    }

    let userLoc = await Location.getCurrentPositionAsync({});
    mapRef.current?.animateToRegion({
      latitude: userLoc.coords.latitude,
      longitude: userLoc.coords.longitude,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    }, 1000);
  };

  return (
    <View style={styles.container}>
      <MapView ref={mapRef} style={styles.map} provider={PROVIDER_GOOGLE} showsUserLocation={true} />
      
      {/* 상단 검색 & 필터 */}
      <View style={styles.topLayer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#007AFF" />
          <TextInput style={styles.searchInput} placeholder="어디로 갈까요?" />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {['🏠 전체', '🍔 맛집', '☕ 카페', '🚗 주차장'].map((f, i) => (
            <TouchableOpacity key={i} style={styles.filterBtn}><Text>{f}</Text></TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 📍 내 위치 버튼 (위치 하향 조정) */}
      <TouchableOpacity style={styles.locationBtn} onPress={moveToUserLocation}>
        <Ionicons name="locate" size={28} color="#007AFF" />
      </TouchableOpacity>

      {/* 바텀 시트 (홈에서는 정보 요약만 표시) */}
      <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: panY }] }]}>
        <View style={styles.handleContainer}><View style={styles.handle} /></View>
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold' }}>내 주변 탐색하기</Text>
          <Text style={{ color: '#888', marginTop: 5 }}>지도를 움직여 핫플을 찾아보세요!</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },
  topLayer: { position: 'absolute', top: 50, width: '100%', zIndex: 1 },
  searchBar: { backgroundColor: 'white', height: 50, borderRadius: 15, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, marginHorizontal: 20, elevation: 5 },
  searchInput: { flex: 1, marginLeft: 10 },
  filterScroll: { marginTop: 10, paddingLeft: 20 },
  filterBtn: { backgroundColor: 'white', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginRight: 8, elevation: 2 },
  
  locationBtn: { 
    position: 'absolute', 
    bottom: 30, // 👈 높이를 낮춰서 바텀시트 근처로 이동
    right: 20, 
    backgroundColor: 'white', 
    width: 55, height: 55, borderRadius: 30, 
    justifyContent: 'center', alignItems: 'center', 
    elevation: 5, zIndex: 1 
  },

  bottomSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 300, backgroundColor: 'white', borderTopLeftRadius: 25, borderTopRightRadius: 25, elevation: 10 },
  handleContainer: { alignItems: 'center', paddingVertical: 10 },
  handle: { width: 40, height: 5, backgroundColor: '#E5E5EA', borderRadius: 3 },
});