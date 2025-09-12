import React from 'react';

// Types for external actions
export interface ActionOption {
  id: string;
  label: string;
  description?: string;
  handler: (customerId: string, customer?: any) => void | Promise<void>;
}

export interface ExternalActionsConfig {
  actions: ActionOption[];
}

// Default actions
const openCustomerInAutumn = (customerId: string) => {
  const url = `https://app.useautumn.com/customers/${customerId}`;
  import('child_process').then(cp => {
    cp.exec(`open "${url}"`);
  });
};

// You can customize this configuration
export const defaultActionsConfig: ExternalActionsConfig = {
  actions: [
    {
      id: 'autumn',
      label: 'Open in Autumn',
      description: 'View customer in Autumn dashboard',
      handler: openCustomerInAutumn
    }
  ]
};

// Helper function to execute action
export const executeAction = (actionId: string, customerId: string, customer: any, config: ExternalActionsConfig = defaultActionsConfig) => {
  const action = config.actions.find(a => a.id === actionId);
  if (action) {
    action.handler(customerId, customer);
  }
};

// Hook for managing action state
export const useExternalActions = (config: ExternalActionsConfig = defaultActionsConfig) => {
  const [selectedActionIndex, setSelectedActionIndex] = React.useState(0);
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const executeSelectedAction = (customerId: string, customer?: any) => {
    const action = config.actions[selectedActionIndex];
    if (action) {
      action.handler(customerId, customer);
      setIsMenuOpen(false);
      setSelectedActionIndex(0);
    }
  };

  const openMenu = () => {
    setIsMenuOpen(true);
    setSelectedActionIndex(0);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
    setSelectedActionIndex(0);
  };

  const navigateUp = () => {
    if (selectedActionIndex > 0) {
      setSelectedActionIndex(selectedActionIndex - 1);
    }
  };

  const navigateDown = () => {
    if (selectedActionIndex < config.actions.length - 1) {
      setSelectedActionIndex(selectedActionIndex + 1);
    }
  };

  return {
    selectedActionIndex,
    isMenuOpen,
    actions: config.actions,
    executeSelectedAction,
    openMenu,
    closeMenu,
    navigateUp,
    navigateDown
  };
};
