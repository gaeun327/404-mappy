import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, View, Text, TouchableOpacity, TextInput, Modal, Alert, 
  TouchableWithoutFeedback, FlatList, Dimensions, ActivityIndicator, Keyboard 
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebaseConfig'; // auth 제거(필요시 추가), db는 유지
import { collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore';

const { width } = Dimensions.get('window');

// 하버사인 거리 계산 함수
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
};

export default function HomeScreen() {
  const mapRef = useRef(null);
  const [markers, setMarkers] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // 모달 상태
  const [regModalVisible, setRegModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [tempCoords, setTempCoords] = useState(null);

  // 등록 폼 상태
  const [placeName, setPlaceName] = useState('');
  const [description, setDescription] = useState('');
  const [recommend, setRecommend] = useState('good');

  useEffect(() => {
    fetchMarkers();
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      let loc = await Location.getCurrentPositionAsync({});
      setUserLocation(loc.coords);
    }
  };

  const fetchMarkers = async () => {
    try {
      const q = query(collection(db, "places"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setMarkers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (e) { console.log("불러오기 에러:", e); }
  };

  // ⭐ 추가된 기능: 지역명 검색 시 지도 이동
  const handleSearchLocation = async () => {
    if (!searchQuery.trim()) return;
    try {
      const result = await Location.geocodeAsync(searchQuery);
      if (result.length > 0) {
        const { latitude, longitude } = result[0];
        mapRef.current?.animateToRegion({
          latitude,
          longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        }, 1000);
        Keyboard.dismiss(); // 검색 후 키보드 닫기
      } else {
        // 지역 검색 결과가 없으면 기존처럼 마커 필터링 유지 (알림은 생략 가능)
      }
    } catch (e) {
      console.log("검색 에러:", e);
    }
  };

  const moveToUserLocation = () => {
    if (userLocation) {
      mapRef.current?.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 1000);
    }
  };

  const handleRegister = async () => {
    if (!placeName) return Alert.alert("알림", "상호명을 입력해주세요.");
    if (!userLocation || !tempCoords) return Alert.alert("알림", "위치 정보를 확인 중입니다.");
    
    const dist = getDistance(userLocation.latitude, userLocation.longitude, tempCoords.latitude, tempCoords.longitude);
    if (dist > 200) return Alert.alert("인증 실패", "해당 장소 근처(200m)에서만 등록 가능합니다.");
    
    await addDoc(collection(db, "places"), {
      title: placeName,
      description,
      type: recommend,
      coordinate: tempCoords,
      createdAt: new Date(),
    });
    setRegModalVisible(false);
    setPlaceName(''); setDescription('');
    fetchMarkers();
  };

  // 검색어에 따른 마커 필터링
  const filteredMarkers = markers.filter(m => m.title.includes(searchQuery));

  return (
    <View style={styles.container}>
      {/* 상단 검색바 */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#007AFF" style={{marginRight: 10}} />
          <TextInput 
            style={styles.searchInput} 
            placeholder="'성수동' 또는 장소명 검색" 
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            onSubmitEditing={handleSearchLocation} // 엔터 누르면 지역 이동
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#ccc" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <MapView 
        ref={mapRef} 
        style={styles.map} 
        showsUserLocation
        onLongPress={(e) => { setTempCoords(e.nativeEvent.coordinate); setRegModalVisible(true); }}
      >
        {filteredMarkers.map(m => (
          <Marker 
            key={m.id} 
            coordinate={m.coordinate} 
            pinColor={m.type === 'good' ? '#007AFF' : '#FF3B30'}
            onPress={() => { setSelectedPlace(m); setDetailModalVisible(true); }}
          />
        ))}
      </MapView>

      {/* 내 위치 버튼 */}
      <TouchableOpacity style={styles.myLocationBtn} onPress={moveToUserLocation}>
        <Ionicons name="locate" size={24} color="#007AFF" />
      </TouchableOpacity>

      {/* 하단 리스트 영역 */}
      <View style={styles.listContainer}>
        <Text style={styles.listHeader}>주변 인증 장소</Text>
        <FlatList
          data={filteredMarkers}
          horizontal
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.card} 
              onPress={() => {
                mapRef.current?.animateToRegion({ ...item.coordinate, latitudeDelta: 0.005, longitudeDelta: 0.005 }, 500);
                setSelectedPlace(item);
                setDetailModalVisible(true);
              }}
            >
              <View style={[styles.cardTag, {backgroundColor: item.type === 'good' ? '#E1F0FF' : '#FFEBEB'}]}>
                <Text style={{color: item.type === 'good' ? '#007AFF' : '#FF3B30', fontSize: 10, fontWeight:'bold'}}>
                  {item.type === 'good' ? '추천' : '주의'}
                </Text>
              </View>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.cardDesc} numberOfLines={1}>{item.description || "설명 없음"}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* 장소 등록 모달 */}
      <Modal visible={regModalVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setRegModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.sheet}>
                <View style={styles.handle} />
                <Text style={styles.modalTitle}>📍 새로운 장소 인증</Text>
                <TextInput style={styles.input} placeholder="상호명" value={placeName} onChangeText={setPlaceName} placeholderTextColor="#999" />
                <TextInput style={[styles.input, {height: 80}]} placeholder="동기들에게 줄 팁 (선택)" value={description} onChangeText={setDescription} multiline />
                
                <View style={styles.typeRow}>
                  <TouchableOpacity style={[styles.typeBtn, recommend === 'good' && styles.typeBtnGood]} onPress={() => setRecommend('good')}>
                    <Text style={{color: recommend === 'good' ? '#007AFF' : '#666'}}>👍 추천</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.typeBtn, recommend === 'bad' && styles.typeBtnBad]} onPress={() => setRecommend('bad')}>
                    <Text style={{color: recommend === 'bad' ? '#FF3B30' : '#666'}}>⚠️ 주의</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.saveBtn} onPress={handleRegister}>
                  <Text style={{color:'white', fontWeight:'bold', fontSize: 16}}>등록 및 10pt 적립</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* 상세 정보 모달 */}
      <Modal visible={detailModalVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setDetailModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.sheet}>
                <View style={styles.handle} />
                <View style={{flexDirection:'row', alignItems:'center', marginBottom: 10}}>
                   <Text style={{color: selectedPlace?.type === 'good' ? '#007AFF' : '#FF3B30', fontWeight:'bold'}}>
                     {selectedPlace?.type === 'good' ? '👍 추천 장소' : '⚠️ 주의 장소'}
                   </Text>
                </View>
                <Text style={styles.detailTitle}>{selectedPlace?.title}</Text>
                <Text style={styles.detailDesc}>{selectedPlace?.description || "작성된 후기가 없습니다."}</Text>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setDetailModalVisible(false)}>
                  <Text style={{color:'white', fontWeight:'bold'}}>확인</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  map: { flex: 1 },
  searchContainer: { position: 'absolute', top: 60, width: '100%', paddingHorizontal: 20, zIndex: 10 },
  searchBar: { 
    backgroundColor: 'white', 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 15, 
    height: 50, 
    borderRadius: 15,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, elevation: 5
  },
  searchInput: { flex: 1, fontSize: 15 },
  myLocationBtn: { 
    position: 'absolute', bottom: 210, right: 20, 
    backgroundColor: 'white', width: 50, height: 50, borderRadius: 25, 
    justifyContent: 'center', alignItems: 'center', shadowColor: "#000", shadowOpacity: 0.2, elevation: 5
  },
  listContainer: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: 'rgba(255,255,255,0.95)', borderTopLeftRadius: 25, borderTopRightRadius: 25, paddingVertical: 20, paddingHorizontal: 20, height: 190 },
  listHeader: { fontSize: 16, fontWeight: 'bold', marginBottom: 15, color: '#1C1C1E' },
  card: { backgroundColor: 'white', width: 160, height: 100, borderRadius: 18, padding: 15, marginRight: 12, shadowColor: "#000", shadowOpacity: 0.05, elevation: 2, borderWidth: 1, borderColor: '#F2F2F7' },
  cardTag: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#1C1C1E' },
  cardDesc: { fontSize: 12, color: '#8E8E93', marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: 'white', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, paddingBottom: 40 },
  handle: { width: 40, height: 4, backgroundColor: '#E5E5EA', alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { backgroundColor: '#F2F2F7', borderRadius: 12, padding: 15, marginBottom: 12, fontSize: 15 },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  typeBtn: { flex: 1, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F2F2F7' },
  typeBtnGood: { backgroundColor: '#E1F0FF', borderWidth: 1, borderColor: '#007AFF' },
  typeBtnBad: { backgroundColor: '#FFEBEB', borderWidth: 1, borderColor: '#FF3B30' },
  saveBtn: { backgroundColor: '#007AFF', height: 55, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  detailTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, color: '#1C1C1E' },
  detailDesc: { fontSize: 16, color: '#3A3A3C', lineHeight: 22, marginBottom: 30 },
  closeBtn: { backgroundColor: '#1C1C1E', height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }
});