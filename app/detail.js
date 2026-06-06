import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, ScrollView,
  Dimensions, ActivityIndicator, FlatList, Alert, Modal,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { storage, db, auth } from '../firebaseConfig';
import { ref, getDownloadURL } from 'firebase/storage';
import {
  doc, getDoc, updateDoc, arrayUnion, arrayRemove, deleteDoc,
  collection, addDoc, getDocs, orderBy, query, where, serverTimestamp,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const timeAgo = (ts) => {
  if (!ts) return '';
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
};

const CATEGORY_MAP = {
  food: '🍽️ 음식점', cafe: '☕ 카페·디저트', nature: '🌿 자연·공원',
  culture: '🎨 문화·전시', popup: '🎪 팝업·이벤트', shop: '🛍️ 쇼핑',
  hospital: '🏥 병원·약국', beauty: '💇 미용', parking: '🚗 주차장',
  stay: '🏨 숙소', fitness: '🏋️ 운동·헬스', study: '📚 카공·스터디',
  play: '🎮 오락·취미', etc: '📍 기타',
};

export default function DetailScreen() {
  const router = useRouter();
  const { id, title, description, type, user, userEmail, address, detailAddress, imagePaths, tags, category, scrollToComment, verified } = useLocalSearchParams();
  const scrollRef = useRef(null);

  const [imageUrls, setImageUrls] = useState([]);
  const [imgLoading, setImgLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeLoading, setLikeLoading] = useState(false);

  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const [createdAt, setCreatedAt] = useState(null);
  const [myNickname, setMyNickname] = useState('');

  const parsedTags = tags ? JSON.parse(tags) : [];
  const parsedPaths = imagePaths ? JSON.parse(decodeURIComponent(imagePaths)) : [];
  const isGood = type === 'blue';
  const isMyPost = !!auth.currentUser && auth.currentUser.email === userEmail;
  const myEmail = auth.currentUser?.email;

  useEffect(() => {
    loadImages();
    loadPlaceData();
    loadComments();
    if (scrollToComment === 'true') {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 800);
    }
  }, []);

  const loadImages = async () => {
    try {
      if (parsedPaths.length > 0) {
        const urls = await Promise.all(parsedPaths.map(p => getDownloadURL(ref(storage, p))));
        setImageUrls(urls);
      }
    } catch (e) {}
    finally { setImgLoading(false); }
  };

  const loadPlaceData = async () => {
    if (!id) return;
    try {
      const snap = await getDoc(doc(db, 'places', id));
      if (!snap.exists()) return;
      const data = snap.data();
      const bookmarks = data.bookmarks ?? [];
      const likes = data.likes ?? [];
      setBookmarked(myEmail ? bookmarks.includes(myEmail) : false);
      setLiked(myEmail ? likes.includes(myEmail) : false);
      setLikeCount(likes.length);
      setCreatedAt(data.createdAt ?? null);
    } catch (e) {}
    try {
      const displayName = auth.currentUser?.displayName;
      if (displayName) {
        setMyNickname(displayName);
      } else if (auth.currentUser?.uid) {
        const userSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userSnap.exists()) setMyNickname(userSnap.data().nickname ?? '익명');
      }
    } catch (e) {}
  };

  const loadComments = async () => {
    if (!id) return;
    setCommentLoading(true);
    try {
      const q = query(collection(db, 'places', id, 'comments'), orderBy('createdAt', 'asc'));
      const snap = await getDocs(q);
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {}
    finally { setCommentLoading(false); }
  };

  const toggleBookmark = async () => {
    if (!myEmail || !id) return;
    setBookmarkLoading(true);
    try {
      const placeRef = doc(db, 'places', id);
      if (bookmarked) {
        await updateDoc(placeRef, { bookmarks: arrayRemove(myEmail) });
        setBookmarked(false);
      } else {
        await updateDoc(placeRef, { bookmarks: arrayUnion(myEmail) });
        setBookmarked(true);
      }
    } catch (e) {}
    finally { setBookmarkLoading(false); }
  };

  const toggleLike = async () => {
    if (!myEmail || !id) return;
    setLikeLoading(true);
    try {
      const placeRef = doc(db, 'places', id);
      if (liked) {
        await updateDoc(placeRef, { likes: arrayRemove(myEmail) });
        setLiked(false);
        setLikeCount(prev => prev - 1);
      } else {
        await updateDoc(placeRef, { likes: arrayUnion(myEmail) });
        setLiked(true);
        setLikeCount(prev => prev + 1);
      }
    } catch (e) {}
    finally { setLikeLoading(false); }
  };

  const goToUserProfile = async (email, nickname) => {
    if (!email) return;
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('email', '==', email)));
      if (!snap.empty) router.push({ pathname: '/userprofile', params: { uid: snap.docs[0].id, nickname } });
    } catch (e) {}
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    if (!myEmail) { Alert.alert('알림', '로그인이 필요합니다.'); return; }
    setCommentSubmitting(true);
    try {
      const newComment = {
        text: commentText.trim(),
        userEmail: myEmail,
        userNickname: myNickname || auth.currentUser?.displayName || '익명',
        createdAt: serverTimestamp(),
      };
      const docRef = await addDoc(collection(db, 'places', id, 'comments'), newComment);
      setComments(prev => [...prev, { id: docRef.id, ...newComment, createdAt: { toDate: () => new Date() } }]);
      setCommentText('');
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {}
    finally { setCommentSubmitting(false); }
  };

  const deleteComment = (commentId) => {
    Alert.alert('댓글 삭제', '이 댓글을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        try {
          await deleteDoc(doc(db, 'places', id, 'comments', commentId));
          setComments(prev => prev.filter(c => c.id !== commentId));
        } catch (e) { Alert.alert('오류', '삭제에 실패했어요.'); }
      }}
    ]);
  };

  const handleDelete = () => {
    setMenuVisible(false);
    Alert.alert('삭제', '이 장소를 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        try {
          await deleteDoc(doc(db, 'places', id));
          router.back();
        } catch (e) { Alert.alert('오류', '삭제에 실패했어요.'); }
      }}
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* 사진 영역 */}
      <View style={styles.heroContainer}>
        {imgLoading ? (
          <View style={styles.heroLoading}>
            <ActivityIndicator color="white" size="large" />
          </View>
        ) : (
          <FlatList
            data={displayImages}
            horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => i.toString()}
            onMomentumScrollEnd={(e) => setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
            renderItem={({ item }) => <Image source={item} style={styles.heroImage} contentFit="cover" />}
          />
        )}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#1C1C1E" />
        </TouchableOpacity>
        <View style={styles.topRight}>
          <TouchableOpacity style={styles.iconBtn} onPress={toggleBookmark} disabled={bookmarkLoading}>
            {bookmarkLoading
              ? <ActivityIndicator size="small" color="#007AFF" />
              : <Ionicons name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={22} color={bookmarked ? '#007AFF' : '#1C1C1E'} />
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

      {/* 스크롤 콘텐츠 */}
      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        bounces={true}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.contentBox}>

          {/* 배지: 추천 ←→ 방문인증 */}
          <View style={styles.titleRow}>
            <View style={[styles.typeBadge, { backgroundColor: isGood ? '#007AFF' : '#FF3B30' }]}>
              <Text style={styles.typeBadgeTxt}>{isGood ? '👍 추천' : '👎 비추천'}</Text>
            </View>
            {verified === 'true' && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={13} color="#34C759" />
                <Text style={styles.verifiedTxt}>방문 인증</Text>
              </View>
            )}
          </View>

          {/* 제목 */}
          <Text style={styles.titleTxt}>{title}</Text>

          {/* 작성자(탭하면 프로필) + 좋아요 */}
          <View style={styles.metaRow}>
            <TouchableOpacity style={styles.userRow} activeOpacity={0.7} onPress={() => goToUserProfile(userEmail, user)}>
              <View style={styles.avatar}>
                <Text style={styles.avatarTxt}>
                  {user && user !== 'undefined' ? user.charAt(0).toUpperCase() : '?'}
                </Text>
              </View>
              <View>
                <Text style={styles.userName}>{user && user !== 'undefined' ? user : '익명'}</Text>
                <Text style={styles.userSub}>
                  {createdAt
                    ? (createdAt?.toDate ? createdAt.toDate() : new Date(createdAt)).toLocaleDateString('ko-KR')
                    : ''}
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.likeBtn} onPress={toggleLike} disabled={likeLoading}>
              {likeLoading
                ? <ActivityIndicator size="small" color="#FF2D55" />
                : <Ionicons name={liked ? 'heart' : 'heart-outline'} size={20} color={liked ? '#FF2D55' : '#8E8E93'} />
              }
              <Text style={[styles.likeBtnTxt, liked && { color: '#FF2D55' }]}>{likeCount}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* 한줄 평 */}
          {description ? <Text style={styles.reviewTxt}>{description}</Text> : null}

          {/* 위치 박스 */}
          {fullAddress ? (
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={16} color="#007AFF" />
                <Text style={styles.infoTxt}>{fullAddress}</Text>
              </View>
            </View>
          ) : null}

          {/* 카테고리 + 테마 태그 한 줄 */}
          {(category || parsedTags.length > 0) && (
            <View style={styles.tagRow}>
              {category && CATEGORY_MAP[category] && (
                <View style={styles.tagChip}>
                  <Text style={styles.tagChipTxt}>{CATEGORY_MAP[category]}</Text>
                </View>
              )}
              {parsedTags.map((tag, i) => (
                <View key={i} style={styles.tagChip}>
                  <Text style={styles.tagChipTxt}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.divider} />

          {/* 댓글 섹션 */}
          <View style={styles.commentSection}>
            <Text style={styles.commentTitle}>
              댓글 <Text style={styles.commentCount}>{comments.length}</Text>
            </Text>
            {commentLoading ? (
              <ActivityIndicator size="small" color="#007AFF" style={{ marginVertical: 16 }} />
            ) : comments.length === 0 ? (
              <View style={styles.noComment}>
                <Text style={styles.noCommentTxt}>첫 번째 댓글을 남겨보세요!</Text>
              </View>
            ) : (
              comments.map(comment => (
                <View key={comment.id} style={styles.commentItem}>
                  <TouchableOpacity style={styles.commentAvatar} onPress={() => goToUserProfile(comment.userEmail, comment.userNickname)} activeOpacity={0.7}>
                    <Text style={styles.commentAvatarTxt}>
                      {(comment.userNickname ?? '?')[0].toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.commentBody}>
                    <View style={styles.commentHeader}>
                      <TouchableOpacity onPress={() => goToUserProfile(comment.userEmail, comment.userNickname)} activeOpacity={0.7}>
                        <Text style={styles.commentNickname}>{comment.userNickname ?? '익명'}</Text>
                      </TouchableOpacity>
                      <Text style={styles.commentTime}>{timeAgo(comment.createdAt)}</Text>
                      {comment.userEmail === myEmail && (
                        <TouchableOpacity onPress={() => deleteComment(comment.id)} style={styles.commentDeleteBtn}>
                          <Ionicons name="close" size={14} color="#C7C7CC" />
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={styles.commentTxt}>{comment.text}</Text>
                  </View>
                </View>
              ))
            )}
          </View>

        </View>
      </ScrollView>

      {/* 댓글 입력창 */}
      <View style={styles.commentInputBar}>
        <TextInput
          style={styles.commentInput}
          placeholder="댓글을 입력하세요..."
          placeholderTextColor="#C7C7CC"
          value={commentText}
          onChangeText={setCommentText}
          multiline
          maxLength={200}
          returnKeyType="send"
          onSubmitEditing={submitComment}
        />
        <TouchableOpacity
          style={[styles.commentSendBtn, { opacity: commentText.trim() ? 1 : 0.4 }]}
          onPress={submitComment}
          disabled={commentSubmitting || !commentText.trim()}
        >
          {commentSubmitting
            ? <ActivityIndicator size="small" color="white" />
            : <Ionicons name="send" size={18} color="white" />
          }
        </TouchableOpacity>
      </View>

      {/* 수정/삭제 메뉴 */}
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
    </KeyboardAvoidingView>
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
  contentContainer: { paddingBottom: 20 },
  contentBox: { backgroundColor: 'white', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24 },

  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  typeBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, alignSelf: 'flex-start' },
  typeBadgeTxt: { color: 'white', fontSize: 12, fontWeight: '700' },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EDFAF4', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10 },
  verifiedTxt: { fontSize: 12, fontWeight: '700', color: '#34C759' },

  titleTxt: { fontSize: 24, fontWeight: '800', color: '#1C1C1E', marginBottom: 6 },

  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, marginTop: 10 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E6F1FB', justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { fontSize: 14, fontWeight: '700', color: '#185FA5' },
  userName: { fontSize: 14, fontWeight: '700', color: '#1C1C1E' },
  userSub: { fontSize: 11, color: '#8E8E93', marginTop: 2 },

  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#F8F8F8' },
  likeBtnTxt: { fontSize: 14, fontWeight: '700', color: '#8E8E93' },

  divider: { height: 1, backgroundColor: '#F2F2F7', marginBottom: 20 },
  reviewTxt: { fontSize: 16, color: '#3A3A3C', lineHeight: 26, marginBottom: 16 },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  tagChip: { backgroundColor: '#F2F2F7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  tagChipTxt: { fontSize: 13, color: '#3A3A3C', fontWeight: '600' },

  infoCard: { backgroundColor: '#F8F8F8', borderRadius: 14, padding: 14, gap: 10, marginBottom: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoTxt: { fontSize: 14, color: '#3A3A3C', fontWeight: '500', flex: 1 },

  commentSection: { paddingBottom: 12 },
  commentTitle: { fontSize: 16, fontWeight: '800', color: '#1C1C1E', marginBottom: 16 },
  commentCount: { color: '#007AFF' },
  noComment: { paddingVertical: 24, alignItems: 'center' },
  noCommentTxt: { fontSize: 14, color: '#C7C7CC' },

  commentItem: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E6F1FB', justifyContent: 'center', alignItems: 'center' },
  commentAvatarTxt: { fontSize: 13, fontWeight: '700', color: '#185FA5' },
  commentBody: { flex: 1 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  commentNickname: { fontSize: 13, fontWeight: '700', color: '#1C1C1E' },
  commentTime: { fontSize: 11, color: '#AEAEB2' },
  commentDeleteBtn: { marginLeft: 'auto', padding: 2 },
  commentTxt: { fontSize: 14, color: '#3A3A3C', lineHeight: 20 },

  commentInputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
    backgroundColor: 'white',
    borderTopWidth: 1, borderTopColor: '#F2F2F7',
  },
  commentInput: {
    flex: 1, backgroundColor: '#F2F2F7', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 15, color: '#1C1C1E', maxHeight: 100,
  },
  commentSendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center',
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  menuSheet: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: 44 },
  menuHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E5E5EA', alignSelf: 'center', marginBottom: 16 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 8 },
  menuItemTxt: { fontSize: 16, fontWeight: '600', color: '#1C1C1E' },
  menuDivider: { height: 1, backgroundColor: '#F2F2F7' },
});