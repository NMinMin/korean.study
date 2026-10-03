// Fallback and Mock Data for Korean Study App
import React, { createContext, useContext } from 'react';
import { RotateCcw, XCircle, CheckCircle2 } from 'lucide-react';

export const USER = { name: "Mai Anh", level: 12, xp: 1250, xpMax: 2000, streak: 12, todayLessons: 3, gems: 1250 };
export const GemBalanceContext = createContext(0);
export const UserStatsContext = createContext({ xp: 0, streak: 0 });

export function UserGemCount() {
  return useContext(GemBalanceContext).toLocaleString("vi-VN");
}

export function UserXpCount() {
  const { xp = 0 } = useContext(UserStatsContext);
  return (xp || 0).toLocaleString("vi-VN");
}

export function UserStreakCount() {
  const { streak = 0 } = useContext(UserStatsContext);
  return (streak || 0).toLocaleString("vi-VN");
}

export function DiamondIcon({ size = 18, color = "#7465E7", fill = "#B8AEF5", className = "" }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4.2 8.1 7.4 3.8h9.2l3.2 4.3L12 20.2 4.2 8.1Z" fill={fill} stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="m7.4 3.8 2.1 4.3L12 20.2l2.5-12.1 2.1-4.3M4.2 8.1h15.6" stroke={color} strokeWidth="1.25" strokeLinejoin="round" opacity=".9" />
    </svg>
  );
}

export const FALLBACK_TEXTBOOK_ID = "fallback-sejong-workbook";
export const FALLBACK_LESSONS = [
  { title: "꽃다발이나 케이크는 어때요?", words: 5 },
  { title: "회사 일이 많아서 바빴습니다", words: 18 },
  { title: "버스로 10분쯤 걸릴 거예요", words: 20 },
  { title: "점심 먹으러 갈래요?", words: 16 },
  { title: "저녁 먹은 후에 조깅을 해요", words: 19 },
  { title: "푹 쉬어서 괜찮아졌어요", words: 17 },
  { title: "일곱 시로 예약해 주세요", words: 21 },
].map((l, i) => ({
  id: `fallback-lesson-${i + 1}`,
  textbookId: FALLBACK_TEXTBOOK_ID,
  no: i + 1,
  title: l.title,
  words: l.words,
  // mock: đang học Bài 1, các bài sau chưa mở khóa
  status: i === 0 ? "current" : "locked",
}));

/* ------------------------------------------------------------------ */
/*  TỪ VỰNG — dữ liệu mẫu chủ đề Quà tặng                               */
/*  Trong ví dụ, từ mục tiêu được bọc trong ** ** để tô màu tím        */
/* ------------------------------------------------------------------ */
export const VOCAB_SAMPLE = [
  {
    word: "꽃다발", type: "명사", pron: "[꼳따발]",
    mnemonic: "「꽃(hoa) + 다발(bó)」 = bó hoa",
    img: new URL('../assets/fallback/sample-01.jpg', import.meta.url).href,
    meaning: "꽃을 모아서 만든 선물.", meaningVi: "💐 Bó hoa, lẵng hoa",
    note: "생일, 졸업식, 기념일, 결혼식 등에 자주 선물해요.",
    noteVi: "Thường tặng trong các dịp sinh nhật, tốt nghiệp, lễ kỷ niệm, đám cưới.",
    collocations: [
      { ko: "꽃다발을 주다 / 받다", vi: "tặng / nhận bó hoa" },
      { ko: "꽃다발을 만들다", vi: "bó (làm) một bó hoa" },
      { ko: "예쁜 꽃다발", vi: "bó hoa đẹp" },
    ],
    dialogue: [
      { spk: "A", ko: "이번 주말이 민호 씨 생일인데 무슨 선물이 좋을까요?", vi: "Cuối tuần này là sinh nhật Minho, tặng quà gì thì tốt nhỉ?" },
      { spk: "B", ko: "**꽃다발**이나 케이크는 어때요?", vi: "Bó hoa hoặc bánh kem thì sao?" },
      { spk: "A", ko: "좋아요. 예쁜 **꽃다발**을 삽시다.", vi: "Hay đấy. Mình mua một bó hoa thật đẹp đi." },
    ],
  },
  {
    word: "만년필", type: "명사", pron: "[만년필]",
    mnemonic: "「만년(muôn đời) + 필(bút)」 = bút viết được rất lâu → bút máy",
    img: new URL('../assets/fallback/sample-02.jpg', import.meta.url).href,
    meaning: "잉크를 넣어 사용하는 펜.", meaningVi: "🖋️ Bút máy",
    note: "입학이나 졸업 선물, 기념품으로 자주 선물해요.",
    noteVi: "Thường được tặng trong dịp nhập học, tốt nghiệp hoặc làm quà lưu niệm.",
    collocations: [
      { ko: "만년필로 쓰다", vi: "viết bằng bút máy" },
      { ko: "만년필을 선물하다", vi: "tặng bút máy" },
      { ko: "만년필에 잉크를 넣다", vi: "bơm mực vào bút máy" },
    ],
    dialogue: [
      { spk: "A", ko: "동생 입학 선물로 **만년필**은 어때요?", vi: "Tặng bút máy làm quà nhập học cho em thì sao?" },
      { spk: "B", ko: "좋은 생각이에요. 오래 쓸 수 있잖아요.", vi: "Ý hay đấy. Dùng được lâu mà." },
      { spk: "A", ko: "맞아요. 백화점 문구점에서 삽시다.", vi: "Đúng vậy. Mình mua ở tiệm văn phòng phẩm trong TTTM đi." },
    ],
  },
  {
    word: "목도리", type: "명사", pron: "[목또리]",
    mnemonic: "「목(cổ) + 도리(vật quấn quanh)」 = khăn quấn quanh cổ",
    img: new URL('../assets/fallback/sample-03.jpg', import.meta.url).href,
    meaning: "목에 두르는 따뜻한 옷.", meaningVi: "🧣 Khăn quàng cổ",
    note: "겨울이나 크리스마스 선물로 자주 줘요.",
    noteVi: "Thường là quà tặng vào mùa đông hoặc Giáng sinh.",
    collocations: [
      { ko: "목도리를 하다 / 두르다", vi: "quàng khăn" },
      { ko: "목도리를 풀다", vi: "tháo khăn" },
      { ko: "따뜻한 목도리", vi: "khăn quàng ấm áp" },
    ],
    dialogue: [
      { spk: "A", ko: "요즘 날씨가 정말 춥지요? 어머니께 **목도리**를 선물했어요.", vi: "Dạo này trời lạnh thật nhỉ? Tôi đã tặng mẹ một chiếc khăn quàng cổ." },
      { spk: "B", ko: "와, 어머니가 좋아하셨어요?", vi: "Oa, mẹ bạn có thích không?" },
      { spk: "A", ko: "네, 아주 따뜻해서 좋아하셨어요.", vi: "Có, khăn rất ấm nên mẹ thích lắm." },
    ],
  },
  {
    word: "상품권", type: "명사", pron: "[상품꿘]",
    mnemonic: "「상품(hàng hóa) + 권(phiếu/quyền)」 = phiếu đổi lấy hàng hóa",
    img: new URL('../assets/fallback/sample-04.jpg', import.meta.url).href,
    meaning: "물건이나 서비스를 살 수 있는 이용권.", meaningVi: "🎁 Phiếu mua hàng, thẻ quà tặng",
    note: "가게나 백화점에서 물건을 살 때 쓸 수 있어요. 교재에서 (*) 표시는 중요한 단어예요.",
    noteVi: "Dùng để mua hàng tại cửa hàng hoặc TTTM. Dấu (*) trong giáo trình chỉ từ vựng quan trọng.",
    collocations: [
      { ko: "상품권을 사용하다", vi: "sử dụng phiếu mua hàng" },
      { ko: "상품권으로 사다", vi: "mua bằng phiếu mua hàng" },
      { ko: "백화점 상품권", vi: "phiếu mua hàng của TTTM" },
    ],
    dialogue: [
      { spk: "A", ko: "친구 생일 선물로 **상품권**은 어때요?", vi: "Tặng phiếu mua hàng làm quà sinh nhật bạn thì sao?" },
      { spk: "B", ko: "**상품권**으로 뭘 살 수 있어요?", vi: "Phiếu mua hàng thì mua được những gì?" },
      { spk: "A", ko: "백화점에서 원하는 물건을 살 수 있어요.", vi: "Có thể mua món đồ mình muốn ở trung tâm thương mại." },
    ],
  },
  {
    word: "향수", type: "명사", pron: "[향수]",
    mnemonic: "「향(hương thơm) + 수(nước)」 = nước có hương thơm → nước hoa",
    img: new URL('../assets/fallback/sample-05.jpg', import.meta.url).href,
    meaning: "몸이나 옷에 뿌려 좋은 냄새가 나게 하는 것.", meaningVi: "🌸 Nước hoa",
    note: "생일이나 기념일에 인기 있는 선물이에요. '향기'(mùi hương)와 혼동하지 마세요.",
    noteVi: "Món quà phổ biến dịp sinh nhật, ngày lễ, kỷ niệm. Không nhầm với 향기 (mùi hương).",
    collocations: [
      { ko: "향수를 뿌리다", vi: "xịt nước hoa" },
      { ko: "향수 냄새가 나다", vi: "có mùi nước hoa" },
      { ko: "향수를 선물하다", vi: "tặng nước hoa" },
    ],
    dialogue: [
      { spk: "A", ko: "어머니 생신 선물로 **향수**를 샀어요.", vi: "Tôi mua nước hoa làm quà sinh nhật mẹ." },
      { spk: "B", ko: "와, 냄새 좀 맡아 봐도 돼요?", vi: "Oa, tôi ngửi thử được không?" },
      { spk: "A", ko: "네, 여기요. 향기가 정말 좋죠?", vi: "Được chứ, đây này. Mùi thơm thật đấy nhỉ?" },
    ],
  },
  /* --- Từ vựng mới (tầng gọn: nghĩa + 1 ví dụ, chưa có cụm từ/hội thoại/mẹo nhớ riêng) --- */
  {
    word: "상을 받다", type: "동사", pron: "[상을 받따]", tier: "light",
    img: new URL('../assets/fallback/sample-06.jpg', import.meta.url).href,
    meaningVi: "Nhận thưởng, được thưởng",
    mnemonic: "「상(giải thưởng) + 을 받다(nhận)」= nhận được giải thưởng.",
    collocations: [
      { ko: "1등상을 받다", vi: "Nhận giải nhất" },
      { ko: "장학금을 받다", vi: "Nhận học bổng" },
    ],
    dialogue: [
      { spk: "A", ko: "어제 대회 결과 들었어요?", vi: "Hôm qua bạn nghe kết quả cuộc thi chưa?" },
      { spk: "B", ko: "네! 제가 이번 대회에서 **상을 받았어요**.", vi: "Rồi! Tôi đã nhận được giải thưởng ở cuộc thi lần này." },
      { spk: "A", ko: "정말 축하해요! 대단하네요.", vi: "Chúc mừng bạn nhé! Giỏi quá." },
    ],
  },
  {
    word: "취직하다", type: "동사", pron: "[취지카다]", tier: "light",
    img: new URL('../assets/fallback/sample-07.jpg', import.meta.url).href,
    meaningVi: "Tìm việc làm",
    mnemonic: "「취직(tựu chức) + 하다」= vào làm, có việc — Hán Việt gần giống 'tựu chức'.",
    collocations: [
      { ko: "회사에 취직하다", vi: "Có việc làm ở công ty" },
      { ko: "취직 준비를 하다", vi: "Chuẩn bị xin việc" },
    ],
    dialogue: [
      { spk: "A", ko: "요즘 어떻게 지내요?", vi: "Dạo này bạn sống thế nào?" },
      { spk: "B", ko: "저 지난달에 좋은 회사에 **취직했어요**.", vi: "Tháng trước tôi đã tìm được việc ở một công ty tốt." },
      { spk: "A", ko: "우와, 축하해요! 무슨 일을 해요?", vi: "Ồ, chúc mừng bạn! Bạn làm công việc gì?" },
      { spk: "B", ko: "마케팅 팀에서 일해요.", vi: "Tôi làm ở phòng marketing." },
    ],
  },
  {
    word: "결혼하다", type: "동사", pron: "[결혼하다]", tier: "light",
    img: new URL('../assets/fallback/sample-08.jpg', import.meta.url).href,
    meaningVi: "Kết hôn",
    mnemonic: "「결혼(kết hôn)」— trùng luôn âm Hán Việt, dễ nhớ nhất trong bài!",
    collocations: [
      { ko: "결혼식을 하다", vi: "Tổ chức đám cưới" },
      { ko: "국제결혼", vi: "Kết hôn quốc tế" },
    ],
    dialogue: [
      { spk: "A", ko: "다음 달에 저 **결혼해요**.", vi: "Tháng sau tôi kết hôn đấy." },
      { spk: "B", ko: "정말요? 축하해요!", vi: "Thật à? Chúc mừng bạn!" },
      { spk: "A", ko: "고마워요. 꼭 와 주세요.", vi: "Cảm ơn bạn. Nhất định phải đến nhé." },
    ],
  },
  {
    word: "시험에 합격하다", type: "동사", pron: "[시험에 합껴카다]", tier: "light",
    img: new URL('../assets/fallback/sample-09.jpg', import.meta.url).href,
    meaningVi: "Thi đậu",
    mnemonic: "「합격(hợp cách) + 하다」= đúng cách, đạt chuẩn → thi đậu.",
    collocations: [
      { ko: "시험에 떨어지다", vi: "Thi rớt (trái nghĩa)" },
      { ko: "최종 합격", vi: "Đậu chính thức (vòng cuối)" },
    ],
    dialogue: [
      { spk: "A", ko: "한국어 시험 결과 나왔어요?", vi: "Kết quả thi tiếng Hàn ra chưa?" },
      { spk: "B", ko: "네, 드디어 **시험에 합격했어요**!", vi: "Rồi, cuối cùng tôi đã thi đậu!" },
      { spk: "A", ko: "정말 잘했어요! 축하해요.", vi: "Giỏi quá! Chúc mừng bạn." },
    ],
  },
  {
    word: "축하 메시지를 보내다", type: "동사", pron: "[축하 메시지를 보내다]", tier: "light",
    img: new URL('../assets/fallback/sample-10.jpg', import.meta.url).href,
    meaningVi: "Gửi tin nhắn chúc mừng",
    mnemonic: "「축하(chúc hạ=chúc mừng) + 메시지 + 보내다(gửi)」.",
    collocations: [
      { ko: "문자를 보내다", vi: "Gửi tin nhắn" },
      { ko: "축하 이메일을 보내다", vi: "Gửi email chúc mừng" },
    ],
    dialogue: [
      { spk: "A", ko: "민수 씨가 취직했대요.", vi: "Nghe nói anh Minsu đã tìm được việc rồi." },
      { spk: "B", ko: "저도 들었어요. 방금 **축하 메시지를 보냈어요**.", vi: "Tôi cũng nghe rồi. Tôi vừa gửi tin nhắn chúc mừng." },
      { spk: "A", ko: "저도 보내야겠어요.", vi: "Tôi cũng nên gửi mới được." },
    ],
  },
  {
    word: "기념사진을 찍다", type: "동사", pron: "[기념사지늘 찍따]", tier: "light",
    img: new URL('../assets/fallback/sample-11.jpg', import.meta.url).href,
    meaningVi: "Chụp ảnh kỷ niệm",
    mnemonic: "「기념(kỷ niệm) + 사진(ảnh) + 찍다(chụp)」.",
    collocations: [
      { ko: "사진을 찍다", vi: "Chụp ảnh" },
      { ko: "단체 사진", vi: "Ảnh tập thể" },
    ],
    dialogue: [
      { spk: "A", ko: "졸업식에서 사진 찍었어요?", vi: "Bạn có chụp ảnh ở lễ tốt nghiệp không?" },
      { spk: "B", ko: "네, 친구들이랑 **기념사진을 찍었어요**.", vi: "Có, tôi đã chụp ảnh kỷ niệm với bạn bè." },
      { spk: "A", ko: "저도 한 장 보여 주세요.", vi: "Cho tôi xem một tấm với." },
    ],
  },
  {
    word: "축하 파티를 하다", type: "동사", pron: "[추카 파티를 하다]", tier: "light",
    img: new URL('../assets/fallback/sample-12.jpg', import.meta.url).href,
    meaningVi: "Tổ chức một buổi ăn mừng",
    mnemonic: "「축하 + 파티(party) + 하다」— mượn từ tiếng Anh nên rất dễ nhớ.",
    collocations: [
      { ko: "생일 파티", vi: "Tiệc sinh nhật" },
      { ko: "파티를 열다", vi: "Mở tiệc" },
    ],
    dialogue: [
      { spk: "A", ko: "이번 주말에 시간 있어요?", vi: "Cuối tuần này bạn có rảnh không?" },
      { spk: "B", ko: "네, 왜요?", vi: "Có, sao vậy?" },
      { spk: "A", ko: "승진 **축하 파티를 할** 거예요. 같이 가요.", vi: "Sẽ có tiệc mừng thăng chức. Cùng đi nhé." },
    ],
  },
  {
    word: "축하 카드를 쓰다", type: "동사", pron: "[추카 카드를 쓰다]", tier: "light",
    img: new URL('../assets/fallback/sample-13.jpg', import.meta.url).href,
    meaningVi: "Viết một tấm thiệp chúc mừng",
    mnemonic: "「축하 + 카드(card) + 쓰다(viết)」.",
    collocations: [
      { ko: "감사 카드", vi: "Thiệp cảm ơn" },
      { ko: "카드를 보내다", vi: "Gửi thiệp" },
    ],
    dialogue: [
      { spk: "A", ko: "뭐 하고 있어요?", vi: "Bạn đang làm gì vậy?" },
      { spk: "B", ko: "친구 결혼식 때문에 **축하 카드를 쓰고** 있어요.", vi: "Tôi đang viết thiệp chúc mừng vì đám cưới bạn tôi." },
      { spk: "A", ko: "저도 하나 써야겠네요.", vi: "Tôi cũng nên viết một tấm." },
    ],
  },
  {
    word: "축의금을 전달하다", type: "동사", pron: "[추기금을 전달하다]", tier: "light",
    img: new URL('../assets/fallback/sample-14.jpg', import.meta.url).href,
    meaningVi: "Đưa tiền mừng",
    mnemonic: "「축의금(chúc nghi kim=tiền mừng cưới) + 전달하다(chuyển giao)」.",
    collocations: [
      { ko: "봉투에 넣다", vi: "Bỏ vào phong bì" },
      { ko: "축의금을 내다", vi: "Đưa tiền mừng" },
    ],
    dialogue: [
      { spk: "A", ko: "결혼식장에서 뭐 했어요?", vi: "Bạn đã làm gì ở sảnh cưới?" },
      { spk: "B", ko: "신랑한테 **축의금을 전달했어요**.", vi: "Tôi đã đưa tiền mừng cho chú rể." },
      { spk: "A", ko: "저도 아직 안 냈는데 지금 내야겠어요.", vi: "Tôi vẫn chưa đưa, chắc phải đưa ngay bây giờ." },
    ],
  },
  {
    word: "축하 인사를 하다", type: "동사", pron: "[추카 인사를 하다]", tier: "light",
    img: new URL('../assets/fallback/sample-15.jpg', import.meta.url).href,
    meaningVi: "Chào hỏi chúc mừng, gửi lời chúc mừng",
    mnemonic: "「축하 + 인사(nhân sự=chào hỏi) + 하다」.",
    collocations: [
      { ko: "인사를 나누다", vi: "Chào hỏi nhau" },
      { ko: "새해 인사", vi: "Lời chúc năm mới" },
    ],
    dialogue: [
      { spk: "A", ko: "수진 씨 봤어요?", vi: "Bạn gặp Sujin chưa?" },
      { spk: "B", ko: "네, 방금 만나서 **축하 인사를 했어요**.", vi: "Rồi, tôi vừa gặp và gửi lời chúc mừng." },
      { spk: "A", ko: "무슨 일 있어요?", vi: "Có chuyện gì vậy?" },
      { spk: "B", ko: "승진했대요!", vi: "Nghe nói bạn ấy được thăng chức!" },
    ],
  },
  {
    word: "선물을 주다", type: "동사", pron: "[선무를 주다]", tier: "light",
    img: new URL('../assets/fallback/sample-16.jpg', import.meta.url).href,
    meaningVi: "Tặng quà",
    mnemonic: "「선물(tiên vật=quà) + 주다(cho)」.",
    collocations: [
      { ko: "선물을 받다", vi: "Nhận quà (trái nghĩa)" },
      { ko: "생일 선물", vi: "Quà sinh nhật" },
    ],
    dialogue: [
      { spk: "A", ko: "생일 선물 준비했어요?", vi: "Bạn chuẩn bị quà sinh nhật chưa?" },
      { spk: "B", ko: "네, 동생한테 예쁜 목도리를 **선물로 줬어요**.", vi: "Rồi, tôi đã tặng em một chiếc khăn quàng cổ đẹp." },
      { spk: "A", ko: "동생이 좋아했겠네요.", vi: "Chắc em bạn thích lắm." },
    ],
  },
  {
    word: "초대하다", type: "동사", pron: "[초대하다]", tier: "light",
    img: new URL('../assets/fallback/sample-17.jpg', import.meta.url).href,
    meaningVi: "Mời",
    mnemonic: "「초대(초청+đợi)」= mời người khác đến.",
    collocations: [
      { ko: "파티에 초대하다", vi: "Mời đến tiệc" },
      { ko: "초대장", vi: "Thiệp mời" },
    ],
    dialogue: [
      { spk: "A", ko: "이번 주말에 뭐 해요?", vi: "Cuối tuần này bạn làm gì?" },
      { spk: "B", ko: "친구가 집들이에 저를 **초대했어요**.", vi: "Bạn tôi đã mời tôi đến tân gia." },
      { spk: "A", ko: "좋겠네요!", vi: "Vui đấy nhỉ!" },
    ],
  },
  {
    word: "초대받다", type: "동사", pron: "[초대받따]", tier: "light",
    img: new URL('../assets/fallback/sample-18.jpg', import.meta.url).href,
    meaningVi: "Nhận được lời mời",
    mnemonic: "「초대 + 받다(nhận)」= nhận được lời mời — ngược vai với 초대하다.",
    collocations: [
      { ko: "초대를 거절하다", vi: "Từ chối lời mời" },
      { ko: "결혼식에 초대받다", vi: "Được mời đám cưới" },
    ],
    dialogue: [
      { spk: "A", ko: "이번 주말 결혼식에 가요?", vi: "Cuối tuần này bạn đi đám cưới không?" },
      { spk: "B", ko: "네, **초대받았어요**. 같이 갈래요?", vi: "Có, tôi được mời rồi. Đi cùng không?" },
      { spk: "A", ko: "저도 초대받았어요! 같이 가요.", vi: "Tôi cũng được mời! Đi cùng nhau đi." },
    ],
  },
  {
    word: "졸업식", type: "명사", pron: "[조럽씩]", tier: "light",
    img: new URL('../assets/fallback/sample-19.jpg', import.meta.url).href,
    meaningVi: "Lễ tốt nghiệp",
    mnemonic: "「졸업(tốt nghiệp) + 식(thức=lễ)」.",
    collocations: [
      { ko: "졸업하다", vi: "Tốt nghiệp (động từ)" },
      { ko: "입학식", vi: "Lễ nhập học (trái nghĩa)" },
    ],
    dialogue: [
      { spk: "A", ko: "다음 달 일정 있어요?", vi: "Tháng sau bạn có lịch gì không?" },
      { spk: "B", ko: "네, 15일에 **졸업식**이 있어요.", vi: "Có, ngày 15 có lễ tốt nghiệp." },
      { spk: "A", ko: "축하해요! 꼭 갈게요.", vi: "Chúc mừng bạn! Tôi nhất định sẽ đến." },
    ],
  },
  {
    word: "덮개", type: "명사", pron: "[덥깨]", tier: "light",
    img: new URL('../assets/fallback/sample-20.jpg', import.meta.url).href,
    meaningVi: "Tấm che, cái nắp",
    mnemonic: "「덮다(che, đậy) + 개」= vật dùng để che/đậy.",
    collocations: [
      { ko: "냄비 덮개", vi: "Nắp nồi" },
      { ko: "렌즈 덮개", vi: "Nắp ống kính" },
    ],
    dialogue: [
      { spk: "A", ko: "냄비 **덮개**가 어디 있어요?", vi: "Cái nắp nồi ở đâu vậy?" },
      { spk: "B", ko: "싱크대 위에 있어요.", vi: "Ở trên bồn rửa đấy." },
      { spk: "A", ko: "아, 찾았어요. 고마워요.", vi: "À, tìm thấy rồi. Cảm ơn nhé." },
    ],
  },
  {
    word: "쉽다", type: "형용사", pron: "[쉽따]", tier: "light",
    img: new URL('../assets/fallback/sample-21.jpg', import.meta.url).href,
    meaningVi: "Dễ dàng",
    mnemonic: "Liên tưởng âm 쉽 gần giống 'síp' trong 'dễ ợt, một cái síp là xong'.",
    collocations: [
      { ko: "어렵다", vi: "Khó (trái nghĩa)" },
      { ko: "쉬운 문제", vi: "Câu hỏi dễ" },
    ],
    dialogue: [
      { spk: "A", ko: "한국어 시험 어땠어요?", vi: "Bài thi tiếng Hàn thế nào?" },
      { spk: "B", ko: "생각보다 **쉬웠어요**.", vi: "Dễ hơn tôi nghĩ." },
      { spk: "A", ko: "다행이네요!", vi: "May quá!" },
    ],
  },
  {
    word: "갚다", type: "동사", pron: "[갑따]", tier: "light",
    img: new URL('../assets/fallback/sample-22.jpg', import.meta.url).href,
    meaningVi: "Trả lại, hoàn lại",
    mnemonic: "Liên tưởng âm 갚다 gần 'gặp' — gặp lại người để trả nợ.",
    collocations: [
      { ko: "빚을 갚다", vi: "Trả nợ" },
      { ko: "은혜를 갚다", vi: "Trả ơn" },
    ],
    dialogue: [
      { spk: "A", ko: "지난번에 빌린 돈 있잖아요.", vi: "Có khoản tiền lần trước bạn mượn đó." },
      { spk: "B", ko: "아, 맞다. 다음 주에 **갚을게요**.", vi: "À, đúng rồi. Tuần sau tôi sẽ trả lại." },
      { spk: "A", ko: "네, 천천히 주셔도 돼요.", vi: "Được, bạn cứ từ từ trả cũng được." },
    ],
  },
  {
    word: "탑승", type: "명사", pron: "[탑씅]", tier: "light",
    img: new URL('../assets/fallback/sample-23.jpg', import.meta.url).href,
    meaningVi: "Sự đi, sự lên (tàu xe, máy bay)",
    mnemonic: "「탑승(đáp thừa)」= lên (tàu xe, máy bay).",
    collocations: [
      { ko: "탑승구", vi: "Cổng lên máy bay" },
      { ko: "탑승권", vi: "Vé/thẻ lên máy bay" },
    ],
    dialogue: [
      { spk: "A", ko: "지금 몇 번 게이트예요?", vi: "Bây giờ là cổng số mấy vậy?" },
      { spk: "B", ko: "3번 게이트예요. 곧 **탑승**을 시작한대요.", vi: "Cổng số 3. Nghe nói sắp bắt đầu lên máy bay rồi." },
      { spk: "A", ko: "그럼 빨리 가요.", vi: "Vậy thì đi nhanh thôi." },
    ],
  },
  {
    word: "앞집", type: "명사", pron: "[압찝]", tier: "light",
    img: new URL('../assets/fallback/sample-24.jpg', import.meta.url).href,
    meaningVi: "Nhà đối diện, nhà ở phía trước",
    mnemonic: "「앞(trước) + 집(nhà)」= nhà ở phía trước.",
    collocations: [
      { ko: "뒷집", vi: "Nhà phía sau (trái nghĩa)" },
      { ko: "앞마당", vi: "Sân trước" },
    ],
    dialogue: [
      { spk: "A", ko: "**앞집**에 누가 이사 왔어요?", vi: "Ai chuyển đến nhà đối diện vậy?" },
      { spk: "B", ko: "네, 젊은 부부가 이사 왔대요.", vi: "Nghe nói một cặp vợ chồng trẻ mới chuyển đến." },
      { spk: "A", ko: "인사하러 가야겠네요.", vi: "Chắc phải qua chào hỏi thôi." },
    ],
  },
  {
    word: "춥다", type: "형용사", pron: "[춥따]", tier: "light",
    img: new URL('../assets/fallback/sample-25.jpg', import.meta.url).href,
    meaningVi: "Lạnh",
    mnemonic: "Liên tưởng cảm giác rùng mình khi đọc 'chuwp-tta' — lạnh run.",
    collocations: [
      { ko: "덥다", vi: "Nóng (trái nghĩa)" },
      { ko: "겨울이 춥다", vi: "Mùa đông lạnh" },
    ],
    dialogue: [
      { spk: "A", ko: "밖에 날씨 어때요?", vi: "Ngoài trời thời tiết thế nào?" },
      { spk: "B", ko: "오늘 정말 **추워요**. 옷 따뜻하게 입으세요.", vi: "Hôm nay lạnh thật đấy. Bạn mặc ấm vào nhé." },
      { spk: "A", ko: "네, 목도리도 하고 나갈게요.", vi: "Vâng, tôi sẽ quàng khăn rồi ra ngoài." },
    ],
  },
  {
    word: "입술", type: "명사", pron: "[입쑬]", tier: "light",
    img: new URL('../assets/fallback/sample-26.jpg', import.meta.url).href,
    meaningVi: "Môi",
    mnemonic: "「입(miệng) + 술」— hình dung viền quanh miệng chính là môi.",
    collocations: [
      { ko: "입술이 트다", vi: "Môi bị nứt/khô" },
      { ko: "입술을 바르다", vi: "Thoa/tô môi" },
    ],
    dialogue: [
      { spk: "A", ko: "얼굴이 왜 그래요?", vi: "Mặt bạn sao vậy?" },
      { spk: "B", ko: "날씨가 건조해서 **입술**이 텄어요.", vi: "Vì thời tiết khô nên môi tôi bị nứt." },
      { spk: "A", ko: "립밤 발라 보세요.", vi: "Bạn thử thoa son dưỡng môi xem." },
    ],
  },
  {
    word: "옆집", type: "명사", pron: "[엽찝]", tier: "light",
    img: new URL('../assets/fallback/sample-27.jpg', import.meta.url).href,
    meaningVi: "Nhà bên, nhà hàng xóm",
    mnemonic: "「옆(bên cạnh) + 집(nhà)」= nhà bên, hàng xóm liền kề.",
    collocations: [
      { ko: "옆집 아주머니", vi: "Cô hàng xóm nhà bên" },
      { ko: "옆방", vi: "Phòng bên cạnh" },
    ],
    dialogue: [
      { spk: "A", ko: "이 떡 어디서 났어요?", vi: "Bánh gạo này ở đâu ra vậy?" },
      { spk: "B", ko: "**옆집**에서 주셨어요.", vi: "Nhà bên cạnh cho tôi đấy." },
      { spk: "A", ko: "좋은 이웃이네요.", vi: "Hàng xóm tốt bụng thật." },
    ],
  },
  {
    word: "엎드리다", type: "동사", pron: "[업뜨리다]", tier: "light",
    img: new URL('../assets/fallback/sample-28.png', import.meta.url).href,
    meaningVi: "Nằm sấp, sấp xuống sàn",
    mnemonic: "Liên tưởng '엎' gần âm 'úp' — úp người xuống = nằm sấp.",
    collocations: [
      { ko: "엎드려 자다", vi: "Nằm sấp ngủ" },
      { ko: "바닥에 엎드리다", vi: "Nằm sấp xuống sàn" },
    ],
    dialogue: [
      { spk: "A", ko: "지훈이 어디 있어요?", vi: "Jihoon ở đâu vậy?" },
      { spk: "B", ko: "침대에 **엎드려서** 책 읽고 있어요.", vi: "Đang nằm sấp trên giường đọc sách." },
      { spk: "A", ko: "정말 편해 보이네요.", vi: "Trông thoải mái thật đấy." },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  NGỮ PHÁP — dữ liệu mẫu của bài học hiện tại                          */
/*  đúng theo ảnh mẫu: bối cảnh, tạm dịch, công thức, ví dụ, lưu ý)      */
/* ------------------------------------------------------------------ */
export const GRAMMAR_SAMPLE = [
  {
    no: 1, pattern: "(이)나 / -거나", color: "#7C6FE4",
    img: new URL('../assets/fallback/sample-29.jpg', import.meta.url).href,
    context: "Dùng khi muốn nói có nhiều lựa chọn, chọn một trong số đó.",
    translation: "Hoặc, hay là.",
    formula: [
      { subject: "Danh từ", condition: "Có phụ âm cuối (có patchim)", form: "이나" },
      { subject: "Danh từ", condition: "Không có phụ âm cuối (không patchim)", form: "나" },
      { subject: "Động từ / Tính từ", condition: "Bất kể có phụ âm cuối hay không", form: "-거나" },
    ],
    examples: [
      { ko: "꽃다발**이나** 케이크는 어때요?", vi: "Bó hoa hay bánh kem thì thế nào?" },
      { ko: "주말에 음악을 듣**거나** 영화를 봐요.", vi: "Cuối tuần tôi nghe nhạc hoặc xem phim." },
    ],
    notes: [
      "Lược bỏ tiểu từ (이/가, 을/를) khi dùng (이)나.",
      "Khi có tiểu từ chỉ nơi chốn/thời gian (에, 에서...), (이)나 đứng ngay sau các tiểu từ đó. (VD: 도서관에서나)",
    ],
    tip: null,
  },
  {
    no: 2, pattern: "-아서 / -어서 / -여서 (2)", color: "#E5566B",
    img: new URL('../assets/fallback/sample-30.jpg', import.meta.url).href,
    context: "Gắn vào sau động từ để nói theo thứ tự những sự việc có liên quan đến nhau.",
    translation: "...Rồi..., Và...",
    formula: [
      { subject: "", condition: "Động từ có nguyên âm cuối là ㅏ, ㅗ", form: "-아서" },
      { subject: "", condition: "Động từ có các nguyên âm khác ngoài ㅏ, ㅗ", form: "-어서" },
      { subject: "", condition: "Động từ kết thúc bằng 하다", form: "-여서 → 해서" },
    ],
    examples: [
      { ko: "사과를 **사서** 먹어요.", vi: "Tôi mua táo rồi ăn." },
      { ko: "도서관에 **가서** 책을 읽어요.", vi: "Tôi đến thư viện rồi đọc sách." },
    ],
    notes: [
      "Không chia thì (trước 'ㅏ' không dùng 았/었, 겠).",
      "Chủ ngữ hai vế phải là cùng một người/vật.",
      "Hành động trước tạo bối cảnh/phương tiện cho hành động sau.",
    ],
    tip: { rule: "Chia động từ về dạng ~아/어/여 → bỏ 'ㅇ' → thêm 'ㅓ'.", example: "요리하다 → 요리해요 → 요리해서" },
  },
];

/* ------------------------------------------------------------------ */
/*  ĐỌC TIẾNG HÀN DIỄN CẢM (Web Speech API)                            */
/*  - Nhân vật A: giọng cao, nhanh vừa | Nhân vật B: giọng trầm hơn    */
/*  - Câu hỏi (?) tự động lên giọng; câu cảm (!) đọc nhấn hơn          */
/*  - "Nghe cả đoạn": đọc lần lượt từng lượt thoại, ngắt nghỉ tự nhiên */
/* ------------------------------------------------------------------ */


export const SHADOW_LINES = [
  {
    no: 1, spk: "A",
    ko: "다니엘 씨, 이번 주 토요일이 안나 씨 생일이에요.",
    vi: "Anh Daniel ơi, thứ Bảy tuần này là sinh nhật chị Anna.",
    rhythmBreak: "다니엘 씨, / 이번 주 토요일이 / 안나 씨 생일이에요.",
    realPron: "[다니엘 씨, 이번 주 토요이리 안나 씨 생이리에요]",
    tips: [
      "**토요일이** phải đọc nối chữ 'ㄹ' lên thành [토요이리] (to-yo-i-ri).",
      "**생일이에요** nối âm 'ㄹ' lên thành [생이리에요] (saeng-i-ri-e-yo). Hãy lẩm nhẩm cụm này nhiều lần để quen miệng.",
    ],
    audio: new URL('../assets/fallback/sample-31.mp3', import.meta.url).href,
  },
  {
    no: 2, spk: "A",
    ko: "무슨 선물을 할까요?",
    vi: "Nên tặng quà gì nhỉ?",
    rhythmBreak: "무슨 / 선물을 할까요?",
    realPron: "[무슨 선무를 할까요?]",
    tips: [
      "**선물을** nối âm thành [선무를] (seon-mu-reul).",
      "Lên giọng ở cuối câu **할까요?** vì đây là câu hỏi đề xuất.",
    ],
    audio: new URL('../assets/fallback/sample-32.mp3', import.meta.url).href,
  },
  {
    no: 3, spk: "B",
    ko: "향수나 지갑은 어때요?",
    vi: "Nước hoa hoặc ví thì sao?",
    rhythmBreak: "향수나 / 지갑은 어때요?",
    realPron: "[향수나 지가븐 어때요?]",
    tips: [
      "**지갑은** chữ 'ㅂ' (b) phải nối lên chữ '은' thành [지가븐] (ji-ga-beun).",
    ],
    audio: new URL('../assets/fallback/sample-33.mp3', import.meta.url).href,
  },
  {
    no: 4, spk: "B",
    ko: "안나 씨는 향수를 좋아해요.",
    vi: "Chị Anna thích nước hoa lắm.",
    rhythmBreak: "안나 씨는 / 향수를 좋아해요.",
    realPron: "[안나 씨는 향수를 조아해요]",
    tips: [
      "**좋아해요** có âm 'ㅎ' (h) nằm dưới, khi gặp nguyên âm '아' phía sau, âm 'ㅎ' sẽ bị câm. Bạn đọc thành [조아해요] (jo-a-hae-yo) thay vì 'jot-a-hae-yo'.",
    ],
    audio: new URL('../assets/fallback/sample-34.mp3', import.meta.url).href,
  },
  {
    no: 5, spk: "A",
    ko: "그럼, 향수가 좋겠네요.",
    vi: "Vậy thì nước hoa được đấy.",
    rhythmBreak: "그럼, / 향수가 좋겠네요.",
    realPron: "[그럼, 향수가 조켄네요]",
    tips: [
      "Đây là câu khó nhất trong bài cần tập trung.",
      "**좋겠네요**: Âm 'ㅎ' gặp 'ㄱ' thành âm bật hơi 'ㅋ' (조켇). Sau đó 'ㄷ' gặp 'ㄴ' biến thành 'ㄴ' (Đồng hóa mũi). Kết quả cuối cùng đọc là [조켄네요] (jo-ken-ne-yo).",
      "Nhấn mạnh vào từ **향수가** (nước hoa) thể hiện sự chốt lại ý tưởng.",
    ],
    audio: new URL('../assets/fallback/sample-35.mp3', import.meta.url).href,
  },
  {
    no: 6, spk: "B",
    ko: "그런데 생일날 함께 뭘 하면 좋을까요?",
    vi: "Nhưng mà hôm sinh nhật nên cùng làm gì thì tốt nhỉ?",
    rhythmBreak: "그런데 / 생일날 함께 / 뭘 하면 / 좋을까요?",
    realPron: "[그런데 생일랄 함께 뭘 하면 조을까요?]",
    tips: [
      "**생일날**: Chữ 'ㄴ' (n) phía sau bị đồng hóa bởi chữ 'ㄹ' (l) phía trước, tạo thành hai chữ L. Đọc là [생일랄] (saeng-il-lal).",
      "**좋을까요**: Âm 'ㅎ' tiếp tục bị câm khi gặp nguyên âm, đọc là [조을까요] (jo-eul-kka-yo). Lên giọng ở cuối câu.",
    ],
    audio: new URL('../assets/fallback/sample-36.mp3', import.meta.url).href,
  },
];
