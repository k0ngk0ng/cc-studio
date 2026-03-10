import React, { useCallback, useRef, useState } from 'react';
import { useSettingsStore } from '../../stores/settingsStore';
import { SettingsInput } from './controls/SettingsInput';
import { SettingsSelect } from './controls/SettingsSelect';
import { SettingsToggle } from './controls/SettingsToggle';
import type { ProviderEnvVar } from '../../types';

const PREDEFINED_KEYS = new Set([
  'CODEX_MODEL',
  'CODEX_REASONING_EFFORT',
  'CODEX_PROFILE',
  'CODEX_OSS',
  'CODEX_LOCAL_PROVIDER',
  'CODEX_EPHEMERAL',
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'OPENAI_ORG_ID',
  'OPENAI_PROJECT_ID',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY',
  'CODEX_HOME',
]);

function getEnvVal(envVars: ProviderEnvVar[], key: string): string {
  return envVars.find((envVar) => envVar.key === key)?.value || '';
}

function isEnvToggleOn(envVars: ProviderEnvVar[], key: string): boolean {
  const envVar = envVars.find((item) => item.key === key);
  return !!envVar && envVar.enabled && (envVar.value === '1' || envVar.value === 'true');
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
    >
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium text-text-primary hover:bg-surface-hover transition-colors text-left"
      >
        <ChevronIcon open={open} />
        <span>{title}</span>
      </button>
      <div
        className={`transition-all duration-200 ease-in-out overflow-hidden ${
          open ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-4 pb-4 space-y-5 border-t border-border pt-4">{children}</div>
      </div>
    </div>
  );
}

function PasswordInput({
  label,
  description,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <div className="text-sm font-medium text-text-primary mb-0.5">{label}</div>
      <div className="text-xs text-text-muted mb-2">{description}</div>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 pr-10 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent placeholder:text-text-muted font-mono"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-primary transition-colors"
          title={show ? 'Hide' : 'Show'}
        >
          {show ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 2l12 12M6.5 6.5a2 2 0 002.8 2.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M4.2 4.2C2.8 5.2 1.5 7 1.5 8s2.5 4.5 6.5 4.5c1.2 0 2.3-.3 3.2-.8M8 3.5c4 0 6.5 3.5 6.5 4.5 0 .5-.7 1.7-2 2.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 3.5C4 3.5 1.5 7 1.5 8S4 12.5 8 12.5 14.5 9 14.5 8 12 3.5 8 3.5z" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

export function CodexCliSection() {
  const {
    settings,
    setEnvVars,
    addEnvVar,
    removeEnvVar,
    updateEnvVar,
    updateActiveProfile,
    getActiveProfile,
    addProfile,
    removeProfile,
    renameProfile,
    switchProfile,
    duplicateProfile,
  } = useSettingsStore();
  const { provider } = settings;
  const { envVars } = provider;
  const importRef = useRef<HTMLInputElement>(null);
  const [newCustomKey, setNewCustomKey] = useState('');
  const [newCustomValue, setNewCustomValue] = useState('');
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingProfileName, setEditingProfileName] = useState('');

  const setEnv = useCallback((key: string, value: string) => {
    const existing = envVars.find((envVar) => envVar.key === key);
    if (existing) {
      updateEnvVar(key, { value, enabled: true });
    } else {
      addEnvVar({ key, value, enabled: true });
    }
  }, [addEnvVar, envVars, updateEnvVar]);

  const setEnvToggle = useCallback((key: string, on: boolean) => {
    const value = on ? '1' : '0';
    const existing = envVars.find((envVar) => envVar.key === key);
    if (existing) {
      updateEnvVar(key, { value, enabled: on });
    } else if (on) {
      addEnvVar({ key, value, enabled: true });
    }
  }, [addEnvVar, envVars, updateEnvVar]);

  const handleExport = useCallback(() => {
    const profile = getActiveProfile();
    const data = JSON.stringify({
      envVars: profile.envVars,
      includeCoAuthoredBy: profile.includeCoAuthoredBy,
    }, null, 2);

    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'codex-profile.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [getActiveProfile]);

  const handleImport = useCallback(() => {
    importRef.current?.click();
  }, []);

  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (Array.isArray(data.envVars)) {
          updateActiveProfile({
            envVars: data.envVars,
            includeCoAuthoredBy: !!data.includeCoAuthoredBy,
          });
          setEnvVars(data.envVars);
        }
      } catch {
        // Ignore invalid imports.
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [setEnvVars, updateActiveProfile]);

  const customEnvVars = envVars.filter((envVar) => !PREDEFINED_KEYS.has(envVar.key));

  const handleAddCustom = useCallback(() => {
    const key = newCustomKey.trim().toUpperCase();
    if (!key || envVars.some((envVar) => envVar.key === key)) return;
    addEnvVar({ key, value: newCustomValue, enabled: true });
    setNewCustomKey('');
    setNewCustomValue('');
  }, [addEnvVar, envVars, newCustomKey, newCustomValue]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-text-primary">Codex CLI</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleImport}
            className="px-3 py-1.5 text-xs rounded-lg border border-border text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
          >
            Import
          </button>
          <button
            onClick={handleExport}
            className="px-3 py-1.5 text-xs rounded-lg border border-border text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
          >
            Export
          </button>
          <input ref={importRef} type="file" accept=".json" onChange={handleImportFile} className="hidden" />
        </div>
      </div>
      <p className="text-sm text-text-muted mb-4">
        Configure Codex CLI profiles, model defaults, authentication, and runtime behavior.
      </p>

      <div className="flex items-center gap-2 mb-6">
        <select
          value={provider.activeProfileId}
          onChange={(e) => switchProfile(e.target.value)}
          className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
        >
          {provider.profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>{profile.name}</option>
          ))}
        </select>

        {editingProfileId === provider.activeProfileId ? (
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (editingProfileName.trim()) {
                renameProfile(provider.activeProfileId, editingProfileName.trim());
              }
              setEditingProfileId(null);
            }}
          >
            <input
              autoFocus
              value={editingProfileName}
              onChange={(e) => setEditingProfileName(e.target.value)}
              onBlur={() => {
                if (editingProfileName.trim()) {
                  renameProfile(provider.activeProfileId, editingProfileName.trim());
                }
                setEditingProfileId(null);
              }}
              className="w-28 px-2 py-1 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </form>
        ) : (
          <button
            onClick={() => {
              setEditingProfileId(provider.activeProfileId);
              setEditingProfileName(getActiveProfile().name);
            }}
            title="Rename profile"
            className="p-1.5 text-xs rounded-lg border border-border text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
          >
            ✏️
          </button>
        )}

        <button
          onClick={() => duplicateProfile(provider.activeProfileId)}
          title="Duplicate profile"
          className="p-1.5 text-xs rounded-lg border border-border text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
        >
          📋
        </button>
        <button
          onClick={() => addProfile(`Profile ${provider.profiles.length + 1}`)}
          title="New profile"
          className="p-1.5 text-xs rounded-lg border border-border text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
        >
          ＋
        </button>
        {provider.profiles.length > 1 && (
          <button
            onClick={() => {
              if (confirm(`Delete profile "${getActiveProfile().name}"?`)) {
                removeProfile(provider.activeProfileId);
              }
            }}
            title="Delete profile"
            className="p-1.5 text-xs rounded-lg border border-border text-red-400 hover:text-red-300 hover:bg-surface-hover transition-colors"
          >
            🗑
          </button>
        )}
      </div>

      <div className="space-y-4">
        <CollapsibleSection title="Model & Provider" defaultOpen>
          <SettingsInput
            label="Model"
            description="Overrides the default Codex model for new turns."
            type="text"
            value={getEnvVal(envVars, 'CODEX_MODEL')}
            onChange={(value) => setEnv('CODEX_MODEL', value)}
            placeholder="gpt-5.4"
          />
          <SettingsSelect
            label="Reasoning effort"
            description="Mapped to Codex config override `model_reasoning_effort`."
            value={getEnvVal(envVars, 'CODEX_REASONING_EFFORT') || 'high'}
            onChange={(value) => setEnv('CODEX_REASONING_EFFORT', value)}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
              { value: 'xhigh', label: 'Very High' },
            ]}
          />
          <SettingsInput
            label="Codex profile"
            description="Optional `codex --profile` value."
            type="text"
            value={getEnvVal(envVars, 'CODEX_PROFILE')}
            onChange={(value) => setEnv('CODEX_PROFILE', value)}
            placeholder="default"
          />
          <SettingsToggle
            label="Use local OSS provider"
            description="Passes `--oss` to Codex for LM Studio / Ollama style flows."
            checked={isEnvToggleOn(envVars, 'CODEX_OSS')}
            onChange={(value) => setEnvToggle('CODEX_OSS', value)}
          />
          <SettingsSelect
            label="Local provider"
            description="Optional `--local-provider` selection when OSS mode is enabled."
            value={getEnvVal(envVars, 'CODEX_LOCAL_PROVIDER') || ''}
            onChange={(value) => setEnv('CODEX_LOCAL_PROVIDER', value)}
            options={[
              { value: '', label: 'Auto' },
              { value: 'lmstudio', label: 'LM Studio' },
              { value: 'ollama', label: 'Ollama' },
            ]}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Auth & API">
          <PasswordInput
            label="OpenAI API key"
            description="Optional API key for API-key based Codex auth."
            value={getEnvVal(envVars, 'OPENAI_API_KEY')}
            onChange={(value) => setEnv('OPENAI_API_KEY', value)}
            placeholder="sk-..."
          />
          <SettingsInput
            label="Base URL"
            description="Optional custom API endpoint."
            type="text"
            value={getEnvVal(envVars, 'OPENAI_BASE_URL')}
            onChange={(value) => setEnv('OPENAI_BASE_URL', value)}
            placeholder="https://api.openai.com/v1"
          />
          <SettingsInput
            label="Organization ID"
            description="Optional OpenAI organization id."
            type="text"
            value={getEnvVal(envVars, 'OPENAI_ORG_ID')}
            onChange={(value) => setEnv('OPENAI_ORG_ID', value)}
            placeholder="org_..."
          />
          <SettingsInput
            label="Project ID"
            description="Optional OpenAI project id."
            type="text"
            value={getEnvVal(envVars, 'OPENAI_PROJECT_ID')}
            onChange={(value) => setEnv('OPENAI_PROJECT_ID', value)}
            placeholder="proj_..."
          />
        </CollapsibleSection>

        <CollapsibleSection title="Runtime">
          <SettingsToggle
            label="Ephemeral sessions"
            description="Passes `--ephemeral` so Codex does not persist new turns to disk."
            checked={isEnvToggleOn(envVars, 'CODEX_EPHEMERAL')}
            onChange={(value) => setEnvToggle('CODEX_EPHEMERAL', value)}
          />
          <SettingsInput
            label="Codex home"
            description="Override `CODEX_HOME` if you want a different config/session root."
            type="text"
            value={getEnvVal(envVars, 'CODEX_HOME')}
            onChange={(value) => setEnv('CODEX_HOME', value)}
            placeholder="~/.codex"
          />
          <SettingsToggle
            label="Include Co-Authored-By"
            description="Keeps the commit trailer preference in the active profile."
            checked={getActiveProfile().includeCoAuthoredBy}
            onChange={(value) => updateActiveProfile({ includeCoAuthoredBy: value })}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Proxy & Networking">
          <SettingsInput
            label="HTTP Proxy"
            description="HTTP proxy URL (HTTP_PROXY)."
            type="text"
            value={getEnvVal(envVars, 'HTTP_PROXY')}
            onChange={(value) => setEnv('HTTP_PROXY', value)}
            placeholder="http://proxy:8080"
          />
          <SettingsInput
            label="HTTPS Proxy"
            description="HTTPS proxy URL (HTTPS_PROXY)."
            type="text"
            value={getEnvVal(envVars, 'HTTPS_PROXY')}
            onChange={(value) => setEnv('HTTPS_PROXY', value)}
            placeholder="https://proxy:8443"
          />
          <SettingsInput
            label="No Proxy"
            description="Comma-separated hosts that bypass the proxy (NO_PROXY)."
            type="text"
            value={getEnvVal(envVars, 'NO_PROXY')}
            onChange={(value) => setEnv('NO_PROXY', value)}
            placeholder="localhost,127.0.0.1"
          />
        </CollapsibleSection>

        <CollapsibleSection title="Custom Environment Variables">
          <p className="text-xs text-text-muted -mt-1 mb-3">
            Additional variables are passed directly into the spawned Codex process.
          </p>

          {customEnvVars.length > 0 && (
            <div className="space-y-2">
              {customEnvVars.map((envVar) => (
                <div key={envVar.key} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={envVar.key}
                    readOnly
                    className="w-40 px-2 py-1.5 bg-bg border border-border rounded text-xs text-text-primary font-mono"
                  />
                  <span className="text-text-muted text-xs">=</span>
                  <input
                    type="text"
                    value={envVar.value}
                    onChange={(e) => updateEnvVar(envVar.key, { value: e.target.value })}
                    className="flex-1 px-2 py-1.5 bg-surface border border-border rounded text-xs text-text-primary font-mono focus:outline-none focus:border-accent"
                  />
                  <button
                    onClick={() => updateEnvVar(envVar.key, { enabled: !envVar.enabled })}
                    className={`px-2 py-1.5 rounded text-xs transition-colors ${
                      envVar.enabled ? 'bg-accent/20 text-accent' : 'bg-surface text-text-muted'
                    }`}
                    title={envVar.enabled ? 'Enabled' : 'Disabled'}
                  >
                    {envVar.enabled ? 'On' : 'Off'}
                  </button>
                  <button
                    onClick={() => removeEnvVar(envVar.key)}
                    className="p-1.5 rounded text-text-muted hover:text-error hover:bg-error/10 transition-colors"
                    title="Remove"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 mt-2">
            <input
              type="text"
              value={newCustomKey}
              onChange={(e) => setNewCustomKey(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddCustom(); }}
              placeholder="KEY"
              className="w-40 px-2 py-1.5 bg-surface border border-border rounded text-xs text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
            <span className="text-text-muted text-xs">=</span>
            <input
              type="text"
              value={newCustomValue}
              onChange={(e) => setNewCustomValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddCustom(); }}
              placeholder="value"
              className="flex-1 px-2 py-1.5 bg-surface border border-border rounded text-xs text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
            <button
              onClick={handleAddCustom}
              disabled={!newCustomKey.trim()}
              className="px-3 py-1.5 rounded text-xs bg-accent text-white hover:bg-accent-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Add
            </button>
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}
