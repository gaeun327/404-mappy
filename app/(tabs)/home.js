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

export default function HomeScreen() {
  const router = useRouter();
  const mapRef = useRef(null);
  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [nearbyCount, setNearbyCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      fetchPins();
    }, [])
  );

  const fetchPins = async () => {
    try {
      const q = query(collection(db, 'places'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setPins(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setNearbyCount(snap.docs.length);
    } catch (e) { console.log('핀 불러오기 오류:', e); }
  };

  const moveToUserLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { Alert.alert('권한 거부', '위치 권한을 허용해야 합니다.'); return; }
    let userLoc = await Location.getCurrentPositionAsync({});
    mapRef.current?.animateToRegion({
      latitude: userLoc.coords.latitude, longitude: userLoc.coords.longitude,
      latitudeDelta: 0.005, longitudeDelta: 0.005,
    }, 1000);
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
      }
    });
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef} style={styles.map} provider={PROVIDER_GOOGLE}
        showsUserLocation={true} onPress={() => Keyboard.dismiss()}
        onLongPress={handleMapLongPress}
        initialRegion={{ latitude: 37.5665, longitude: 126.9780, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
      >
        {pins.map((pin) => (
          <Marker
            key={pin.id}
            coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
            pinColor={pin.type === 'blue' ? '#007AFF' : '#FF3B30'}
            onPress={() => goToDetail(pin)}
            onCalloutPress={() => goToDetail(pin)}
          />
        ))}
      </MapView>

      <View style={styles.topLayer}>
        <GooglePlacesAutocomplete
          placeholder="어디로 갈까요?"
          query={{ key: GOOGLE_MAPS_KEY, language: 'ko' }}
          onPress={(data, details = null) => {
            if (details) {
              const { lat, lng } = details.geometry.location;
              mapRef.current?.animateToRegion({
                latitude: lat, longitude: lng, latitudeDelta: 0.005, longitudeDelta: 0.005
              }, 1000);
              router.push({
                pathname: '/addplace',
                params: { latitude: lat, longitude: lng, address: data.description }
              });
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
          {['🏠 전체', '🍔 맛집', '☕ 카페', '🚗 주차장'].map((f, i) => (
            <TouchableOpacity key={i} style={styles.filterBtn}><Text>{f}</Text></TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.nearbyBanner}>
        <Ionicons name="location" size={14} color="#007AFF" />
        <Text style={styles.nearbyText}>내 주변 <Text style={styles.nearbyCount}>{nearbyCount}개</Text>의 스팟</Text>
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