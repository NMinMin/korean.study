import React from 'react';
import { LoaderCircle } from 'lucide-react';

export default function QuizPreparationLoader({ message = 'AI đang tạo bộ câu hỏi...' }) {
  return (
    <div className="quiz-preparation-loader" role="status" aria-live="polite" aria-busy="true">
      <LoaderCircle className="quiz-preparation-spinner" size={36} aria-hidden="true" />
      <strong>{message}</strong>
      <span>Bài sẽ tự mở khi chuẩn bị xong.</span>
    </div>
  );
}
