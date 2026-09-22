"use client";

export function ParkingPrintButton() {
  return (
    <button
      className="btn-secondary"
      type="button"
      onClick={() => window.print()}
    >
      무료 주차권 사용대장 인쇄·PDF 저장
    </button>
  );
}
