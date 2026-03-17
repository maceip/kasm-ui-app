// ============================================================
// Calculator - Simple calculator app
// ============================================================

import { useState } from 'react';
import type { AppProps } from '../core/types';
import './apps.css';

export function Calculator({ windowId }: AppProps) {
  const [display, setDisplay] = useState('0');
  const [prev, setPrev] = useState<number | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [resetNext, setResetNext] = useState(false);

  const handleDigit = (d: string) => {
    if (resetNext) {
      setDisplay(d);
      setResetNext(false);
    } else {
      setDisplay(display === '0' ? d : display + d);
    }
  };

  const handleOp = (newOp: string) => {
    const current = parseFloat(display);
    if (prev !== null && op) {
      const result = calculate(prev, current, op);
      setDisplay(String(result));
      setPrev(result);
    } else {
      setPrev(current);
    }
    setOp(newOp);
    setResetNext(true);
  };

  const handleEquals = () => {
    if (prev === null || !op) return;
    const current = parseFloat(display);
    const result = calculate(prev, current, op);
    setDisplay(String(result));
    setPrev(null);
    setOp(null);
    setResetNext(true);
  };

  const handleClear = () => {
    setDisplay('0');
    setPrev(null);
    setOp(null);
    setResetNext(false);
  };

  const buttons = [
    ['C', '±', '%', '÷'],
    ['7', '8', '9', '×'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '+'],
    ['0', '.', '='],
  ];

  const handleButton = (btn: string) => {
    if (btn >= '0' && btn <= '9' || btn === '.') handleDigit(btn);
    else if (btn === 'C') handleClear();
    else if (btn === '=') handleEquals();
    else if (btn === '±') setDisplay(String(-parseFloat(display)));
    else if (btn === '%') setDisplay(String(parseFloat(display) / 100));
    else handleOp(btn);
  };

  return (
    <div className="kasm-app kasm-calculator">
      <div className="kasm-calc__display">{display}</div>
      <div className="kasm-calc__buttons">
        {buttons.map((row, ri) => (
          <div key={ri} className="kasm-calc__row">
            {row.map(btn => (
              <button
                key={btn}
                className={`kasm-calc__btn ${
                  ['÷', '×', '-', '+', '='].includes(btn) ? 'kasm-calc__btn--op' : ''
                } ${btn === '0' ? 'kasm-calc__btn--wide' : ''} ${
                  ['C', '±', '%'].includes(btn) ? 'kasm-calc__btn--func' : ''
                }`}
                onClick={() => handleButton(btn)}
              >
                {btn}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function calculate(a: number, b: number, op: string): number {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '×': return a * b;
    case '÷': return b !== 0 ? a / b : 0;
    default: return b;
  }
}
