'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import { useLanguage } from '@/contexts/LanguageContext';

const proposals = [
  {
    id: 1,
    src: '/assets/directhub-icon-proposal-1.svg',
    titleKey: 'p1Title',
    conceptKey: 'p1Desc',
    strengthKeys: ['p1F1', 'p1F2', 'p1F3'],
    palette: ['#0F1C2E', '#FFFFFF', '#C9A84C'],
    paletteNames: ['Navy Deep', 'Pure White', 'Industrial Gold'],
  },
  {
    id: 2,
    src: '/assets/directhub-icon-proposal-2.svg',
    titleKey: 'p2Title',
    conceptKey: 'p2Desc',
    strengthKeys: ['p2F1', 'p2F2', 'p2F3'],
    palette: ['#1A1A2E', '#2563EB', '#FFFFFF'],
    paletteNames: ['Charcoal Black', 'Electric Blue', 'Pure White'],
  },
  {
    id: 3,
    src: '/assets/directhub-icon-proposal-3.svg',
    titleKey: 'p3Title',
    conceptKey: 'p3Desc',
    strengthKeys: ['p3F1', 'p3F2', 'p3F3'],
    palette: ['#1E3A5F', '#0D1F35', '#D4A843'],
    paletteNames: ['Steel Blue', 'Deep Navy', 'Luxury Gold'],
  },
];

export default function IconProposalsPage() {
  const { t, dir, isRTL } = useLanguage();
  const ui = t.iconProposals;

  const [selected, setSelected] = useState<number | null>(null);
  const [applied, setApplied] = useState(false);

  const handleSelect = (id: number) => {
    setSelected(id);
    setApplied(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white" dir={dir}>
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">{ui.pageTitle}</h1>
            <p className="text-sm text-gray-400 mt-0.5">{ui.pageSubtitle}</p>
          </div>
          <Link href="/" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
            {ui.backHome}
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Intro */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-full px-4 py-1.5 mb-4">
            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span>
            <span className="text-yellow-400 text-sm font-medium">{ui.premiumBadge}</span>
          </div>
          <p className="text-gray-400 max-w-2xl mx-auto text-sm leading-relaxed">
            {ui.intro}
          </p>
        </div>

        {/* Proposals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {proposals.map((p) => (
            <div
              key={p.id}
              onClick={() => handleSelect(p.id)}
              className={`relative rounded-2xl border-2 cursor-pointer transition-all duration-300 overflow-hidden group ${
                selected === p.id
                  ? 'border-yellow-400 bg-gray-800 shadow-2xl shadow-yellow-400/20 scale-[1.02]'
                  : 'border-gray-700 bg-gray-900 hover:border-gray-500 hover:bg-gray-800'
              }`}
            >
              {/* Selected badge */}
              {selected === p.id && (
                <div className="absolute top-3 left-3 z-10 bg-yellow-400 text-gray-900 text-xs font-bold px-2.5 py-1 rounded-full">
                  {ui.selected}
                </div>
              )}

              {/* Icon Preview */}
              <div className="p-8 flex items-center justify-center bg-gray-950/50">
                {/* Large preview */}
                <div className="w-32 h-32 rounded-2xl overflow-hidden shadow-2xl">
                  <AppImage
                    src={p.src}
                    alt={(ui as any)[p.titleKey]}
                    width={128}
                    height={128}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                </div>
              </div>

              {/* Multi-size preview */}
              <div className="px-5 pb-4 flex items-end gap-3 justify-center">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-16 h-16 rounded-xl overflow-hidden shadow-lg">
                    <AppImage src={p.src} alt="" width={64} height={64} className="w-full h-full" unoptimized />
                  </div>
                  <span className="text-xs text-gray-500">64px</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-lg overflow-hidden shadow-md">
                    <AppImage src={p.src} alt="" width={40} height={40} className="w-full h-full" unoptimized />
                  </div>
                  <span className="text-xs text-gray-500">40px</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="w-6 h-6 rounded overflow-hidden shadow">
                    <AppImage src={p.src} alt="" width={24} height={24} className="w-full h-full" unoptimized />
                  </div>
                  <span className="text-xs text-gray-500">24px</span>
                </div>
              </div>

              {/* Info */}
              <div className="px-5 pb-5">
                <h3 className="font-bold text-white text-base mb-1">{(ui as any)[p.titleKey]}</h3>
                <p className="text-gray-400 text-xs leading-relaxed mb-3">{(ui as any)[p.conceptKey]}</p>

                {/* Color palette */}
                <div className="flex gap-2 mb-3">
                  {p.palette.map((color, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div
                        className="w-6 h-6 rounded-full border border-gray-600 shadow"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-xs text-gray-500" style={{ fontSize: '9px' }}>{p.paletteNames[i]}</span>
                    </div>
                  ))}
                </div>

                {/* Strengths */}
                <div className="space-y-1">
                  {p.strengthKeys.map((s, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className="text-yellow-400 text-xs">✦</span>
                      <span className="text-gray-300 text-xs">{(ui as any)[s]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Phone mockup preview */}
        {selected && (
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 mb-8">
            <h3 className="text-white font-bold mb-4 text-center">{ui.phonePreview}</h3>
            <div className="flex flex-wrap justify-center gap-8">
              {/* Home screen mockup */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-48 h-80 bg-gradient-to-b from-blue-900 to-indigo-950 rounded-3xl border-4 border-gray-600 shadow-2xl overflow-hidden relative">
                  {/* Status bar */}
                  <div className="h-6 bg-black/30 flex items-center justify-between px-3">
                    <span className="text-white text-xs">9:41</span>
                    <div className="flex gap-1">
                      <div className="w-3 h-2 bg-white rounded-sm opacity-80"></div>
                      <div className="w-2 h-2 bg-white rounded-full opacity-80"></div>
                    </div>
                  </div>
                  {/* App grid */}
                  <div className="p-3 grid grid-cols-4 gap-2 mt-4">
                    {[...Array(8)].map((_, i) => (
                      <div key={i} className="flex flex-col items-center gap-1">
                        <div className="w-10 h-10 rounded-xl bg-gray-600/50 overflow-hidden">
                          {i === 2 && (
                            <AppImage
                              src={proposals.find((p) => p.id === selected)?.src || ''}
                              alt="DirectHub"
                              width={40}
                              height={40}
                              className="w-full h-full"
                              unoptimized
                            />
                          )}
                        </div>
                        <div className="h-1.5 w-6 bg-white/20 rounded"></div>
                      </div>
                    ))}
                  </div>
                  {/* Label under icon */}
                  <div className="absolute" style={{ top: '108px', left: '50%', transform: 'translateX(-50%)' }}>
                    <span className="text-white text-xs font-medium" style={{ fontSize: '8px' }}>DirectHub</span>
                  </div>
                </div>
                <span className="text-gray-400 text-xs">{ui.phoneScreen}</span>
              </div>

              {/* App store mockup */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-64 bg-gray-800 rounded-2xl border border-gray-600 p-4 shadow-xl">
                  <div className="flex gap-3 items-start">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 shadow-lg">
                      <AppImage
                        src={proposals.find((p) => p.id === selected)?.src || ''}
                        alt="DirectHub"
                        width={64}
                        height={64}
                        className="w-full h-full"
                        unoptimized
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white text-sm">DirectHub</div>
                      <div className="text-gray-400 text-xs">B2B Industrial Marketplace</div>
                      <div className="flex items-center gap-1 mt-1">
                        {[...Array(5)].map((_, i) => (
                          <span key={i} className="text-yellow-400 text-xs">★</span>
                        ))}
                        <span className="text-gray-400 text-xs ml-1">4.9</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 bg-blue-600 rounded-xl py-1.5 text-center">
                    <span className="text-white text-xs font-bold">GET</span>
                  </div>
                </div>
                <span className="text-gray-400 text-xs">App Store</span>
              </div>
            </div>
          </div>
        )}

        {/* Action */}
        {selected && !applied && (
          <div className="text-center">
            <div className="bg-gray-900 border border-yellow-500/30 rounded-2xl p-6 inline-block">
              <p className="text-gray-300 text-sm mb-4">
                {ui.youSelected} <strong className="text-yellow-400">{(ui as any)[proposals.find((p) => p.id === selected)?.titleKey || "p1Title"]}</strong>
              </p>
              <p className="text-gray-400 text-xs mb-4 max-w-sm">
                {ui.applyHint}
              </p>
              <div className="bg-gray-800 rounded-xl px-4 py-3 text-right">
                <p className="text-yellow-400 text-xs font-mono">
                  {ui.applyPrompt.replace("{n}", String(selected))}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Comparison table */}
        <div className="mt-10 bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-700">
            <h3 className="text-white font-bold">{ui.compareTitle}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-right text-gray-400 font-medium px-5 py-3">{ui.criterion}</th>
                  <th className="text-center text-gray-400 font-medium px-4 py-3">{ui.proposal1}</th>
                  <th className="text-center text-gray-400 font-medium px-4 py-3">{ui.proposal2}</th>
                  <th className="text-center text-gray-400 font-medium px-4 py-3">{ui.proposal3}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { criterion: ui.clarityAtSmall, scores: ['★★★★★', '★★★★☆', '★★★★☆'] },
                  { criterion: '{ui.corporateTone}', scores: ['★★★★★', '★★★★☆', '★★★★★'] },
                  { criterion: '{ui.visualDistinction}', scores: ['★★★★☆', '★★★★★', '★★★★★'] },
                  { criterion: '{ui.luxuryRestraint}', scores: ['★★★★★', '★★★☆☆', '★★★★★'] },
                  { criterion: '{ui.memorability}', scores: ['★★★★★', '★★★★☆', '★★★☆☆'] },
                ].map((row, i) => (
                  <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="text-gray-300 px-5 py-3">{row.criterion}</td>
                    {row.scores.map((score, j) => (
                      <td key={j} className="text-center text-yellow-400 px-4 py-3 text-xs">
                        {score}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recommendation */}
        <div className="mt-6 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-2xl p-5">
          <div className="flex gap-3">
            <span className="text-2xl">🏆</span>
            <div>
              <h4 className="text-yellow-400 font-bold mb-1">{ui.rocketRec}</h4>
              <p className="text-gray-300 text-sm leading-relaxed">
                {ui.rocketRecBody}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
