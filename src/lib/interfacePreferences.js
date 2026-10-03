export const PREFERENCES_KEY = 'kstudy:appearance-language';
export const translations = {
  'Cài đặt': ['Settings', '설정'], 'Trang chủ': ['Home', '홈'], 'Về trang chủ': ['Back to home', '홈으로'], 'Đăng xuất': ['Sign out', '로그아웃'],
  'Giáo trình': ['Textbooks', '교재'], 'Từ vựng & Ngữ pháp': ['Vocabulary & Grammar', '어휘 및 문법'], 'Từ & Ngữ pháp': ['Words & Grammar', '어휘 및 문법'],
  'Thi thử': ['Mock exam', '모의 시험'], 'Xếp hạng': ['Leaderboard', '순위'], 'Cộng đồng': ['Community', '커뮤니티'], 'Quản trị': ['Administration', '관리'],
  'Giao diện & Ngôn ngữ': ['Appearance & Language', '화면 및 언어'], 'Tùy chỉnh trải nghiệm của bạn': ['Customize your experience', '사용 환경을 설정하세요'],
  'Giao diện': ['Appearance', '화면 모드'], 'Sáng': ['Light', '라이트'], 'Tối': ['Dark', '다크'], 'Theo hệ thống': ['System', '시스템 설정'],
  'Ngôn ngữ': ['Language', '언어'], 'Áp dụng ngay và tự lưu trên trình duyệt này': ['Applied immediately and saved in this browser', '즉시 적용되며 이 브라우저에 저장됩니다'],
  'Kế hoạch học tập': ['Study plan', '학습 계획'], 'Tạo nhịp học phù hợp với bạn': ['Build your learning routine', '학습 습관 만들기'],
  'Đặt mục tiêu và lịch học để duy trì động lực lâu dài — tất cả đều dựa trên tiến độ thật của bạn.': ['Set goals and a schedule based on your actual progress.', '실제 학습 진도에 맞춰 목표와 일정을 설정하세요.'],
  'Đang đồng bộ cài đặt…': ['Syncing settings…', '설정 동기화 중…'], 'Mục tiêu mỗi ngày': ['Daily goal', '일일 목표'],
  'Số phút học tối thiểu bạn muốn đạt mỗi ngày': ['Your minimum study time each day', '하루 최소 학습 시간'], 'phút': ['minutes', '분'],
  'Ngày mục tiêu hoàn thành': ['Target completion date', '목표 완료일'], 'Đặt hạn để hoàn thành': ['Set a deadline to finish', '완료 기한 설정'],
  'giáo trình đang học': ['your current textbook', '현재 교재'], 'Lịch học trong tuần': ['Weekly schedule', '주간 학습 일정'],
  'Chọn những ngày bạn dự định học': ['Choose your study days', '학습할 요일을 선택하세요'], 'Nhắc nhở học mỗi ngày': ['Daily study reminders', '매일 학습 알림'],
  'Gửi email vào khung giờ cố định nếu hôm nay chưa học': ['Email me at a set time if I have not studied today', '오늘 학습하지 않았다면 정해진 시간에 이메일을 보냅니다'],
  'Giờ nhắc': ['Reminder time', '알림 시간'], 'Âm thanh hiệu ứng': ['Sound effects', '효과음'],
  'Phát khi trả lời đúng/sai, đạt mục tiêu và hoàn thành bài học': ['Play for answers, goals and lesson completion', '정답, 오답, 목표 달성 및 수업 완료 시 재생'],
  'Âm lượng': ['Volume', '음량'], 'Lưu kế hoạch học tập': ['Save study plan', '학습 계획 저장'], 'Đã lưu!': ['Saved!', '저장 완료!'],
  'Hôm nay': ['Today', '오늘'], 'Xóa ngày': ['Clear date', '날짜 지우기'], 'Chọn ngày': ['Select date', '날짜 선택'],
  'Chọn ngày mục tiêu hoàn thành': ['Select target completion date', '목표 완료일 선택'], 'Tháng trước': ['Previous month', '이전 달'], 'Tháng sau': ['Next month', '다음 달'],
  'Chào buổi sáng': ['Good morning', '좋은 아침이에요'], 'Chào buổi trưa': ['Good afternoon', '안녕하세요'], 'Chào buổi chiều': ['Good afternoon', '안녕하세요'], 'Chào buổi tối': ['Good evening', '좋은 저녁이에요'],
  'T2': ['Mon', '월'], 'T3': ['Tue', '화'], 'T4': ['Wed', '수'], 'T5': ['Thu', '목'], 'T6': ['Fri', '금'], 'T7': ['Sat', '토'], 'CN': ['Sun', '일'],
  'Còn': ['Remaining', '남은 기간'], 'ngày': ['days', '일'], 'Đã trễ': ['Overdue', '기한 초과'], 'Đã hoàn thành': ['Completed', '완료'], 'giáo trình': ['textbook', '교재'],
  'Hệ thống sẽ gửi email nhắc học theo múi giờ tài khoản và vẫn hiện banner khi bạn đang mở ứng dụng.': ['Email reminders use your account time zone. Reminders also appear in the app.', '계정 시간대에 따라 이메일 알림을 보내며 앱에서도 알림을 표시합니다.'],
  'Bật/tắt nhắc nhở': ['Toggle reminders', '알림 켜기/끄기'], 'Bật/tắt âm thanh chúc mừng': ['Toggle sound effects', '효과음 켜기/끄기'], 'Âm lượng hiệu ứng': ['Sound effects volume', '효과음 음량'],
};
export function normalizePreferences(value) {
  return { theme: ['light', 'dark', 'system'].includes(value?.theme) ? value.theme : 'light', language: ['vi', 'en', 'ko'].includes(value?.language) ? value.language : 'vi' };
}
export function translate(text, language) {
  return language === 'en' ? translations[text]?.[0] || text : language === 'ko' ? translations[text]?.[1] || text : text;
}
