import React from 'react';

// Types for external actions
export interface ActionOption {
  id: string;
  label: string;
  description?: string;
  handler: (customerId: string, customer?: any, setStatus?: (status: string) => void) => void | Promise<void> | React.ReactElement | Promise<React.ReactElement>;
  batchHandler?: (customerIds: string[], customers: any[], statusCallback?: (customerId: string, status: string) => void) => Promise<void>;
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
  const [isLoading, setIsLoading] = React.useState(false);
  const [currentStatus, setCurrentStatus] = React.useState<string | null>(null);
  const [executingActionId, setExecutingActionId] = React.useState<string | null>(null);
  const [componentDialog, setComponentDialog] = React.useState<React.ReactElement | null>(null);
  const [isComponentDialogOpen, setIsComponentDialogOpen] = React.useState(false);

  const executeSelectedAction = async (customerId: string, customer?: any) => {
    const action = config.actions[selectedActionIndex];
    if (action) {
      setIsLoading(true);
      setCurrentStatus(null);
      setExecutingActionId(action.id);
      
      const updateStatus = (status: string) => {
        setCurrentStatus(status);
      };
      
      try {
        const result = action.handler(customerId, customer, updateStatus);
        
        let finalResult;
        // Check if the result is a Promise
        if (result instanceof Promise) {
          finalResult = await result;
        } else {
          finalResult = result;
        }
        
        // Check if the result is a React component
        if (React.isValidElement(finalResult)) {
          setComponentDialog(finalResult);
          setIsComponentDialogOpen(true);
          setIsLoading(false);
          setCurrentStatus(null);
          setExecutingActionId(null);
          setIsMenuOpen(false);
          setSelectedActionIndex(0);
          return;
        }
        
      } catch (error) {
        setCurrentStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        // Wait a bit to show the error before closing
        setTimeout(() => {
          setIsLoading(false);
          setCurrentStatus(null);
          setExecutingActionId(null);
          setIsMenuOpen(false);
          setSelectedActionIndex(0);
        }, 2000);
        return;
      }
      
      setIsLoading(false);
      setCurrentStatus(null);
      setExecutingActionId(null);
      setIsMenuOpen(false);
      setSelectedActionIndex(0);
    }
  };

  const executeBatchAction = async (action: ActionOption, customerIds: string[], customers: any[], statusCallback?: (customerId: string, status: string) => void) => {
    try {
      if (action.batchHandler) {
        // Use the custom batch handler if provided
        await action.batchHandler(customerIds, customers, statusCallback);
      } else {
        // Fallback: execute individual actions sequentially
        for (let i = 0; i < customerIds.length; i++) {
          const customerId = customerIds[i];
          const customer = customers[i];
          
          if (!customerId || !customer) {
            console.error('Invalid customer data at index', i);
            continue;
          }
          
          const individualStatusCallback = (status: string) => {
            statusCallback?.(customerId, status);
          };
          
          const result = action.handler(customerId, customer, individualStatusCallback);
          
          if (result instanceof Promise) {
            await result;
          }
        }
      }
    } catch (error) {
      console.error(`Batch action failed:`, error);
      throw error;
    }
  };

  const openMenu = () => {
    setIsMenuOpen(true);
    setSelectedActionIndex(0);
  };

  const closeMenu = () => {
    if (!isLoading) {
      setIsMenuOpen(false);
      setSelectedActionIndex(0);
      setCurrentStatus(null);
      setExecutingActionId(null);
    }
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

  const closeComponentDialog = () => {
    setIsComponentDialogOpen(false);
    setComponentDialog(null);
  };

  return {
    selectedActionIndex,
    isMenuOpen,
    isLoading,
    currentStatus,
    executingActionId,
    actions: config.actions,
    executeSelectedAction,
    executeBatchAction,
    openMenu,
    closeMenu,
    navigateUp,
    navigateDown,
    componentDialog,
    isComponentDialogOpen,
    closeComponentDialog
  };
};
