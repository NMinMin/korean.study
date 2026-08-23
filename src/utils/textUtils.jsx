import React from 'react';

export const renderKo = (ko) =>
  (ko || '').split('**').map((part, i) =>
    i % 2 === 1 ? <span key={i} className="hl">{part}</span> : <span key={i}>{part}</span>
  );

export const shuffleArr = (arr) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};
