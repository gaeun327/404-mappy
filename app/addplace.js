import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Image, FlatList, Dimensions, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { db, auth, storage } from '../firebaseConfig';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const CATEGORIES = [
  { id: 'food',     label: '🍽️ 음식점' },
  { id: 'cafe',     label: '☕ 카페·디저트' },
  { id: 'nature',   label: '🌿 자연·공원' },
  { id: 'culture',  label: '🎨 문화·전시' },
  { id: 'popup',    label: '🎪 팝업·이벤트' },
  { id: 'shop',     label: '🛍️ 쇼핑' },
  { id: 'hospital', label: '🏥 병원·약국' },
  { id: 'beauty',   label: '💇 미용' },
  { id: 'parking',  label: '🚗 주차장' },
  { id: 'stay',     label: '🏨 숙소' },
  { id: 'fitness',  label: '🏋️ 운동·헬스' },
  { id: 'study',    label: '📚 카공·스터디' },
  { id: 'play',     label: '🎮 오락·취미' },
  { id: 'etc',      label: '📍 기타' },
];
const PRESET_THEMES = ['🌸 벚꽃', '🍂 단풍', '❄️ 눈', '🌙 야경', '💑 데이트', '🐶 애견', '👤 혼자', '👯 친구들과', '📸 뷰맛집', '💰 가성비'];
const MAX_IMAGES = 10;
const { width } = Dimensions.get('window');
const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

export default function AddPlaceScreen() {
  const router = useRouter();
  const { latitude, longitude, address: paramAddress } = useLocalSearchParams();

  const [pinType, setPinType] = useState('blue');
  const [pinTitle, setPinTitle] = useState('');
  const [pinDesc, setPinDesc] = useState('');
  const [address, setAddress] = useState('');
  const [detailAddress, setDetailAddress] = useState('');
  const [addressLoading, setAddressLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [customTag, setCustomTag] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchAddress = async () => {
      console.log('📍 paramAddress:', paramAddress);
      console.log('📍 lat:', latitude, 'lng:', longitude);
      console.log('📍 KEY 있음?', GOOGLE_MAPS_KEY ? '✅' : '❌');

      if (paramAddress && paramAddress !== '현재 위치' && paramAddress !== '지도에서 선택한 위치') {
        setAddress(paramAddress);
        setAddressLoading(false);
        return;
      }

      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_KEY}&language=ko`;
        console.log('🌐 요청 URL:', url);
        const res = await fetch(url);
        const data = await res.json();
        console.log('📦 응답 status:', data.status);
        console.log('📦 응답 주소:', data.results?.[0]?.formatted_address);

        if (data.results && data.results.length > 0) {
          // 도로명 주소 우선(street_address), 없으면 첫 번째 결과
          const roadResult = data.results.find(r => r.types.includes('street_address'));
          const best = roadResult ?? data.results[0];
          // formatted_address에서 "대한민국 " 접두어만 제거
          const formatted = best.formatted_address.replace(/^대한민국\s*/, '');
          setAddress(formatted);
        } else {
          setAddress(paramAddress ?? '');
        }
      } catch (e) {
        console.log('❌ fetch 오류:', e);
        setAddress(paramAddress ?? '');
      } finally {
        setAddressLoading(false);
      }
    };
    fetchAddress();
  }, []);

  const toggleTag = (tag) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const addCustomTag = () => {
    if (!customTag.trim()) return;
    const tag = customTag.trim();
    if (!selectedTags.includes(tag)) setSelectedTags(prev => [...prev, tag]);
    setCustomTag('');
  };

  const pickFromGallery = async () => {
    if (selectedImages.length >= MAX_IMAGES) { Alert.alert('알림', `사진은 최대 ${MAX_IMAGES}장까지 추가할 수 있어요.`); return; }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('권한 필요', '갤러리 접근 권한이 필요합니다.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - selectedImages.length, quality: 0.7,
    });
    if (!result.canceled) {
      const newUris = result.assets.map(a => a.uri);
      setSelectedImages(prev => [...prev, ...newUris].slice(0, MAX_IMAGES));
    }
  };

  const pickFromCamera = async () => {
    if (selectedImages.length >= MAX_IMAGES) { Alert.alert('알림', `사진은 최대 ${MAX_IMAGES}장까지 추가할 수 있어요.`); return; }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('권한 필요', '카메라 접근 권한이 필요합니다.'); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.7 });
    if (!result.canceled) setSelectedImages(prev => [...prev, result.assets[0].uri]);
  };

  const handleImagePick = () => {
    Alert.alert('사진 추가', '어떻게 추가할까요?', [
      { text: '카메라로 촬영', onPress: pickFromCamera },
      { text: '갤러리에서 선택', onPress: pickFromGallery },
      { text: '취소', style: 'cancel' },
    ]);
  };

  const removeImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const uploadImage = async (uri, placeId, index) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = async () => {
        try {
          const blob = xhr.response;
          const path = `places/${placeId}_${index}.jpg`;
          const storageRef = ref(storage, path);
          await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
          const url = await getDownloadURL(storageRef);
          resolve({ url, path });
        } catch (e) { reject(e); }
      };
      xhr.onerror = reject;
      xhr.responseType = 'blob';
      xhr.open('GET', uri, true);
      xhr.send(null);
    });
  };

  const handleSave = async () => {
    if (!pinTitle.trim()) return Alert.alert('알림', '장소 이름을 입력해주세요.');
    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, 'places'), {
        title: pinTitle,
        description: pinDesc,
        type: pinType,
        category: category,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address: address,
        detailAddress: detailAddress,
        tags: selectedTags,
        imageUrls: [],
        imagePaths: [],
        userEmail: auth.currentUser?.email,
        userNickname: auth.currentUser?.displayName ?? '익명',
        createdAt: new Date(),
      });

      if (selectedImages.length > 0) {
        try {
          const results = await Promise.all(
            selectedImages.map((uri, i) => uploadImage(uri, docRef.id, i))
          );
          const imageUrls = results.map(r => r.url);
          const imagePaths = results.map(r => r.path);
          await updateDoc(doc(db, 'places', docRef.id), { imageUrls, imagePaths });
        } catch (imgError) {
          Alert.alert('알림', '장소는 등록됐는데 사진 업로드에 실패했어요.');
          router.back();
          return;
        }
      }

      Alert.alert('완료', '장소가 등록되었습니다! 🎉', [
        { text: '확인', onPress: () => router.back() }
      ]);
    } catch (e) {
      Alert.alert('오류', e.message ?? '저장에 실패했습니다.');
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1C1C1E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>장소 등록</Text>
        <TouchableOpacity
          style={[styles.saveHeaderBtn, { backgroundColor: pinType === 'blue' ? '#007AFF' : '#FF3B30' }]}
          onPress={handleSave} disabled={loading}
        >
          {loading ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.saveHeaderTxt}>등록</Text>}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">

        <View style={styles.imageSection}>
          <FlatList
            data={[...selectedImages, 'add']}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => i.toString()}
            renderItem={({ item, index }) => {
              if (item === 'add') {
                if (selectedImages.length >= MAX_IMAGES) return null;
                return (
                  <TouchableOpacity style={styles.addImageBtn} onPress={handleImagePick}>
                    <Ionicons name="camera-outline" size={28} color="#C7C7CC" />
                    <Text style={styles.addImageCount}>{selectedImages.length}/{MAX_IMAGES}</Text>
                  </TouchableOpacity>
                );
              }
              return (
                <View style={styles.imageThumb}>
                  <Image source={{ uri: item }} style={styles.thumbImg} />
                  <TouchableOpacity style={styles.removeBtn} onPress={() => removeImage(index)}>
                    <Ionicons name="close-circle" size={22} color="white" />
                  </TouchableOpacity>
                </View>
              );
            }}
            ListEmptyComponent={
              <TouchableOpacity style={styles.emptyImageBtn} onPress={handleImagePick}>
                <Ionicons name="camera-outline" size={32} color="#C7C7CC" />
                <Text style={styles.imgPlaceholderText}>사진 추가 (최대 10장)</Text>
                <Text style={styles.imgPlaceholderSub}>탭하여 카메라 촬영 또는 갤러리 선택</Text>
              </TouchableOpacity>
            }
          />
        </View>

        <Text style={styles.sectionLabel}>주소</Text>
        {addressLoading ? (
          <View style={[styles.input, { justifyContent: 'center', height: 50 }]}>
            <ActivityIndicator size="small" color="#007AFF" />
          </View>
        ) : (
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="주소를 입력해주세요"
          />
        )}

        <Text style={styles.sectionLabel}>상세주소</Text>
        <TextInput
          style={styles.input}
          value={detailAddress}
          onChangeText={setDetailAddress}
          placeholder="예: 2층, B동 101호"
        />

        <Text style={styles.sectionLabel}>유형</Text>
        <View style={styles.typeRow}>
          <TouchableOpacity style={[styles.typeBtn, pinType === 'blue' && styles.typeBtnBlue]} onPress={() => setPinType('blue')}>
            <Text style={[styles.typeBtnTxt, pinType === 'blue' && { color: 'white' }]}>👍 추천 (Blue)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.typeBtn, pinType === 'red' && styles.typeBtnRed]} onPress={() => setPinType('red')}>
            <Text style={[styles.typeBtnTxt, pinType === 'red' && { color: 'white' }]}>👎 경고 (Red)</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>장소 이름 <Text style={styles.required}>*</Text></Text>
        <TextInput style={styles.input} placeholder="예: 성수 감성 카페" value={pinTitle} onChangeText={setPinTitle} />

        <Text style={styles.sectionLabel}>한줄 평</Text>
        <TextInput
          style={[styles.input, { height: 90, textAlignVertical: 'top', paddingTop: 14 }]}
          placeholder="예: 분위기 좋고 커피 맛있어요!"
          value={pinDesc} onChangeText={setPinDesc} multiline
        />

        <Text style={styles.sectionLabel}>카테고리 <Text style={styles.required}>*</Text></Text>
        <View style={styles.tagWrap}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.tagChip, category === cat.id && styles.tagChipOn]}
              onPress={() => setCategory(cat.id)}
            >
              <Text style={[styles.tagChipTxt, category === cat.id && { color: 'white' }]}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>테마 태그</Text>
        <View style={styles.tagWrap}>
          {PRESET_THEMES.map(tag => (
            <TouchableOpacity
              key={tag}
              style={[styles.tagChip, selectedTags.includes(tag) && styles.tagChipOn]}
              onPress={() => toggleTag(tag)}
            >
              <Text style={[styles.tagChipTxt, selectedTags.includes(tag) && { color: 'white' }]}>{tag}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.customRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            placeholder="직접 입력 (예: 바다뷰)"
            value={customTag} onChangeText={setCustomTag}
            onSubmitEditing={addCustomTag} returnKeyType="done"
          />
          <TouchableOpacity style={styles.addBtn} onPress={addCustomTag}>
            <Ionicons name="add" size={22} color="white" />
          </TouchableOpacity>
        </View>

        {selectedTags.filter(t => !PRESET_THEMES.includes(t)).length > 0 && (
          <View style={[styles.tagWrap, { marginTop: 10 }]}>
            {selectedTags.filter(t => !PRESET_THEMES.includes(t)).map(tag => (
              <TouchableOpacity key={tag} style={styles.tagChipOn} onPress={() => toggleTag(tag)}>
                <Text style={[styles.tagChipTxt, { color: 'white' }]}>{tag} ✕</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: pinType === 'blue' ? '#007AFF' : '#FF3B30' }]}
          onPress={handleSave} disabled={loading}
        >
          {loading ? <ActivityIndicator color="white" /> : <Text style={styles.saveBtnTxt}>등록하기</Text>}
        </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F2F2F7',
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1C1C1E' },
  saveHeaderBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 },
  saveHeaderTxt: { color: 'white', fontWeight: '700', fontSize: 14 },
  content: { paddingTop: 20, paddingBottom: 300 },
  imageSection: { height: 160, marginBottom: 20, paddingLeft: 24 },
  emptyImageBtn: {
    width: width - 48, height: 150, borderRadius: 16,
    backgroundColor: '#F8F8F8', borderWidth: 1.5, borderColor: '#E5E5EA',
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  addImageBtn: {
    width: 100, height: 150, borderRadius: 16, marginRight: 10,
    backgroundColor: '#F8F8F8', borderWidth: 1.5, borderColor: '#E5E5EA',
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  addImageCount: { fontSize: 12, color: '#C7C7CC' },
  imageThumb: { width: 150, height: 150, borderRadius: 16, marginRight: 10, overflow: 'hidden' },
  thumbImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  removeBtn: { position: 'absolute', top: 6, right: 6 },
  imgPlaceholderText: { fontSize: 15, fontWeight: '600', color: '#8E8E93' },
  imgPlaceholderSub: { fontSize: 12, color: '#C7C7CC' },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#1C1C1E', marginBottom: 10, paddingHorizontal: 24 },
  required: { color: '#FF3B30' },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 20, paddingHorizontal: 24 },
  typeBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E5EA' },
  typeBtnBlue: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  typeBtnRed: { backgroundColor: '#FF3B30', borderColor: '#FF3B30' },
  typeBtnTxt: { fontWeight: '700', fontSize: 14, color: '#8E8E93' },
  input: { backgroundColor: '#F2F2F7', padding: 14, borderRadius: 12, fontSize: 15, marginBottom: 20, marginHorizontal: 24 },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14, paddingHorizontal: 24 },
  tagChip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F2F2F7', borderWidth: 1.5, borderColor: '#E5E5EA' },
  tagChipOn: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, backgroundColor: '#007AFF', borderWidth: 1.5, borderColor: '#007AFF' },
  tagChipTxt: { fontSize: 13, fontWeight: '600', color: '#8E8E93' },
  customRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 20, paddingHorizontal: 24 },
  addBtn: { width: 46, height: 46, backgroundColor: '#007AFF', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  saveBtn: { padding: 17, borderRadius: 14, alignItems: 'center', marginTop: 10, marginHorizontal: 24 },
  saveBtnTxt: { color: 'white', fontWeight: '800', fontSize: 16 },
});