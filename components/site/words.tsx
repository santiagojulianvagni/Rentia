import type { CSSProperties } from 'react';

// Splits a heading into words so each one can rise in with a small delay
// (`.hero.ready h1 .w`). `from` continues the count across lines.
export default function Words({ text, from = 0 }: { text: string; from?: number }) {
  // data-i18n-group: el traductor de la interfaz traduce la frase entera, no palabra por palabra.
  return <span data-i18n-group="">{text.split(' ').map((word, index) => <span key={index}>
    {index > 0 && ' '}
    <span className="w" style={{ '--i': from + index } as CSSProperties}>{word}</span>
  </span>)}</span>;
}
