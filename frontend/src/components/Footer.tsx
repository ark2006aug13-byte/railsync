import React, { useState, useEffect } from 'react';

export const Footer: React.FC = () => {
  const [utcTime, setUtcTime] = useState<string>('08:42:19');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getUTCHours()).padStart(2, '0');
      const minutes = String(now.getUTCMinutes()).padStart(2, '0');
      const seconds = String(now.getUTCSeconds()).padStart(2, '0');
      setUtcTime(`${hours}:${minutes}:${seconds}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="w-full bg-[#ffffff] border-t border-[#c5c5d3]/30">
      <div className="h-11 w-full px-4 sm:px-8 flex items-center justify-between text-[#444651] text-[11px] font-medium">
        <div className="flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#006c49]"></span>
          <span className="font-semibold text-[#131b2e]">RailSync Operational Intelligence</span>
          <span className="text-[#757682]">•</span>
          <span>Telemetry Network v4.2</span>
          <span className="text-[#757682] hidden sm:inline">•</span>
          <span className="hidden sm:inline">Sub-second precision</span>
        </div>
        <div className="hidden md:flex items-center gap-3 text-[#757682]">
          <span>UTC {utcTime}</span>
          <span>•</span>
          <span>Latency: 4ms</span>
        </div>
      </div>
    </footer>
  );
};
