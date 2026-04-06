import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, View, Text, TouchableOpacity, TextInput, Modal, Alert, 
  KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, Dimensions, 
  ActivityIndicator, Platform, FlatList, ScrollView 
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../firebaseConfig';
import { collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { useRouter } from 'expo-router';

// 카테고리 종류 정의
const CATEGORIES = [
  { id: 'all', label: '전체', icon: 'grid' },
  { id: 'food', label: '식당', icon: 'restaurant' },
  { id: 'cafe', label: '카페', icon: 'cafe' },
  { id: 'pub', label: '술집', icon: 'beer' },
  { id: 'etc', label: '기타', icon: 'ellipsis-horizontal' },
];

export default function HomeScreen() {
  const router = useRouter();
  const mapRef = useRef(null);
  
  // 상태 관리
  const [markers, setMarkers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [regModalVisible, setRegModalVisible] = useState(false); 
  const [detailModalVisible, setDetailModalVisible] = useState(false); 
  const [listVisible, setListVisible] = useState(false);
  
  // 등록 데이터 상태
  const [selectedPlace, setSelectedPlace] = useState(null); 
  const [placeName, setPlaceName] = useState('');
  const [description, setDescription] = useState('');
  const [recommend, setRecommend] = useState('good');
  const [rating, setRating] = useState(5); // 별점 상태
  const [category, setCategory] = useState('food'); // 카테고리 상태
  const [tempCoords, setTempCoords] = useState(null);
  
  // 필터 및 검색 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 현재 선택된 필터

  useEffect(() => { fetchMarkers(); }, []);

  const fetchMarkers = async () => {
    try {
      const q = query(collection(db, "places"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setMarkers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (e) { console.log("불러오기 에러:", e); }
  };

  const moveToMyLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return Alert.alert("알림", "위치 권한이 필요합니다.");
      let loc = await Location.getCurrentPositionAsync({});
      mapRef.current?.animateToRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 1000);
    } catch (e) { Alert.alert("에러", "위치를 가져올 수 없습니다."); }
  };

  const addMarker = async () => {
    if (!placeName) return Alert.alert("알림", "이름을 입력하세요!");
    setLoading(true);
    try {
      await addDoc(collection(db, "places"), {
        title: placeName,
        description,
        type: recommend,
        rating,      // 별점 저장
        category,    // 카테고리 저장
        coordinate: tempCoords,
        userEmail: auth.currentUser?.email,
        createdAt: new Date(),
      });
      fetchMarkers();
      setRegModalVisible(false);
      resetForm();
    } catch (e) { Alert.alert("에러", "저장 실패"); }
    finally { setLoading(false); }
  };

  const resetForm = () => {
    setPlaceName(''); setDescription(''); setRecommend('good');
    setRating(5); setCategory('food');
  };

  // 🔍 필터링 로직 (검색어 + 카테고리 필터)
  const filteredMarkers = markers.filter(m => {
    const matchesSearch = m.title.includes(searchQuery);
    const matchesCategory = activeFilter === 'all' || m.category === activeFilter;
    return matchesSearch && matchesCategory;
  });

  // 별점 그리기 함수
  const renderStars = (num) => (
    <View style={{flexDirection: 'row'}}>
      {[1,2,3,4,5].map(i => (
        <Ionicons key={i} name={i <= num ? "star" : "star-outline"} size={16} color="#FFD700" />
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* 🔍 검색바 및 카테고리 필터 */}
      <View style={styles.topContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#888" />
          <TextInput style={styles.searchInput} placeholder="맛집 검색..." value={searchQuery} onChangeText={setSearchQuery} />
        </View>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity 
              key={cat.id} 
              style={[styles.filterItem, activeFilter === cat.id && styles.filterActive]}
              onPress={() => setActiveFilter(cat.id)}
            >
              <Ionicons name={cat.icon} size={16} color={activeFilter === cat.id ? 'white' : '#555'} />
              <Text style={[styles.filterText, activeFilter === cat.id && {color: 'white'}]}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <MapView 
        ref={mapRef} style={styles.map} 
        onLongPress={(e) => { setTempCoords(e.nativeEvent.coordinate); setRegModalVisible(true); }}
        showsUserLocation={true}
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

      <TouchableOpacity style={styles.myLocationBtn} onPress={moveToMyLocation}>
        <Ionicons name="navigate" size={24} color="#007AFF" />
      </TouchableOpacity>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.listBtn} onPress={() => setListVisible(true)}>
          <Ionicons name="list" size={20} color="white" />
          <Text style={styles.btnTextWhite}>목록</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.myPageBtn} onPress={() => router.push('/mypage')}>
          <Ionicons name="person" size={20} color="#333" />
          <Text style={styles.btnTextBlack}>내 정보</Text>
        </TouchableOpacity>
      </View>

      {/* 📝 1. 등록 모달 (별점 + 카테고리 추가) */}
      <Modal visible={regModalVisible} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.overlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
              <View style={styles.sheet}>
                <View style={styles.handle} />
                <Text style={styles.title}>📍 장소 등록</Text>
                
                {/* 카테고리 선택 */}
                <View style={styles.categoryRow}>
                  {CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                    <TouchableOpacity 
                      key={cat.id} 
                      style={[styles.catChip, category === cat.id && styles.catChipActive]}
                      onPress={() => setCategory(cat.id)}
                    >
                      <Text style={{color: category === cat.id ? 'white' : '#555'}}>{cat.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* 별점 선택 */}
                <View style={styles.ratingBox}>
                  {[1,2,3,4,5].map(num => (
                    <TouchableOpacity key={num} onPress={() => setRating(num)}>
                      <Ionicons name={num <= rating ? "star" : "star-outline"} size={35} color="#FFD700" />
                    </TouchableOpacity>
                  ))}
                </View>

                <TextInput style={styles.input} placeholder="장소 이름" value={placeName} onChangeText={setPlaceName} />
                <TextInput style={[styles.input, {height:70}]} placeholder="리뷰를 남겨주세요" value={description} onChangeText={setDescription} multiline />
                
                <View style={styles.row}>
                   <TouchableOpacity style={[styles.tab, recommend==='good' && {backgroundColor:'#007AFF'}]} onPress={()=>setRecommend('good')}>
                     <Text style={{color:recommend==='good'?'white':'#888'}}>👍 추천</Text>
                   </TouchableOpacity>
                   <TouchableOpacity style={[styles.tab, recommend==='bad' && {backgroundColor:'#FF3B30'}]} onPress={()=>setRecommend('bad')}>
                     <Text style={{color:recommend==='bad'?'white':'#888'}}>👎 비추천</Text>
                   </TouchableOpacity>
                </View>

                <View style={styles.row}>
                  <TouchableOpacity style={styles.cancel} onPress={()=>setRegModalVisible(false)}><Text>취소</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.save} onPress={addMarker}>
                    <Text style={{color:'white', fontWeight:'bold'}}>등록</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ℹ️ 2. 상세정보 모달 */}
      <Modal visible={detailModalVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.sheet, { paddingBottom: 40 }]}>
            <View style={styles.handle} />
            {selectedPlace && (
              <>
                <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                  <Text style={styles.detailCategory}>{CATEGORIES.find(c => c.id === selectedPlace.category)?.label || '기타'}</Text>
                  {renderStars(selectedPlace.rating)}
                </View>
                <Text style={styles.detailTitle}>{selectedPlace.title}</Text>
                <Text style={styles.detailDesc}>{selectedPlace.description}</Text>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setDetailModalVisible(false)}><Text style={{color:'white'}}>닫기</Text></TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* 📜 3. 리스트 모달 (생략 - 기존 리스트와 동일) */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  map: { flex: 1 },
  topContainer: { position: 'absolute', top: 50, left: 0, right: 0, zIndex: 10 },
  searchBar: { marginHorizontal: 20, height: 45, backgroundColor: 'white', borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, elevation: 5, shadowOpacity: 0.1 },
  searchInput: { flex: 1, marginLeft: 10 },
  filterScroll: { marginTop: 10, paddingLeft: 20 },
  filterItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginRight: 8, elevation: 3, shadowOpacity: 0.05 },
  filterActive: { backgroundColor: '#333' },
  filterText: { marginLeft: 5, fontWeight: 'bold', color: '#555' },
  myLocationBtn: { position: 'absolute', bottom: 100, right: 20, backgroundColor: 'white', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  buttonRow: { position: 'absolute', bottom: 30, flexDirection: 'row', alignSelf: 'center', gap: 10 },
  listBtn: { backgroundColor: '#333', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 30, flexDirection: 'row', alignItems: 'center' },
  myPageBtn: { backgroundColor: 'white', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 30, flexDirection: 'row', alignItems: 'center', elevation: 3 },
  btnTextWhite: { color: 'white', fontWeight: 'bold', marginLeft: 8 },
  btnTextBlack: { color: '#333', fontWeight: 'bold', marginLeft: 8 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: 'white', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 25 },
  handle: { width: 40, height: 4, backgroundColor: '#eee', alignSelf: 'center', marginBottom: 15 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  ratingBox: { flexDirection: 'row', justifyContent: 'center', marginBottom: 15 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 },
  catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, backgroundColor: '#f0f0f0' },
  catChipActive: { backgroundColor: '#333' },
  input: { backgroundColor: '#f5f5f5', padding: 12, borderRadius: 10, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  tab: { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#eee' },
  cancel: { flex: 1, alignItems: 'center', padding: 15 },
  save: { flex: 2, backgroundColor: '#007AFF', borderRadius: 10, alignItems: 'center', padding: 15 },
  detailCategory: { color: '#888', fontSize: 12, marginBottom: 5 },
  detailTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
  detailDesc: { color: '#444', marginBottom: 20 },
  closeBtn: { backgroundColor: '#333', padding: 15, borderRadius: 12, alignItems: 'center' }
});