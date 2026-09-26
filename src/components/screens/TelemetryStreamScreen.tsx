import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  Cpu, 
  ShieldCheck, 
  Download, 
  Copy, 
  Check, 
  Pause, 
  Play, 
  Layers, 
  Activity, 
  RefreshCw,
  Search,
  Code2,
  FileCode,
  Radar
} from 'lucide-react';
import { AppView, TelemetryPacket } from '../../types';
import { initialTelemetryPackets } from '../../data/mockData';
import { useTrain } from '../../context/TrainContext';

interface TelemetryStreamScreenProps {
  onNavigate: (view: AppView) => void;
}

export const TelemetryStreamScreen: React.FC<TelemetryStreamScreenProps> = ({ onNavigate }) => {
  const { telemetryPackets, isBackendOnline } = useTrain();
  const [packets, setPackets] = useState<TelemetryPacket[]>(
    telemetryPackets.length > 0 ? telemetryPackets : initialTelemetryPackets
  );
  const [selectedPacket, setSelectedPacket] = useState<TelemetryPacket>(
    telemetryPackets.length > 0 ? telemetryPackets[0] : initialTelemetryPackets[0]
  );
  const [isFrozen, setIsFrozen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'rtis' | 'kavach' | 'axle' | 'ei'>('all');
  const [inspectorTab, setInspectorTab] = useState<'hex' | 'json'>('hex');
  const [copied, setCopied] = useState(false);

  // Sync with live backend packets when available
  useEffect(() => {
    if (!isFrozen && telemetryPackets && telemetryPackets.length > 0) {
      setPackets(telemetryPackets);
      if (!selectedPacket || !telemetryPackets.some(p => p.id === selectedPacket.id)) {
        setSelectedPacket(telemetryPackets[0]);
      }
    }
  }, [telemetryPackets, isFrozen]);

  // Live packet generator
  useEffect(() => {
    if (isFrozen) return;
    const interval = setInterval(() => {
      const now = new Date();
      const ms = String(now.getMilliseconds()).padStart(3, '0');
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${ms}`;
      
      const newPkt: TelemetryPacket = {
        id: `pkt-${Date.now()}`,
        timestamp: timeStr,
        locoId: Math.random() > 0.5 ? '22436 Vande Bharat Unit #16' : '12302 WAP-7 #30214 SRC',
        blockSignalMile: `Block ${Math.floor(950 + Math.random() * 40)} Shivaji - TKJ Corridor`,
        subsystem: Math.random() > 0.5 ? 'RTIS Position Pulse' : 'Kavach ATP Speed Profile',
        telemetryValue: `${(115 + Math.random() * 14).toFixed(1)} km/h`,
        speedKmH: 115 + Math.random() * 14,
        details: {
          channel: 'ISRO NavIC L5 / UHF 433MHz',
          fec: 'RS(255, 223)',
          crc: 'CRC-CCITT Valid',
          snrDb: 44.5,
          rawHex: '02 4A 12 36 22 43 00 20 57 41 50 37 33 30 32 31 34 03 C4 01 28 40 1E 0F 00 00 2C 10 07 E8 09 64 00 20 02 53 49 4C 34 56 4D 53 41 43 4B 99 98 10 21',
          payloadJson: {
            telemetryTick: Date.now(),
            latitude: 28.6448,
            longitude: 77.2167,
            kavachSupervision: 'NORMAL_CRUISE',
            snr: 44.5
          }
        }
      };

      setPackets(prev => [newPkt, ...prev.slice(0, 19)]);
    }, 2400);

    return () => clearInterval(interval);
  }, [isFrozen]);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedPacket.details.rawHex || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-[#091322] text-slate-300 px-4 py-2 rounded-xl border border-[#1b2b42] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-white font-bold">CRIS FOIS-RTIS GATEWAY</span>
          <span className="text-slate-600">|</span>
          <span>ZONE NR-DLI</span>
          <span className="text-slate-600">|</span>
          <span className="text-blue-400">NODE: NDLS-SIG-SW-08A</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsFrozen(!isFrozen)}
            className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              isFrozen ? 'bg-amber-600 text-white' : 'bg-[#15273e] text-slate-200 hover:bg-[#1f3757]'
            }`}
          >
            {isFrozen ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            <span>{isFrozen ? 'Resume Feed' : 'Freeze Stream'}</span>
          </button>

          <button
            onClick={() => alert('Exporting PCAP / Hex dump: ndls_rtis_packet_stream.pcap')}
            className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Download className="w-3 h-3" />
            <span>Export Hex / PCAP</span>
          </button>
        </div>
      </div>

      {/* Title & Subtitle */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <span>RTIS & Kavach Subsystem Telemetry</span>
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
            SIL-4 Packet Bus
          </span>
        </h1>
        <p className="text-xs md:text-sm text-slate-600 mt-1">
          High-frequency SIL-4 packet stream with millisecond-grade timecode capture and dual ISRO NavIC / Kavach radio integration.
        </p>
      </div>

      {/* 4 Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Packet Ingestion Rate</span>
          <div className="text-2xl font-black text-slate-900 font-mono">1,424 <span className="text-xs font-normal text-slate-500">pkts/sec</span></div>
          <span className="text-[11px] text-emerald-600 font-medium">+4.2% vs baseline • Buffer 4.8MB/s</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">NavIC Constellation (ISRO)</span>
          <div className="text-2xl font-black text-blue-600 font-mono">7 Sats GEO-LOCK</div>
          <span className="text-[11px] text-slate-500 font-medium">Carrier L5/S-Band • DOP 0.88</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">CRC Drop & Frame Loss</span>
          <div className="text-2xl font-black text-emerald-600 font-mono">0.002% QoS-0</div>
          <span className="text-[11px] text-slate-500 font-medium">1 drop / 50k frames • FEC RS(255,223)</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Kavach RFID / UHF RTT</span>
          <div className="text-2xl font-black text-slate-900 font-mono">13ms Nominal</div>
          <span className="text-[11px] text-slate-500 font-medium">Radio 433MHz Duplex • Jitter ±1.4ms</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto text-xs font-bold">
        {[
          { id: 'all', label: 'All Feeds' },
          { id: 'rtis', label: 'RTIS NavIC GPS' },
          { id: 'kavach', label: 'Kavach SIL-4 ATP' },
          { id: 'axle', label: 'Axle Counter Sectional' },
          { id: 'ei', label: 'Electronic Interlocking Log' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTab === tab.id 
                ? 'bg-slate-900 text-white shadow-xs' 
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Grid: Packet Stream (Left) & Diagnostics Inspector (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live Streaming Packets List (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="font-bold text-slate-900 text-sm">High-Speed Ingestion Buffer</span>
            <span className="text-xs font-mono text-emerald-600 flex items-center gap-1 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Capture
            </span>
          </div>

          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {packets.map((pkt) => {
              const isSelected = selectedPacket.id === pkt.id;
              return (
                <div
                  key={pkt.id}
                  onClick={() => setSelectedPacket(pkt)}
                  className={`p-3 rounded-xl border text-xs font-mono transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-200'
                      : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/80 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-blue-600">{pkt.timestamp}</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 text-[10px] font-bold">
                        {pkt.subsystem}
                      </span>
                    </div>
                    <span className="font-bold text-slate-900">{pkt.telemetryValue}</span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-600">
                    <span className="font-semibold text-slate-800">{pkt.locoId}</span>
                    <span className="text-slate-400 truncate max-w-[220px]">{pkt.blockSignalMile}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Packet Diagnostics Inspector (5 Cols) */}
        <div className="lg:col-span-5 bg-slate-900 text-slate-200 rounded-2xl border border-slate-800 shadow-sm p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="font-bold text-white text-sm font-mono flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-cyan-400" />
              Packet Diagnostics Inspector
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              LIVE DUMP
            </span>
          </div>

          {/* Selected Frame Header */}
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1 text-xs font-mono">
            <div className="text-cyan-400 font-bold">{selectedPacket.locoId}</div>
            <div className="text-slate-400 text-[11px]">{selectedPacket.blockSignalMile}</div>
            <div className="text-slate-500 text-[10px]">
              Channel: {selectedPacket.details.channel}
            </div>
          </div>

          {/* Carrier SNR Spectrum & Sat Radar */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">CARRIER SNR SPECTRUM</span>
              <span className="text-emerald-400 font-bold">44.2 dB-Hz (Optimal)</span>
            </div>
            {/* Audio/Radio RF Spectrum waveform visual */}
            <div className="h-16 bg-slate-950 rounded-xl p-2 flex items-end gap-1 border border-slate-800">
              {[28, 35, 42, 60, 80, 95, 88, 70, 50, 40, 32, 25, 45, 65, 85, 90, 75, 55, 40, 30].map((h, i) => (
                <div 
                  key={i} 
                  className="flex-1 bg-gradient-to-t from-blue-600 to-cyan-400 rounded-t"
                  style={{ height: `${h}%` }}
                ></div>
              ))}
            </div>
          </div>

          {/* Decoded Hex Payload with Tabs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setInspectorTab('hex')}
                  className={`px-2.5 py-1 text-xs font-mono font-bold rounded ${
                    inspectorTab === 'hex' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  HEX DUMP
                </button>
                <button
                  onClick={() => setInspectorTab('json')}
                  className={`px-2.5 py-1 text-xs font-mono font-bold rounded ${
                    inspectorTab === 'json' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  PARSED JSON
                </button>
              </div>

              <button
                onClick={handleCopy}
                className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {inspectorTab === 'hex' ? (
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-emerald-400 leading-relaxed break-all select-all">
                {selectedPacket.details.rawHex}
              </div>
            ) : (
              <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-cyan-300 leading-relaxed overflow-x-auto">
                {JSON.stringify(selectedPacket.details.payloadJson || {}, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Hardware Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] text-slate-500 font-semibold uppercase">Balise Group BG-482</span>
          <div className="text-sm font-bold text-slate-900 font-mono">27.095 MHz Telepowering OK</div>
          <span className="text-[11px] text-emerald-600">Cross-track balise active</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] text-slate-500 font-semibold uppercase">SSDAC Evaluator</span>
          <div className="text-sm font-bold text-slate-900 font-mono">0 Error Microcontroller 2oo2</div>
          <span className="text-[11px] text-slate-500">Axle drift 0.000 count</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] text-slate-500 font-semibold uppercase">GSAT-7A MSS Receiver</span>
          <div className="text-sm font-bold text-slate-900 font-mono">Eb/N0: 12.8 dB • BER &lt; 10⁻⁸</div>
          <span className="text-[11px] text-blue-600">Link margin +4.8 dB</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] text-slate-500 font-semibold uppercase">RTIS Balise Broadcast</span>
          <div className="text-sm font-bold text-slate-900 font-mono">SOS-ATP Emergency Ready</div>
          <span className="text-[11px] text-emerald-600">Carrier frequency clean</span>
        </div>
      </div>
    </div>
  );
};
