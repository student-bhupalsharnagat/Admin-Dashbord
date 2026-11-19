import React from 'react';
import { HierarchyViews, HierarchyViewsProps } from './HierarchyViews';

export type ClientsViewProps = Omit<HierarchyViewsProps, 'level'> & {
  level?: 'clients';
};

export const ClientsView: React.FC<ClientsViewProps> = (props) => {
  return (
    <HierarchyViews
      {...props}
      level="clients"
    />
  );
};

export default ClientsView;
