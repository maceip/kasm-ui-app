// ============================================================
// Calculator - Simple calculator app
// ============================================================

import { createSignal, For } from 'solid-js';
import type { AppProps } from '../core/types';
import './apps.css';

export function Calculator(props: AppProps) {
  const [display, setDisplay] = createSignal('0');
  const [prev, setPrev] = createSignal<number | null>(null);
  const [op, setOp] = createSignal<string | null>(null);
  const [resetNext, setResetNext] = createSignal(false);

  const handleDigit = (d: string) => {
    if (resetNext()) {
      setDisplay(d);
      setResetNext(false);
    } else {
      setDisplay(display() === '0' ? d : display() + d);
    }
  };

  const handleOp = (newOp: string) => {
    const current = parseFloat(display());
    if (prev() !== null && op()) {
      const result = calculate(prev()!, current, op()!);
      setDisplay(String(result));
      setPrev(result);
    } else {
      setPrev(current);
    }
    setOp(newOp);
    setResetNext(true);
  };

  const handleEquals = () => {
    if (prev() === null || !op()) return;
    const current = parseFloat(display());
    const result = calculate(prev()!, current, op()!);
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
    ['C', '\u00B1', '%', '\u00F7'],
    ['7', '8', '9', '\u00D7'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '+'],
    ['0', '.', '='],
  ];

  const handleButton = (btn: string) => {
    if (btn >= '0' && btn <= '9' || btn === '.') handleDigit(btn);
    else if (btn === 'C') handleClear();
    else if (btn === '=') handleEquals();
    else if (btn === '\u00B1') setDisplay(String(-parseFloat(display())));
    else if (btn === '%') setDisplay(String(parseFloat(display()) / 100));
    else handleOp(btn);
  };

  return (
    <div class="kasm-app kasm-calculator">
      <div class="kasm-calc__display">{display()}</div>
      <div class="kasm-calc__buttons">
        <For each={buttons}>{(row) => (
          <div class="kasm-calc__row">
            <For each={row}>{(btn) => (
              <button
                class={`kasm-calc__btn ${
                  ['\u00F7', '\u00D7', '-', '+', '='].includes(btn) ? 'kasm-calc__btn--op' : ''
                } ${btn === '0' ? 'kasm-calc__btn--wide' : ''} ${
                  ['C', '\u00B1', '%'].includes(btn) ? 'kasm-calc__btn--func' : ''
                }`}
                onClick={() => handleButton(btn)}
              >
                {btn}
              </button>
            )}</For>
          </div>
        )}</For>
      </div>
    </div>
  );
}

function calculate(a: number, b: number, op: string): number {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '\u00D7': return a * b;
    case '\u00F7': return b !== 0 ? a / b : 0;
    default: return b;
  }
}
