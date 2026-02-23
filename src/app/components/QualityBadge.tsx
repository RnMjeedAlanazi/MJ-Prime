'use client';

import React from 'react';
import { Disc } from 'lucide-react';

interface QualityBadgeProps {
  quality: string;
  className?: string;
  large?: boolean;
}

export default function QualityBadge({ quality, className = '', large = false }: QualityBadgeProps) {
  if (!quality) return null;

  const lowQuality = quality.toLowerCase();
  
  let badgeClass = `qBadge ${large ? 'qBadge-large' : ''} `;
  let content: React.ReactNode = 'SD';

  if (lowQuality.includes('4k') || lowQuality.includes('uhd')) {
    badgeClass += 'qBadge-4k';
    content = '4K';
  } else if (lowQuality.includes('1080') || lowQuality.includes('fhd')) {
    badgeClass += 'qBadge-1080';
    content = 'FHD';
  } else if (lowQuality.includes('bluray') || lowQuality.includes('bdrip') || lowQuality.includes('brrip')) {
    badgeClass += 'qBadge-bluray';
    content = (
      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <Disc size={large ? 18 : 14} strokeWidth={2.5} />
        <span>{lowQuality.includes('brrip') ? 'BRRIP' : 'BLURAY'}</span>
      </span>
    );
  } else if (lowQuality.includes('موسم') || lowQuality.includes('مواسم')) {
    badgeClass += 'qBadge-season';
    content = quality.trim();
  } else if (lowQuality.includes('web-dl') || lowQuality.includes('webrip')) {
    badgeClass += 'qBadge-webdl';
    content = 'WEB-DL';
  } else if (lowQuality.includes('hdtv')) {
    badgeClass += 'qBadge-hdtv';
    content = 'HDTV';
  } else if (lowQuality.includes('720') || lowQuality.includes('hd')) {
    badgeClass += 'qBadge-720';
    content = 'HD';
  } else if (lowQuality.includes('sd') || lowQuality.includes('480')) {
    badgeClass += 'qBadge-720';
    content = 'SD';
  } else if (lowQuality.includes('cam')) {
    badgeClass += 'qBadge-720';
    content = 'CAM';
  } else {
    // Default fallback for other qualities
    badgeClass += 'qBadge-720';
    let text = quality.trim().toUpperCase();
    if (text.length > 8) { // Increased limit to 8
      text = text.substring(0, 8);
    }
    content = text;
  }

  return (
    <div className={`${badgeClass} ${className}`} title={quality}>
      {content}
    </div>
  );
}
