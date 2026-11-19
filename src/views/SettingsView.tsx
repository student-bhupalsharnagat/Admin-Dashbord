import React from 'react';
import { SystemToolsView } from './SystemToolsView';
import { Tenant } from '../types';

export interface SettingsViewProps {
  tenants?: Tenant[];
  onNotify?: (msg: string, type?: 'info' | 'success' | 'warning') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ tenants = [], onNotify }) => {
  return (
    <SystemToolsView
      section="settings"
      tenants={tenants}
      onNotify={onNotify}
    />
  );
};

export default SettingsView;
