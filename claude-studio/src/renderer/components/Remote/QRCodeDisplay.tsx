import React from 'react';
import { useRemoteStore } from '../../stores/remoteStore';

/**
 * QR Code display for mobile pairing.
 * Shows in the Security settings section.
 */
export function QRCodeDisplay() {
  const { qrDataUrl, isGeneratingQR, relayConnected, generateQR, pairedDevices, revokePairing } =
    useRemoteStore();

  return (
    <div className="space-y-4">
      {/* QR Code */}
      <div className="flex flex-col items-center gap-3 p-4 bg-bg rounded-lg border border-border">
        {!relayConnected ? (
          <div className="text-sm text-text-muted text-center py-4">
            Connect to relay server first to enable remote control.
          </div>
        ) : qrDataUrl ? (
          <>
            <img
              src={qrDataUrl}
              alt="Pairing QR Code"
              className="w-48 h-48 rounded-lg"
              style={{ imageRendering: 'pixelated' }}
            />
            <p className="text-xs text-text-muted text-center">
              Scan with the CC Studio mobile app to pair this desktop.
              <br />
              QR code expires in 5 minutes.
            </p>
            <button
              onClick={() => generateQR()}
              className="text-xs text-accent hover:text-accent/80 transition-colors"
            >
              Regenerate QR Code
            </button>
          </>
        ) : (
          <>
            <div className="w-48 h-48 rounded-lg bg-surface border border-border flex items-center justify-center">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="text-text-muted">
                <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="14" y="14" width="3" height="3" fill="currentColor" />
                <rect x="18" y="14" width="3" height="3" fill="currentColor" />
                <rect x="14" y="18" width="3" height="3" fill="currentColor" />
                <rect x="5" y="5" width="3" height="3" fill="currentColor" />
                <rect x="16" y="5" width="3" height="3" fill="currentColor" />
                <rect x="5" y="16" width="3" height="3" fill="currentColor" />
              </svg>
            </div>
            <button
              onClick={() => generateQR()}
              disabled={isGeneratingQR}
              className="px-4 py-2 bg-accent text-white text-sm rounded-lg
                         hover:bg-accent/90 transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGeneratingQR ? 'Generating…' : 'Generate Pairing QR Code'}
            </button>
          </>
        )}
      </div>

      {/* Paired devices list */}
      {pairedDevices.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-text-primary mb-2">Paired Devices</h3>
          <div className="space-y-2">
            {pairedDevices.map((device) => (
              <div
                key={device.deviceId}
                className="flex items-center justify-between p-3 bg-bg rounded-lg border border-border"
              >
                <div className="flex items-center gap-3">
                  {/* Phone icon */}
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-text-muted">
                    <rect x="4" y="1.5" width="8" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                    <circle cx="8" cy="12" r="0.75" fill="currentColor" />
                  </svg>
                  <div>
                    <div className="text-sm text-text-primary">{device.deviceName}</div>
                    <div className="text-xs text-text-muted">
                      Paired {new Date(device.pairedAt).toLocaleDateString()}
                      {device.lastSeen && (
                        <> · Last seen {formatRelativeTime(device.lastSeen)}</>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => revokePairing(device.deviceId)}
                  className="text-xs text-error hover:text-error/80 transition-colors px-2 py-1"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
