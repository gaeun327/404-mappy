import React, { useEffect, useState } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, ScrollView,
  Dimensions, ActivityIndicator, FlatList, Alert, Modal
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { storage, db, auth } from '../firebaseConfig';
import { ref, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function DetailScreen() {
  const router = useRouter();
  const { id, title, description, type, user, userEmail, address, detailAddress, imagePaths, tags } = useLocalSearchParams();

  const [imageUrls, setImageUrls] = useState([]);
  const [imgLoading, setImgLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  const parsedTags = tags ? JSON.parse(tags) : [];
  const parsedPaths = imagePaths ? JSON.parse(decodeURIComponent(imagePaths)) : [];
  const isGood = type === 'blue';
  const isMyPost = !!auth.currentUser && auth.currentUser.email === userEmail;

  useEffect(() => {
    const loadImages = async () => {
      try {
        if (parsedPaths.length > 0) {
          const urls = await Promise.all(
            parsedPaths.map(path => getDownloadURL(ref(storage, path)))
          );
          setImageUrls(urls);
        }
      } catch (e) {
        console.log('이미지 로드 오류:', e);
      } finally {
        setImgLoading(false);
      }
    };

    const checkBookmark = async () => {
      try {
        const userEmail = auth.currentUser?.email;
        if (!userEmail || !id) return;
        const snap = await getDoc(doc(db, 'places', id));
        if (snap.exists()) {
          const bookmarks = snap.data().bookmarks ?? [];
          setBookmarked(bookmarks.includes(userEmail));
        }
      } catch (e) { console.log('북마크 확인 오류:', e); }
    };

    loadImages();
    checkBookmark();
  }, []);

  const toggleBookmark = async () => {
    const userEmail = auth.currentUser?.email;
    if (!userEmail || !id) return;
    setBookmarkLoading(true);
    try {
      const placeRef = doc(db, 'places', id);
      if (bookmarked) {
        await updateDoc(placeRef, { bookmarks: arrayRemove(userEmail) });
        setBookmarked(false);
      } else {
        await updateDoc(placeRef, { bookmarks: arrayUnion(userEmail) });
        setBookmarked(true);
      }
    } catch (e) { console.log('북마크 오류:', e); }
    finally { setBookmarkLoading(false); }
  };

  const handleDelete = () => {
    setMenuVisible(false);
    Alert.alert('삭제', '이 장소를 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'places', id));
            router.back();
          } catch (e) { Alert.alert('오류', '삭제에 실패했어요.'); }
        }
      }
    ]);
  };

  const handleEdit = () => {
    setMenuVisible(false);
    router.push({ pathname: '/editplace', params: { id } });
  };

  const fallbackImage = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800';
  const displayImages = imageUrls.length > 0 ? imageUrls : [fallbackImage];
  const fullAddress = [
    address && address !== 'undefined' ? address : null,
    detailAddress && detailAddress !== 'undefined' && detailAddress !== '' ? detailAddress : null,
  ].filter(Boolean).join(' ');

  return (
    <View style={styles.container}>

      {/* ✅ 사진 고정 영역 */}
      <View style={styles.heroContainer}>
        {imgLoading ? (
          <View style={styles.heroLoading}>
            <ActivityIndicator color="white" size="large" />
          </View>
        ) : (
          <FlatList
            data={displayImages}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => i.toString()}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / width);
              setCurrentIndex(index);
            }}
            renderItem={({ item }) => (
              <Image source={item} style={styles.heroImage} contentFit="cover" />
            )}
          />
        )}

        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#1C1C1E" />
        </TouchableOpacity>

        <View style={styles.topRight}>
          <TouchableOpacity style={styles.iconBtn} onPress={toggleBookmark} disabled={bookmarkLoading}>
            {bookmarkLoading
              ? <ActivityIndicator size="small" color="#007AFF" />
              : <Ionicons
                  name={bookmarked ? 'bookmark' : 'bookmark-outline'}
                  size={22}
                  color={bookmarked ? '#007AFF' : '#1C1C1E'}
                />
            }
          </TouchableOpacity>
          {isMyPost && (
            <TouchableOpacity style={styles.iconBtn} onPress={() => setMenuVisible(true)}>
              <Ionicons name="ellipsis-vertical" size={22} color="#1C1C1E" />
            </TouchableOpacity>
          )}
        </View>

        {displayImages.length > 1 && (
          <View style={styles.counter}>
            <Text style={styles.counterTxt}>{currentIndex + 1} / {displayImages.length}</Text>
          </View>
        )}

        {displayImages.length > 1 && (
          <View style={styles.dotRow}>
            {displayImages.map((_, i) => (
              <View key={i} style={[styles.dot, i === currentIndex && styles.dotActive]} />
            ))}
          </View>
        )}
      </View>

      {/* ✅ 콘텐츠만 스크롤 */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        bounces={true}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.contentBox}>

          <View style={styles.badgeRow}>
            <View style={[styles.typeBadge, { backgroundColor: isGood ? '#007AFF' : '#FF3B30' }]}>
              <Text style={styles.typeBadgeTxt}>{isGood ? '👍 추천' : '👎 비추천'}</Text>
            </View>
            {parsedTags.slice(0, 2).map((tag, i) => (
              <View key={i} style={styles.tagBadgeSmall}>
                <Text style={styles.tagBadgeSmallTxt}>{tag}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.titleTxt}>{title}</Text>

          <View style={styles.userRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarTxt}>
                {user && user !== 'undefined' ? user.charAt(0).toUpperCase() : '?'}
              </Text>
            </View>
            <View>
              <Text style={styles.userName}>{user && user !== 'undefined' ? user : '익명'}님의 기록</Text>
              <Text style={styles.userSub}>{new Date().toLocaleDateString('ko-KR')} 등록</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {description ? (
            <View style={styles.reviewSection}>
              <Text style={styles.reviewQuote}>"</Text>
              <Text style={styles.reviewTxt}>{description}</Text>
              <Text style={[styles.reviewQuote, { textAlign: 'right' }]}>"</Text>
            </View>
          ) : null}

          {parsedTags.length > 0 && (
            <View style={styles.tagRow}>
              {parsedTags.map((tag, i) => (
                <View key={i} style={styles.tagChip}>
                  <Text style={styles.tagChipTxt}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.divider} />

          {fullAddress ? (
            <View style={styles.addressCard}>
              <Ionicons name="location-outline" size={18} color="#007AFF" />
              <View style={{ flex: 1 }}>
                <Text style={styles.addressLabel}>위치</Text>
                <Text style={styles.addressVal}>{fullAddress}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.infoRow}>
            <View style={styles.infoCard}>
              <Ionicons name={isGood ? 'thumbs-up-outline' : 'thumbs-down-outline'} size={18} color={isGood ? '#007AFF' : '#FF3B30'} style={{ marginBottom: 6 }} />
              <Text style={styles.infoLabel}>유형</Text>
              <Text style={styles.infoVal}>{isGood ? '추천 스팟' : '주의 스팟'}</Text>
            </View>
            <View style={styles.infoCard}>
              <Ionicons name="calendar-outline" size={18} color="#007AFF" style={{ marginBottom: 6 }} />
              <Text style={styles.infoLabel}>등록일</Text>
              <Text style={styles.infoVal}>{new Date().toLocaleDateString('ko-KR')}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.bookmarkBtn, bookmarked && styles.bookmarkBtnOn]}
            onPress={toggleBookmark}
            disabled={bookmarkLoading}
          >
            {bookmarkLoading ? (
              <ActivityIndicator color={bookmarked ? 'white' : '#007AFF'} />
            ) : (
              <>
                <Ionicons name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={20} color={bookmarked ? 'white' : '#007AFF'} />
                <Text style={[styles.bookmarkBtnTxt, bookmarked && { color: 'white' }]}>
                  {bookmarked ? '저장됨' : '저장하기'}
                </Text>
              </>
            )}
          </TouchableOpacity>

        </View>
      </ScrollView>

      <Modal visible={menuVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuSheet}>
            <View style={styles.menuHandle} />
            <TouchableOpacity style={styles.menuItem} onPress={handleEdit}>
              <Ionicons name="pencil-outline" size={20} color="#1C1C1E" />
              <Text style={styles.menuItemTxt}>수정하기</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              <Text style={[styles.menuItemTxt, { color: '#FF3B30' }]}>삭제하기</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },

  heroContainer: { width, height: height * 0.45, position: 'relative' },
  heroLoading: { width, height: height * 0.45, backgroundColor: '#f2f2f2', justifyContent: 'center', alignItems: 'center' },
  heroImage: { width, height: height * 0.45 },

  backBtn: {
    position: 'absolute', top: 52, left: 16,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center', alignItems: 'center',
  },
  topRight: { position: 'absolute', top: 52, right: 16, flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center', alignItems: 'center',
  },

  counter: {
    position: 'absolute', top: 16, left: width / 2 - 24,
    backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20,
  },
  counterTxt: { color: 'white', fontSize: 12, fontWeight: '600' },

  dotRow: { position: 'absolute', bottom: 16, flexDirection: 'row', left: 0, right: 0, justifyContent: 'center', gap: 5 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: 'white', width: 16 },

  scrollView: { flex: 1 },
  contentContainer: { paddingBottom: 40 },
  contentBox: { backgroundColor: 'white', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24 },

  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  typeBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  typeBadgeTxt: { color: 'white', fontSize: 12, fontWeight: '700' },
  tagBadgeSmall: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: '#F2F2F7' },
  tagBadgeSmallTxt: { fontSize: 12, color: '#3A3A3C', fontWeight: '500' },

  titleTxt: { fontSize: 26, fontWeight: '800', color: '#1C1C1E', marginBottom: 16 },

  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#E6F1FB', justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { fontSize: 15, fontWeight: '700', color: '#185FA5' },
  userName: { fontSize: 14, fontWeight: '700', color: '#1C1C1E' },
  userSub: { fontSize: 12, color: '#8E8E93', marginTop: 2 },

  divider: { height: 1, backgroundColor: '#F2F2F7', marginBottom: 20 },

  reviewSection: { marginBottom: 20, paddingHorizontal: 4 },
  reviewQuote: { fontSize: 36, color: '#E5E5EA', fontWeight: '800', lineHeight: 36 },
  reviewTxt: { fontSize: 17, color: '#1C1C1E', lineHeight: 28, fontWeight: '500', paddingHorizontal: 8, marginVertical: -4 },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  tagChip: { backgroundColor: '#F2F2F7', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  tagChipTxt: { fontSize: 13, color: '#3A3A3C', fontWeight: '600' },

  addressCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#F8F8F8', borderRadius: 16, padding: 16, marginBottom: 12,
  },
  addressLabel: { fontSize: 11, color: '#8E8E93', marginBottom: 4 },
  addressVal: { fontSize: 14, fontWeight: '600', color: '#1C1C1E', lineHeight: 20 },

  infoRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  infoCard: { flex: 1, backgroundColor: '#F8F8F8', borderRadius: 16, padding: 14 },
  infoLabel: { fontSize: 11, color: '#8E8E93', marginBottom: 2 },
  infoVal: { fontSize: 12, fontWeight: '700', color: '#1C1C1E' },

  bookmarkBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 17, borderRadius: 16,
    borderWidth: 1.5, borderColor: '#007AFF', backgroundColor: 'white',
  },
  bookmarkBtnOn: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  bookmarkBtnTxt: { fontSize: 16, fontWeight: '700', color: '#007AFF' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  menuSheet: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: 44 },
  menuHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E5E5EA', alignSelf: 'center', marginBottom: 16 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 8 },
  menuItemTxt: { fontSize: 16, fontWeight: '600', color: '#1C1C1E' },
  menuDivider: { height: 1, backgroundColor: '#F2F2F7' },
});