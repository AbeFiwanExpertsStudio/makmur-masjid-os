import React from 'react';
import dynamic from 'next/dynamic';

const DynamicWaktuSolat = dynamic(
    () => import('@/components/waktu-solat/DynamicWaktuSolat')
);

export const metadata = {
    title: 'Waktu Solat | Project Makmur',
    description: 'Prayer times and Qibla direction for Project Makmur',
};

export default function WaktuSolatPage() {
    return (
        <div className="min-h-[calc(100vh-64px)] flex flex-col bg-surface">
            <DynamicWaktuSolat />
        </div>
    );
}
