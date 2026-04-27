import React, { useRef, useState, useEffect } from 'react';
import {
  StyleSheet, View, TextInput, TouchableOpacity, Text,
  ScrollView, Alert, Keyboard, Modal, ActivityIndicator
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { db, auth } from '../../firebaseConfig';
import { collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore';
import {GooglePlacesAutocomplete} from 'react-native-google-places-autocomplete';

const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

export default function HomeScreen() {
  const mapRef = useRef(null);
  const [pins, setPins] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [pinType, setPinType] = useState('blue'); // 'blue' or 'red'
  const [pinTitle, setPinTitle] = useState('');
  const [pinDesc, setPinDesc] = useState('');
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [nearbyCount, setNearbyCount] = useState(0);

  useEffect(() => {
    fetchPins();
  }, []);

  // Firebase에서 핀 불러오기
  const fetchPins = async () => {
    try {
      const q = query(collection(db, 'places'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPins(list);
      setNearbyCount(list.length);
    } catch (e) {
      console.log('핀 불러오기 오류:', e);
    }
  };

  // GPS로 현재 위치 가져오기
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
    return userLoc.coords;
  };

  // 핀 등록 모달 열기 - GPS 방식
  const openModalWithGPS = async () => {
    setLoading(true);
    const coords = await moveToUserLocation();
    if (coords) {
      setSelectedLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
        address: '현재 위치',
      });
      setModalVisible(true);
    }
    setLoading(false);
  };

  // 핀 등록 모달 열기 - 지도 꾹 누르기 방식
  const handleMapLongPress = (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setSelectedLocation({ latitude, longitude, address: '지도에서 선택한 위치' });
    setModalVisible(true);
  };

  // Firebase에 핀 저장
  const handleSavePin = async () => {
    if (!pinTitle.trim()) return Alert.alert('알림', '장소 이름을 입력해주세요.');
    if (!selectedLocation) return Alert.alert('알림', '위치를 선택해주세요.');

    setLoading(true);
    try {
      await addDoc(collection(db, 'places'), {
        title: pinTitle,
        description: pinDesc,
        type: pinType,
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        address: selectedLocation.address,
        userEmail: auth.currentUser?.email,
        userNickname: auth.currentUser?.displayName ?? '익명',
        createdAt: new Date(),
      });
      Alert.alert('완료', '장소가 등록되었습니다! 🎉');
      setPinTitle('');
      setPinDesc('');
      setPinType('blue');
      setSelectedLocation(null);
      setModalVisible(false);
      fetchPins(); // 핀 목록 새로고침
    } catch (e) {
      Alert.alert('오류', '저장에 실패했습니다.');
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        showsUserLocation={true}
        onPress={() => Keyboard.dismiss()}
        onLongPress={handleMapLongPress}
        initialRegion={{
          latitude: 37.5665,
          longitude: 126.9780,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {/* 핀 표시 */}
        {pins.map((pin) => (
          <Marker
            key={pin.id}
            coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
            title={pin.title}
            description={pin.description}
            pinColor={pin.type === 'blue' ? '#007AFF' : '#FF3B30'}
          />
        ))}
      </MapView>

      {/* 상단 검색 & 필터 */}
      <View style={styles.topLayer}>
        <GooglePlacesAutocomplete
          placeholder="어디로 갈까요?"
          query={{ key: GOOGLE_MAPS_KEY, language: 'ko' }}
          onPress={(data, details = null) => {
            if (details) {
              const { lat, lng } = details.geometry.location;
              mapRef.current?.animateToRegion({
                latitude: lat, longitude: lng,
                latitudeDelta: 0.005, longitudeDelta: 0.005,
              }, 1000);
              setSelectedLocation({
                latitude: lat, longitude: lng,
                address: data.description,
              });
              setModalVisible(true);
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
            <TouchableOpacity key={i} style={styles.filterBtn}>
              <Text>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 내 주변 핀 개수 배너 */}
      <View style={styles.nearbyBanner}>
        <Ionicons name="location" size={14} color="#007AFF" />
        <Text style={styles.nearbyText}>내 주변 <Text style={styles.nearbyCount}>{nearbyCount}개</Text>의 스팟</Text>
      </View>

      {/* 핀 등록 버튼 */}
      <TouchableOpacity style={styles.addPinBtn} onPress={openModalWithGPS} disabled={loading}>
        {loading
          ? <ActivityIndicator color="white" size="small" />
          : <Ionicons name="add" size={30} color="white" />
        }
      </TouchableOpacity>

      {/* 내 위치 버튼 */}
      <TouchableOpacity style={styles.locationBtn} onPress={moveToUserLocation}>
        <Ionicons name="locate" size={28} color="#007AFF" />
      </TouchableOpacity>

      {/* 핀 등록 모달 */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📍 장소 등록</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            {/* 위치 표시 */}
            <View style={styles.locationBadge}>
              <Ionicons name="location" size={14} color="#007AFF" />
              <Text style={styles.locationText} numberOfLines={1}>
                {selectedLocation?.address ?? '위치 없음'}
              </Text>
            </View>

            {/* Blue / Red 선택 */}
            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[styles.typeBtn, pinType === 'blue' && styles.typeBtnBlueActive]}
                onPress={() => setPinType('blue')}
              >
                <Text style={[styles.typeBtnText, pinType === 'blue' && { color: 'white' }]}>
                  👍 추천 (Blue)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeBtn, pinType === 'red' && styles.typeBtnRedActive]}
                onPress={() => setPinType('red')}
              >
                <Text style={[styles.typeBtnText, pinType === 'red' && { color: 'white' }]}>
                  👎 경고 (Red)
                </Text>
              </TouchableOpacity>
            </View>

            {/* 장소 이름 */}
            <TextInput
              style={styles.modalInput}
              placeholder="장소 이름 (예: 성수 카페)"
              value={pinTitle}
              onChangeText={setPinTitle}
            />

            {/* 한줄 평 */}
            <TextInput
              style={[styles.modalInput, { height: 80 }]}
              placeholder="한줄 평 (예: 분위기 좋고 커피 맛있어요!)"
              value={pinDesc}
              onChangeText={setPinDesc}
              multiline
            />

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: pinType === 'blue' ? '#007AFF' : '#FF3B30' }]}
              onPress={handleSavePin}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="white" />
                : <Text style={styles.saveBtnText}>등록하기</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },

  // 상단
  topLayer: { position: 'absolute', top: 50, width: '100%', zIndex: 1 },
  searchBar: {
    backgroundColor: 'white', height: 50, borderRadius: 15,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15,
    marginHorizontal: 20, elevation: 5,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15, backgroundColor: 'white', borderRadius: 15 },
  filterScroll: { marginTop: 10, paddingLeft: 20 },
  filterBtn: {
    backgroundColor: 'white', paddingHorizontal: 15, paddingVertical: 8,
    borderRadius: 20, marginRight: 8, elevation: 2,
  },

  // 내 주변 배너
  nearbyBanner: {
    position: 'absolute', bottom: 110, left: 20,
    backgroundColor: 'white', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    elevation: 4, gap: 5,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6,
  },
  nearbyText: { fontSize: 13, color: '#3A3A3C' },
  nearbyCount: { fontWeight: '800', color: '#007AFF' },

  // 버튼들
  addPinBtn: {
    position: 'absolute', bottom: 40, left: 20,
    backgroundColor: '#007AFF', width: 55, height: 55,
    borderRadius: 30, justifyContent: 'center', alignItems: 'center',
    elevation: 6, zIndex: 1,
    shadowColor: '#007AFF', shadowOpacity: 0.4, shadowRadius: 8,
  },
  locationBtn: {
    position: 'absolute', bottom: 40, right: 20,
    backgroundColor: 'white', width: 55, height: 55,
    borderRadius: 30, justifyContent: 'center', alignItems: 'center',
    elevation: 5, zIndex: 1,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8,
  },

  // 모달
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: 'white', borderTopLeftRadius: 25, borderTopRightRadius: 25,
    padding: 25, paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1C1C1E' },
  locationBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#EAF3FF', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, marginBottom: 16,
  },
  locationText: { fontSize: 13, color: '#007AFF', flex: 1 },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  typeBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E5EA',
  },
  typeBtnBlueActive: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  typeBtnRedActive:  { backgroundColor: '#FF3B30', borderColor: '#FF3B30' },
  typeBtnText: { fontWeight: '700', color: '#8E8E93' },
  modalInput: {
    backgroundColor: '#F2F2F7', padding: 15, borderRadius: 12,
    fontSize: 15, marginBottom: 12,
  },
  saveBtn: {
    padding: 18, borderRadius: 15,
    alignItems: 'center', marginTop: 5,
  },
  saveBtnText: { color: 'white', fontWeight: '800', fontSize: 16 },
});