import React from "react";

export function AlertButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="relative w-64 h-64 mx-auto">
      <div className="absolute inset-0 bg-red-600 rounded-full animate-ping opacity-75"></div>
      <div className="absolute inset-0 bg-red-600 rounded-full animate-pulse opacity-50"></div>
      <button
        onClick={onClick}
        className="relative w-full h-full rounded-full bg-red-600 hover:bg-red-700 active:bg-red-800 
          shadow-lg hover:shadow-xl transition-all transform hover:scale-105 active:scale-95
          flex items-center justify-center text-white text-4xl font-bold
          border-8 border-red-700 focus:outline-none focus:ring-4 focus:ring-red-500 focus:ring-opacity-50"
      >
        <div className="flex flex-col items-center">
          <span className="text-5xl mb-2">🚨</span>
          <span>ALERT</span>
        </div>
      </button>
    </div>
  );
}
