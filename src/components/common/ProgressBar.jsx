import React from 'react';
import { BookMarked, Mic, Headphones, MessageCircle } from 'lucide-react';

export function Bar({ pct, color, h = 8, track = '#ECEAF6' }) {
  return (
    <div style={{ height: h, background: track, borderRadius: 99, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99, transition: 'width .6s ease' }} />
    </div>
  );
}

export function ProgressIcon({ type, color, bg }) {
  const wrap = {
    width: 46, height: 46, borderRadius: 14, background: bg,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  };
  const map = {
    book: <BookMarked size={24} color={color} strokeWidth={2.2} />,
    mic: <Mic size={24} color={color} strokeWidth={2.2} />,
    head: <Headphones size={24} color={color} strokeWidth={2.2} />,
    chat: <MessageCircle size={24} color={color} strokeWidth={2.2} />,
  };
  return <div style={wrap}>{map[type]}</div>;
}
