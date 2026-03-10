import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../stores/settingsStore';
import { SettingsSelect } from './controls/SettingsSelect';

export function PermissionsSection() {
  const { t } = useTranslation();
  const { settings, updateGeneral } = useSettingsStore();
  const { general } = settings;

  return (
    <div>
      <h2 className="text-lg font-semibold text-text-primary mb-1">{t('permissions.title')}</h2>
      <p className="text-sm text-text-muted mb-6">
        {t('permissions.description')}
      </p>

      <div className="space-y-6">
        <SettingsSelect
          label={t('permissions.permissionMode')}
          description={t('permissions.permissionModeDesc')}
          value={general.autoApprove}
          onChange={(v) => updateGeneral({ autoApprove: v as any })}
          options={[
            { value: 'readOnly', label: t('permissions.plan') },
            { value: 'workspaceWrite', label: t('permissions.acceptEdits') },
            { value: 'fullAuto', label: t('permissions.dontAsk') },
            { value: 'dangerFullAccess', label: t('permissions.bypassPermissions') },
          ]}
        />

        <div className="rounded-lg border border-border bg-surface px-4 py-3">
          <p className="text-xs text-text-muted font-mono">
            readOnly =&gt; --sandbox read-only
          </p>
          <p className="text-xs text-text-muted font-mono mt-1">
            workspaceWrite =&gt; --sandbox workspace-write
          </p>
          <p className="text-xs text-text-muted font-mono mt-1">
            fullAuto =&gt; --full-auto
          </p>
          <p className="text-xs text-text-muted font-mono mt-1">
            dangerFullAccess =&gt; --sandbox danger-full-access
          </p>
        </div>
      </div>
    </div>
  );
}
