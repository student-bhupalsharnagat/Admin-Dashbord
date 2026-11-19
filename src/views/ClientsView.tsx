import React from 'react';
import { HierarchyViews, HierarchyViewsProps } from './HierarchyViews';
import { AssignHierarchyModal } from '../components/modals/AssignHierarchyModal';

export { AssignHierarchyModal };

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
