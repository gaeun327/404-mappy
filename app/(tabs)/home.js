import React, { useRef, useState, useCallback } from 'react';
import {
  StyleSheet, View, TouchableOpacity, Text,
  ScrollView, Alert, Keyboard, ActivityIndicator
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { db } from '../../firebaseConfig';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { useRouter, useFocusEffect } from 'expo-router';

const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const CATEGORY_ICONS = {
  food:     { icon: 'restaurant',     color: '#FF6B35' },
  cafe:     { icon: 'cafe',           color: '#8B5CF6' },
  nature:   { icon: 'leaf',           color: '#10B981' },
  culture:  { icon: 'color-palette',  color: '#F59E0B' },
  popup:    { icon: 'gift',           color: '#EC4899' },
  shop:     { icon: 'bag-handle',     color: '#3B82F6' },
  hospital: { icon: 'medical',        color: '#EF4444' },
  beauty:   { icon: 'cut',            color: '#D946EF' },
  parking:  { icon: 'car',            color: '#6B7280' },
  stay:     { icon: 'bed',            color: '#0EA5E9' },
  fitness:  { icon: 'barbell',        color: '#F97316' },
  study:    { icon: 'book',           color: '#14B8A6' },
  play:     { icon: 'game-controller', color: '#8B5CF6' },
  etc:      { icon: 'location',       color: '#6B7280' },
};

export default function HomeScreen() {
  const router = useRouter();
  const mapRef = useRef(null);
  const placesRef = useRef(null);
  const [pins, setPins] = useState([]);
  const [allPins, setAllPins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [nearbyCount, setNearbyCount] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [userLocation, setUserLocation] = useState(null);
  const [mapReady, setMapReady] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchPins();
      initLocation();
    }, [])
  );

  const initLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = loc.coords;
      setUserLocation({ latitude, longitude });
      mapRef.current?.animateToRegion({
        latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01,
      }, 500);
      // 위치 기준 1km 내 핀 카운트 즉시 업데이트
      setAllPins(prev => {
        const nearby = prev.filter(p => getDistance(latitude, longitude, p.latitude, p.longitude) <= 1000);
        setNearbyCount(nearby.length);
        return prev;
      });
    } catch (e) {}
  };

  const fetchPins = async () => {
    try {
      const q = query(collection(db, 'places'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllPins(data);
      setPins(data);
      // 위치 있으면 1km 내 개수, 없으면 전체
      if (userLocation) {
        const nearby = data.filter(p =>
          getDistance(userLocation.latitude, userLocation.longitude, p.latitude, p.longitude) <= 1000
        );
        setNearbyCount(nearby.length);
      } else {
        setNearbyCount(0);
      }
    } catch (e) { console.log('핀 불러오기 오류:', e); }
  };

  const moveToUserLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { Alert.alert('권한 거부', '위치 권한을 허용해야 합니다.'); return; }
    let userLoc = await Location.getCurrentPositionAsync({});
    const { latitude, longitude } = userLoc.coords;
    setUserLocation({ latitude, longitude });
    mapRef.current?.animateToRegion({
      latitude, longitude, latitudeDelta: 0.005, longitudeDelta: 0.005,
    }, 1000);
    // 1km 내 핀 개수 업데이트
    const nearby = allPins.filter(p =>
      getDistance(latitude, longitude, p.latitude, p.longitude) <= 1000
    );
    setNearbyCount(nearby.length);
  };

  const openAddPlace = async () => {
    setLoading(true);
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 거부', '위치 권한을 허용해야 합니다.');
      setLoading(false);
      return;
    }
    let userLoc = await Location.getCurrentPositionAsync({});
    router.push({
      pathname: '/addplace',
      params: {
        latitude: userLoc.coords.latitude,
        longitude: userLoc.coords.longitude,
        address: '현재 위치',  // addplace에서 GPS로 자동 변환
      }
    });
    setLoading(false);
  };

  const handleMapLongPress = (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    router.push({
      pathname: '/addplace',
      params: { latitude, longitude, address: '지도에서 선택한 위치' }
    });
  };

  const goToDetail = (pin) => {
    router.push({
      pathname: '/detail',
      params: {
        id: pin.id,
        title: pin.title,
        description: pin.description,
        type: pin.type,
        user: pin.userNickname,
        userEmail: pin.userEmail ?? '',
        address: pin.address ?? '',
        detailAddress: pin.detailAddress ?? '',
        imagePaths: encodeURIComponent(JSON.stringify(pin.imagePaths ?? [])),
        tags: JSON.stringify(pin.tags ?? []),
        category: pin.category ?? '',
      }
    });
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef} style={styles.map} provider={PROVIDER_GOOGLE}
        showsUserLocation={true} onPress={() => Keyboard.dismiss()}
        onLongPress={handleMapLongPress}
        onMapReady={() => setMapReady(true)}
        initialRegion={{ latitude: 37.5665, longitude: 126.9780, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
      >
        {pins.map((pin) => (
          <Marker
            key={pin.id}
            coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
            onPress={() => goToDetail(pin)}
            onCalloutPress={() => goToDetail(pin)}
            tracksViewChanges={false}
          >
            <View style={[
              styles.customMarker,
              { backgroundColor: pin.type === 'blue' ? '#007AFF' : '#FF3B30' }
            ]}>
              <Ionicons
                name={CATEGORY_ICONS[pin.category]?.icon ?? 'location'}
                size={14}
                color="white"
              />
            </View>
          </Marker>
        ))}
      </MapView>

      <View style={styles.topLayer}>
        <GooglePlacesAutocomplete
          placeholder="장소를 검색하고 선택하세요"
          query={{ key: GOOGLE_MAPS_KEY, language: 'ko' }}
          onPress={(data, details = null) => {
            if (details) {
              const { lat, lng } = details.geometry.location;
              mapRef.current?.animateToRegion({
                latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01
              }, 1000);
              Keyboard.dismiss();
            }
          }}
          fetchDetails={true}
          styles={{
            container: { flex: 0 },
            textInputContainer: styles.searchBar,
            textInput: styles.searchInput,
            listView: { backgroundColor: 'white', marginHorizontal: 20, borderRadius: 10 },
          }}
          renderLeftButton={() => (
            <Ionicons name="search" size={20} color="#007AFF" style={{ marginLeft: 5, alignSelf: 'center' }} />
          )}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {[
            { label: '전체',      id: '전체' },
            { label: '🍽️ 음식점', id: 'food' },
            { label: '☕ 카페',   id: 'cafe' },
            { label: '🌿 자연',   id: 'nature' },
            { label: '🎨 문화',   id: 'culture' },
            { label: '🎪 팝업',   id: 'popup' },
            { label: '🛍️ 쇼핑',   id: 'shop' },
            { label: '🏥 병원·약국', id: 'hospital' },
            { label: '💇 미용',     id: 'beauty' },
            { label: '🚗 주차장',   id: 'parking' },
            { label: '🏨 숙소',     id: 'stay' },
            { label: '🏋️ 운동·헬스', id: 'fitness' },
            { label: '📚 카공·스터디', id: 'study' },
            { label: '🎮 오락·취미', id: 'play' },
            { label: '📍 기타',     id: 'etc' },
          ].map((f) => (
            <TouchableOpacity
              key={f.id}
              style={[styles.filterBtn, selectedCategory === f.id && styles.filterBtnActive]}
              onPress={() => {
                setSelectedCategory(f.id);
                setPins(f.id === '전체' ? allPins : allPins.filter(p => p.category === f.id));
                setNearbyCount(f.id === '전체' ? allPins.length : allPins.filter(p => p.category === f.id).length);
              }}
            >
              <Text style={[styles.filterBtnTxt, selectedCategory === f.id && { color: '#007AFF', fontWeight: '700' }]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.nearbyBanner}>
        <Ionicons name="location" size={14} color="#007AFF" />
        <Text style={styles.nearbyText}>1km 내 <Text style={styles.nearbyCount}>{nearbyCount}개</Text>의 스팟</Text>
      </View>

      <TouchableOpacity style={styles.addPinBtn} onPress={openAddPlace} disabled={loading}>
        {loading ? <ActivityIndicator color="white" size="small" /> : <Ionicons name="add" size={30} color="white" />}
      </TouchableOpacity>

      <TouchableOpacity style={styles.locationBtn} onPress={moveToUserLocation}>
        <Ionicons name="locate" size={28} color="#007AFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  customMarker: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 5,
    borderWidth: 2, borderColor: 'white',
  },
  map: { width: '100%', height: '100%' },
  topLayer: { position: 'absolute', top: 50, width: '100%', zIndex: 1 },
  searchBar: {
    backgroundColor: 'white', height: 50, borderRadius: 15,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15,
    marginHorizontal: 20, elevation: 5,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15, backgroundColor: 'white', borderRadius: 15 },
  filterScroll: { marginTop: 10, paddingLeft: 20 },
  filterBtn: { backgroundColor: 'white', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginRight: 8, elevation: 2 },
  filterBtnActive: { backgroundColor: '#EAF3FF', borderWidth: 1.5, borderColor: '#007AFF' },
  filterBtnTxt: { fontSize: 13, color: '#3A3A3C' },
  nearbyBanner: {
    position: 'absolute', bottom: 110, left: 20,
    backgroundColor: 'white', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, elevation: 4, gap: 5,
  },
  nearbyText: { fontSize: 13, color: '#3A3A3C' },
  nearbyCount: { fontWeight: '800', color: '#007AFF' },
  addPinBtn: {
    position: 'absolute', bottom: 40, left: 20,
    backgroundColor: '#007AFF', width: 55, height: 55, borderRadius: 30,
    justifyContent: 'center', alignItems: 'center', elevation: 6, zIndex: 1,
    shadowColor: '#007AFF', shadowOpacity: 0.4, shadowRadius: 8,
  },
  locationBtn: {
    position: 'absolute', bottom: 40, right: 20,
    backgroundColor: 'white', width: 55, height: 55, borderRadius: 30,
    justifyContent: 'center', alignItems: 'center', elevation: 5, zIndex: 1,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8,
  },
});