#!/usr/bin/env bun
import React, { useState, useEffect } from 'react';
import { render, Box, Text, Spacer, useInput } from 'ink';
import { Spinner, TextInput } from '@inkjs/ui';
import fuzzysort from 'fuzzysort';
import { Autumn } from "autumn-js";

// Import external modules
import { useExternalActions, type ExternalActionsConfig } from './external-actions';
import { useCreditSystem, getCustomerCredits, type CreditSystemConfig } from './credit-system';
import { useCustomerDetails, type Customer, type CustomerDetailsProps } from './customer-details';
import { type BillingAnalysisConfig, defaultConfig, configurations } from './billing-config';
import { FullScreenDetails } from './json-renderer';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { sql } from 'bun';
import Table from './table';

// Custom Table Components (unchanged)
interface TableColumn {
  key: string;
  label: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
}

interface CustomTableProps {
  data: Record<string, any>[];
  columns?: TableColumn[];
}

interface SimpleTableRow {
  key: string;
  label: string;
  value: any;
  important?: boolean;
  formatter?: (val: any) => string;
}

const CustomTable: React.FC<CustomTableProps> = ({ data, columns }) => {
  if (data.length === 0) return <Text color="gray">No data available</Text>;

  const tableColumns = columns || Object.keys(data[0] || {}).map(key => ({
    key,
    label: key,
    width: Math.max(key.length, 12),
    align: 'left' as const
  }));

  const formatCell = (value: any, width: number, align: string = 'left') => {
    const str = String(value || '');
    let content = str;

    if (content.length > width) {
      content = content.slice(0, width - 3) + '...';
    }

    if (align === 'right') {
      return content.padStart(width, ' ');
    } else if (align === 'center') {
      const totalPadding = width - content.length;
      const leftPad = Math.floor(totalPadding / 2);
      return content.padStart(content.length + leftPad, ' ').padEnd(width, ' ');
    } else {
      return content.padEnd(width, ' ');
    }
  };

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">
        {tableColumns.map((col, index) =>
          formatCell(col.label, col.width || 12, col.align) + (index < tableColumns.length - 1 ? ' │ ' : '')
        ).join('')}
      </Text>

      <Text color="gray">
        {tableColumns.map((col, index) =>
          '─'.repeat(col.width || 12) + (index < tableColumns.length - 1 ? '─┼─' : '')
        ).join('')}
      </Text>

      {data.map((row, rowIndex) => (
        <Text key={rowIndex}>
          {tableColumns.map((col, index) =>
            formatCell(row[col.key], col.width || 12, col.align) + (index < tableColumns.length - 1 ? ' │ ' : '')
          ).join('')}
        </Text>
      ))}
    </Box>
  );
};

const CustomTableWithHighlight: React.FC<CustomTableProps> = ({ data, columns }) => {
  if (data.length === 0) return <Text color="gray">No data available</Text>;

  const tableColumns = columns || Object.keys(data[0] || {})
    .filter(key => !key.startsWith('_'))
    .map(key => ({
      key,
      label: key,
      width: Math.max(key.length, 12),
      align: 'left' as const
    }));

  const formatCell = (value: any, width: number, align: string = 'left') => {
    const str = String(value || '');
    let content = str;

    if (content.length > width) {
      content = content.slice(0, width - 3) + '...';
    }

    if (align === 'right') {
      return content.padStart(width, ' ');
    } else if (align === 'center') {
      const totalPadding = width - content.length;
      const leftPad = Math.floor(totalPadding / 2);
      return content.padStart(content.length + leftPad, ' ').padEnd(width, ' ');
    } else {
      return content.padEnd(width, ' ');
    }
  };

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">
        {'  '}{tableColumns.map((col, index) =>
          formatCell(col.label, col.width || 12, col.align) + (index < tableColumns.length - 1 ? ' │ ' : '')
        ).join('')}
      </Text>

      <Text color="gray">
        {'  '}{tableColumns.map((col, index) =>
          '─'.repeat(col.width || 12) + (index < tableColumns.length - 1 ? '─┼─' : '')
        ).join('')}
      </Text>

      {data.map((row, rowIndex) => {
        const isSelected = row._isSelected;
        const isMultiSelected = row._isMultiSelected;
        
        // Determine display style based on selection states
        let prefix = '  ';
        let textColor = 'white';
        let backgroundColor = undefined;
        
        if (isMultiSelected && isSelected) {
          prefix = '★▶';
          textColor = 'black';
          backgroundColor = 'cyan';
        } else if (isMultiSelected) {
          prefix = '★ ';
          textColor = 'cyan';
        } else if (isSelected) {
          prefix = '→ ';
          textColor = 'black';
          backgroundColor = 'yellow';
        }
        
        return (
          <Text
            key={rowIndex}
            color={textColor}
            backgroundColor={backgroundColor}
          >
            {prefix}{tableColumns.map((col, index) =>
              formatCell(row[col.key], col.width || 12, col.align) + (index < tableColumns.length - 1 ? ' │ ' : '')
            ).join('')}
          </Text>
        );
      })}
    </Box>
  );
};

const autumn = new Autumn({
  secretKey: process.env.AUTUMN_PROD_SECRET_KEY,
});

// Types
interface PlanAnalysis {
  [planName: string]: {
    customers: Customer[];
    totalCreditsUsed: number;
    avgCreditsPerCustomer: number;
    customerCount: number;
    environments: { [env: string]: number };
    hasStripeIds: number;
    creationDates: Date[];
    planPrice: number;
    totalSubscriptionRevenue: number;
    avgMonthlyRevenuePerCustomer: number;
  };
}

interface LoadingProgressProps {
  currentPage: number;
  totalFetched: number;
  isLoading: boolean;
}

// Loading Progress Component with Spinner
const LoadingProgress: React.FC<LoadingProgressProps> = ({ currentPage, totalFetched, isLoading }) => {
  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" minHeight={10}>
      {isLoading && <Spinner label="Loading" />}
      <Text color="gray" marginTop={1}>
        Fetched {totalFetched} customers from {currentPage} pages
      </Text>
    </Box>
  );
};

// Plan Summary Component
interface PlanSummaryProps {
  planName: string;
  data: PlanAnalysis[string];
  totalCustomers: number;
  isSelected: boolean;
}

const PlanSummary: React.FC<PlanSummaryProps> = ({ planName, data, totalCustomers, isSelected }) => {
  const percentage = ((data.customerCount / totalCustomers) * 100).toFixed(1);
  const totalRevenue = data.totalSubscriptionRevenue + data.totalCreditsUsed;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentSignups = data.creationDates.filter(date => date > thirtyDaysAgo).length;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={isSelected ? "yellow" : "gray"}
      padding={1}
      marginBottom={1}
    >
      <Text color={isSelected ? "yellow" : "white"} bold>
        {isSelected ? "→ " : "  "}🎯 {planName.toUpperCase()}
      </Text>
      <Box flexDirection="row" gap={2}>
        <Box flexDirection="column" width={30}>
          <Text>👥 Customers: <Text color="cyan">{data.customerCount} ({percentage}%)</Text></Text>
          <Text>💵 Plan Price: <Text color="green">${data.planPrice.toFixed(2)}/month</Text></Text>
          <Text>💰 Subscription Revenue: <Text color="green">${data.totalSubscriptionRevenue.toFixed(2)}/month</Text></Text>
        </Box>
        <Box flexDirection="column" width={30}>
          <Text>⚡ Credits Used: <Text color="yellow">${data.totalCreditsUsed.toFixed(2)}</Text></Text>
          <Text>Total Revenue: <Text color="green">${totalRevenue.toFixed(2)}</Text></Text>
          <Text>📅 Recent Signups: <Text color="blue">{recentSignups}</Text></Text>
        </Box>
      </Box>
    </Box>
  );
};

// Enhanced Customer Table Component with external modules
interface CustomerTableProps {
  customers: Customer[];
  planName: string;
  livePlanPrices: { [key: string]: number };
  onMenuStateChange?: (isMenuOpen: boolean) => void;
  onModalStateChange?: (isModalOpen: boolean) => void;
  config: BillingAnalysisConfig;
}

const CustomerTable: React.FC<CustomerTableProps> = ({
  customers,
  planName,
  livePlanPrices,
  onMenuStateChange,
  onModalStateChange,
  config
}) => {
  // Create QueryClient instance for the customer table
  const queryClient = new QueryClient();
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedCustomerIndex, setSelectedCustomerIndex] = useState(0);
  const [hideZeroCreditUsers, setHideZeroCreditUsers] = useState(false);
  const [isFullScreenDetailsOpen, setIsFullScreenDetailsOpen] = useState(false);
  const [isFuzzySearchMode, setIsFuzzySearchMode] = useState(false);
  const [fuzzySearchQuery, setFuzzySearchQuery] = useState('');
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  
  // Multi-select state
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  const [isBatchMigrationInProgress, setIsBatchMigrationInProgress] = useState(false);
  const [migrationStatuses, setMigrationStatuses] = useState<Map<string, { status: 'pending' | 'in_progress' | 'completed' | 'failed', message?: string }>>(new Map());

  const itemsPerPage = (config.ui?.itemsPerPage ?? 8) || 8; // Reduced to accommodate side panel

  // Use external modules
  const externalActions = useExternalActions(config.actions);
  const creditSystem = useCreditSystem(config.creditSystem);
  const customerDetails = useCustomerDetails(config.customerDetails);

  const getPlanPrice = (plan: any): number => {
    if (!plan) return 0;
    if (plan.id && livePlanPrices[plan.id] !== undefined) {
      return livePlanPrices[plan.id];
    }
    if (plan.name && livePlanPrices[plan.name] !== undefined) {
      return livePlanPrices[plan.name];
    }
    return 0;
  };

  const sortedCustomers = customers
    .map(customer => {
      const credits = creditSystem.getCreditsForCustomer(customer);
      const activePlan = customer.products?.find(p => p.status === "active" && p.group === "plan");
      const planPrice = getPlanPrice(activePlan);

      return {
        customer,
        planPrice,
        creditsUsed: credits.total,
        totalValue: planPrice + credits.total,
        searchableText: `${customer.name || ''} ${customer.email || ''} ${customer.id}`.toLowerCase(),
      };
    })
    .filter(({ creditsUsed }) => !hideZeroCreditUsers || creditsUsed > 0)
    .filter(({ searchableText }) => {
      if (!fuzzySearchQuery.trim()) return true;
      const results = fuzzysort.single(fuzzySearchQuery, searchableText);
      return results !== null;
    })
    .sort((a, b) => {
      if (fuzzySearchQuery.trim()) {
        const scoreA = fuzzysort.single(fuzzySearchQuery, a.searchableText)?.score || -Infinity;
        const scoreB = fuzzysort.single(fuzzySearchQuery, b.searchableText)?.score || -Infinity;
        return scoreB - scoreA; // Higher score first (fuzzysort uses negative scores)
      }
      return b.totalValue - a.totalValue;
    });

  const totalPages = Math.ceil(sortedCustomers.length / itemsPerPage);
  const currentCustomers = sortedCustomers.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  // Reset selection when page changes
  React.useEffect(() => {
    setSelectedCustomerIndex(0);
  }, [currentPage]);

  // Reset page and selection when filter changes
  React.useEffect(() => {
    setCurrentPage(0);
    setSelectedCustomerIndex(0);
  }, [hideZeroCreditUsers]);

  // Notify parent of menu state changes
  React.useEffect(() => {
    onMenuStateChange?.(externalActions.isMenuOpen);
    onModalStateChange?.(isFullScreenDetailsOpen || externalActions.isMenuOpen || isFuzzySearchMode || isHelpOpen || externalActions.isComponentDialogOpen || isBatchMigrationInProgress);
  }, [externalActions.isMenuOpen, isFullScreenDetailsOpen, isFuzzySearchMode, isHelpOpen, externalActions.isComponentDialogOpen, isBatchMigrationInProgress, onMenuStateChange, onModalStateChange]);

  const handleOptionSelect = async () => {
    if (isMultiSelectMode && selectedCustomerIds.size > 0) {
      // Handle batch action
      await handleBatchAction();
    } else {
      const customerEntry = currentCustomers[selectedCustomerIndex];
      if (customerEntry) {
        await externalActions.executeSelectedAction(customerEntry.customer.id, customerEntry.customer);
      }
    }
  };

  const handleBatchAction = async () => {
    const selectedCustomers = currentCustomers.filter(c => selectedCustomerIds.has(c.customer.id));
    if (selectedCustomers.length === 0) return;

    // If migration action is selected, show batch migration view
    const selectedAction = config.actions?.actions?.[externalActions.selectedActionIndex];
    if (selectedAction?.id === 'migrate') {
      setIsBatchMigrationInProgress(true);
      
      // Initialize migration statuses
      const initialStatuses = new Map<string, { status: 'pending' | 'in_progress' | 'completed' | 'failed', message?: string }>();
      selectedCustomers.forEach(c => {
        initialStatuses.set(c.customer.id, { status: 'pending' });
      });
      setMigrationStatuses(initialStatuses);

      // Prepare batch execution data
      const customerIds = selectedCustomers.map(c => c.customer.id);
      const customers = selectedCustomers.map(c => c.customer);
      
      // Status callback for batch operations
      const batchStatusCallback = (customerId: string, status: string) => {
        // Determine final status based on the message
        let finalStatus: 'pending' | 'in_progress' | 'completed' | 'failed' = 'in_progress';
        
        if (status.startsWith('ERROR:') || status.includes('failed')) {
          finalStatus = 'failed';
        } else if (status.includes('completed successfully') || status.includes('No migration required')) {
          finalStatus = 'completed';
        }
        
        setMigrationStatuses(prev => new Map(prev.set(customerId, { status: finalStatus, message: status })));
      };

      try {
        // Execute batch migration
        await externalActions.executeBatchAction(selectedAction, customerIds, customers, batchStatusCallback);
      } catch (error) {
        // Mark any remaining customers as failed if the batch operation fails completely
        selectedCustomers.forEach(customerEntry => {
          const currentStatus = migrationStatuses.get(customerEntry.customer.id);
          if (!currentStatus || currentStatus.status === 'pending' || currentStatus.status === 'in_progress') {
            setMigrationStatuses(prev => new Map(prev.set(customerEntry.customer.id, { 
              status: 'failed', 
              message: error instanceof Error ? error.message : 'Batch operation failed' 
            })));
          }
        });
      }
      
      return;
    }

    // For other actions, execute batch operation
    const customerIds = selectedCustomers.map(c => c.customer.id);
    const customers = selectedCustomers.map(c => c.customer);
    
    await externalActions.executeBatchAction(selectedAction, customerIds, customers);
    
    // Close multi-select mode after batch execution
    setIsMultiSelectMode(false);
    setSelectedCustomerIds(new Set());
    externalActions.closeMenu();
  };

  useInput((input, key) => {
    // Handle batch migration progress view
    if (isBatchMigrationInProgress) {
      if (key.escape) {
        setIsBatchMigrationInProgress(false);
        setMigrationStatuses(new Map());
        setIsMultiSelectMode(false);
        setSelectedCustomerIds(new Set());
      }
      return;
    }

    // Handle help screen - only allow escape and h to close
    if (isHelpOpen) {
      if (key.escape || input === 'h' || input === 'H') {
        setIsHelpOpen(false);
      }
      return;
    }

    // Handle component dialog - only allow escape to close
    if (externalActions.isComponentDialogOpen) {
      if (key.escape) {
        externalActions.closeComponentDialog();
      }
      return;
    }

    // Handle full-screen details view - only allow escape to close
    if (isFullScreenDetailsOpen) {
      if (key.escape) {
        setIsFullScreenDetailsOpen(false);
      }
      return;
    }

    // Handle fuzzy search mode - allow navigation and essential keys to pass through
    if (isFuzzySearchMode) {
      if (key.escape) {
        setIsFuzzySearchMode(false);
        setFuzzySearchQuery('');
        return;
      }
      // Allow navigation keys and essential commands to pass through
      if (input === 'q' || input === 'Q' || 
          key.upArrow || key.downArrow || key.leftArrow || key.rightArrow || 
          key.return || input === 'l' || input === 'L' || 
          input === 'i' || input === 'I' || 
          input === 'n' || input === 'N' || 
          input === 'p' || input === 'P' ||
          input === 'h' || input === 'H' ||
          input === 'm' || input === 'M') {
        return; // Let these pass through to main navigation handler
      }
      // Block all other keys when in search mode to let TextInput handle them
      return;
    }

    // Handle options menu navigation
    if (externalActions.isMenuOpen) {
      // Prevent navigation while loading
      if (!externalActions.isLoading) {
        if (key.upArrow) {
          externalActions.navigateUp();
        } else if (key.downArrow) {
          externalActions.navigateDown();
        } else if (key.return) {
          handleOptionSelect();
        } else if (key.escape) {
          externalActions.closeMenu();
        }
      }
      return; // Don't handle other navigation when menu is open
    }

    // Handle multi-select mode commands
    if (input === 'm' || input === 'M') {
      // Toggle multi-select mode
      setIsMultiSelectMode(!isMultiSelectMode);
      if (isMultiSelectMode) {
        // Exiting multi-select mode, clear selections
        setSelectedCustomerIds(new Set());
      }
    } else if (isMultiSelectMode && (input === 's' || input === 'S')) {
      // Toggle selection of current customer
      const currentCustomer = currentCustomers[selectedCustomerIndex];
      if (currentCustomer) {
        const newSelectedIds = new Set(selectedCustomerIds);
        if (newSelectedIds.has(currentCustomer.customer.id)) {
          newSelectedIds.delete(currentCustomer.customer.id);
        } else {
          newSelectedIds.add(currentCustomer.customer.id);
        }
        setSelectedCustomerIds(newSelectedIds);
      }
    } else if (isMultiSelectMode && (input === 'a' || input === 'A')) {
      // Toggle all visible customers
      const currentCustomerIds = currentCustomers.map(c => c.customer.id);
      const allSelected = currentCustomerIds.every(id => selectedCustomerIds.has(id));
      
      if (allSelected) {
        // Deselect all current page customers
        const newSelectedIds = new Set(selectedCustomerIds);
        currentCustomerIds.forEach(id => newSelectedIds.delete(id));
        setSelectedCustomerIds(newSelectedIds);
      } else {
        // Select all current page customers
        const newSelectedIds = new Set(selectedCustomerIds);
        currentCustomerIds.forEach(id => newSelectedIds.add(id));
        setSelectedCustomerIds(newSelectedIds);
      }
    }

    // Handle main table navigation
    if ((input === 'l' || input === 'L') && currentCustomers[selectedCustomerIndex]) {
      // L: Open full-screen customer details
      setIsFullScreenDetailsOpen(true);
    } else if (key.upArrow && selectedCustomerIndex > 0) {
      setSelectedCustomerIndex(selectedCustomerIndex - 1);
    } else if (key.downArrow && selectedCustomerIndex < currentCustomers.length - 1) {
      setSelectedCustomerIndex(selectedCustomerIndex + 1);
    } else if (key.leftArrow) {
      // Left Arrow: Previous page
      if (currentPage > 0) {
        setCurrentPage(currentPage - 1);
      }
    } else if (key.rightArrow) {
      // Right Arrow: Next page
      if (currentPage < totalPages - 1) {
        setCurrentPage(currentPage + 1);
      }
    } else if (key.return && currentCustomers[selectedCustomerIndex]) {
      // Enter: Open actions menu (for single or multiple selection)
      externalActions.openMenu();
    } else if (input === 'i' || input === 'I') {
      setHideZeroCreditUsers(!hideZeroCreditUsers);
    } else if (input === 'f' || input === 'F') {
      setIsFuzzySearchMode(true);
      setFuzzySearchQuery('');
    } else if (input === 'c' || input === 'C') {
      // Clear fuzzy search
      setFuzzySearchQuery('');
      setCurrentPage(0);
      setSelectedCustomerIndex(0);
    } else if (input === 'n' || input === 'N') {
      // 'N' key: Next page
      if (currentPage < totalPages - 1) {
        setCurrentPage(currentPage + 1);
      }
    } else if (input === 'p' || input === 'P') {
      // 'P' key: Previous page  
      if (currentPage > 0) {
        setCurrentPage(currentPage - 1);
      }
    } else if (input === 'h' || input === 'H') {
      // 'H' key: Show help
      setIsHelpOpen(true);
    }
  });

  // Prepare data for custom table
  const tableData = currentCustomers.map(({ customer, planPrice, creditsUsed, totalValue }, index) => {
    const credits = creditSystem.getCreditsForCustomer(customer);
    const isCurrentSelected = index === selectedCustomerIndex;
    const isMultiSelected = selectedCustomerIds.has(customer.id);
    
    return {
      ID: customer.id.slice(0, 8) + '...',
      Name: (customer.name || 'N/A').slice(0, 15),
      Email: (customer.email || 'N/A').slice(0, 22),
      'Plan ($)': planPrice.toFixed(2),
      'Credits ($)': credits.primary.formatted,
      'Total ($)': totalValue.toFixed(2),
      Stripe: customer.stripe_id ? '✓' : '✗',
      Env: (customer.env || 'unknown').slice(0, 5),
      _isSelected: isCurrentSelected,
      _isMultiSelected: isMultiSelected,
      _customerId: customer.id
    };
  });

  const columns = [
    { key: 'ID', label: 'ID', width: 11 },
    { key: 'Name', label: 'Name', width: 18 },
    { key: 'Email', label: 'Email', width: 25 },
    { key: 'Plan ($)', label: 'Plan ($)', width: 9, align: 'right' as const },
    { key: 'Credits ($)', label: `${config.creditSystem.primary.displayName}`, width: 11, align: 'right' as const },
    { key: 'Total ($)', label: 'Total ($)', width: 9, align: 'right' as const },
    { key: 'Stripe', label: 'Stripe', width: 7 },
    { key: 'Env', label: 'Env', width: 6 }
  ];

  const totalCustomersBeforeFilter = customers.length;
  const filteredCount = sortedCustomers.length;
  const selectedCustomer = currentCustomers[selectedCustomerIndex];

  return (
    <Box flexDirection="column">
      {/* Fuzzy Search Input - Static Layout */}
      <Box
        borderStyle="round"
        borderColor={isFuzzySearchMode ? "yellow" : "gray"}
        // padding={1}
        // marginBottom={1}
        height={3} // Fixed height to prevent layout shift
      >
        <Box flexDirection="column">
          <Text color={isFuzzySearchMode ? "yellow" : "gray"} bold>
            {isFuzzySearchMode ? "🔍 Search Mode (Esc to cancel)" : "🔍 Search"}
          </Text>
          {isFuzzySearchMode ? (
            <TextInput
              placeholder="Enter search query..."
              onSubmit={(query) => {
                setFuzzySearchQuery(query);
                setIsFuzzySearchMode(false);
                setCurrentPage(0); // Reset to first page
                setSelectedCustomerIndex(0); // Reset selection
              }}
              onChange={(query) => {
                setFuzzySearchQuery(query);
                setCurrentPage(0); // Reset to first page when query changes
                setSelectedCustomerIndex(0); // Reset selection
              }}
            />
          ) : (
            <Text color="gray">
              {fuzzySearchQuery ?
                `🔍 "${fuzzySearchQuery}" (${sortedCustomers.length} results) | F: modify, C: clear` :
                isMultiSelectMode ? 
                  "M: exit multi-select | S: toggle current | A: toggle all | Enter: batch actions" :
                  "F: search, I: toggle $0 filter, M: multi-select mode"
              }
            </Text>
          )}
        </Box>
      </Box>

      {/* Header */}
      <Box flexDirection="row" justifyContent="space-between" alignItems="center" marginBottom={1}>
        <Text color="green" bold>
          {planName} Customers (Page {currentPage + 1}/{totalPages})
          {isMultiSelectMode && (
            <Text color="magenta" bold> [MULTI-SELECT: {selectedCustomerIds.size} selected]</Text>
          )}
        </Text>
        <Text color={hideZeroCreditUsers ? 'yellow' : 'gray'}>
          Showing {filteredCount}{!fuzzySearchQuery ? `/${totalCustomersBeforeFilter}` : ''} customers
          {hideZeroCreditUsers && <Text color="yellow"> (hiding $0 credits)</Text>}
        </Text>
      </Box>
{/* 
      <Text color="gray" marginBottom={1}>
        Press H for help
      </Text> */}

      {/* 60/40 Split Layout */}
      <Box flexDirection="row" gap={1}>
        {/* 60% - Customer Table */}
        <Box width="60%" borderStyle="round" borderColor="green" padding={1} height={16}>
          {/* <Text color="green" bold marginBottom={1}>Customer List</Text> */}
          <CustomTableWithHighlight data={tableData} columns={columns} />
        </Box>

        {/* 40% - Custom Customer Details */}
        <Box width="40%">
          {selectedCustomer ? (
            <customerDetails.DetailsComponent
              customer={selectedCustomer.customer}
              planName={planName}
              planPrice={selectedCustomer.planPrice}
              creditSystem={config.creditSystem}
            />
          ) : (
            <Box borderStyle="round" borderColor="gray" padding={1}>
              <Text color="gray">Select a customer to view details</Text>
            </Box>
          )}
        </Box>
      </Box>


      {/* Full-screen Customer Details */}
      {isFullScreenDetailsOpen && selectedCustomer && (
        <FullScreenDetails
          isOpen={isFullScreenDetailsOpen}
          onClose={() => setIsFullScreenDetailsOpen(false)}
          title={`User Settings - ${selectedCustomer.customer.name || selectedCustomer.customer.id.slice(0, 8)}`}
        >
          <customerDetails.DetailsComponent
            fullScreen={true}
            customer={selectedCustomer.customer}
            planName={planName}
            planPrice={selectedCustomer.planPrice}
            creditSystem={config.creditSystem}
          />
        </FullScreenDetails>
      )}

      {/* Help Screen */}
      {isHelpOpen && (
        <FullScreenDetails
          isOpen={isHelpOpen}
          onClose={() => setIsHelpOpen(false)}
          title="Help - Keyboard Shortcuts"
        >
          <Box flexDirection="column" padding={2}>
            <Text color="cyan" bold marginBottom={2}>🔧 ATMN CLI Max - Keyboard Shortcuts</Text>
            
            <Box flexDirection="column" marginBottom={2}>
              <Text color="yellow" bold>Customer List Navigation:</Text>
              <Box flexDirection="column" marginLeft={2}>
                <Text>• ↑/↓ (Up/Down Arrows) - Select customer</Text>
                <Text>• ←/→ (Left/Right Arrows) - Navigate pages</Text>
                <Text>• P/N - Previous/Next page</Text>
                <Text>• Enter - Open actions menu for selected customer(s)</Text>
                <Text>• L - Open full screen customer details</Text>
                <Text>• M - Toggle multi-select mode</Text>
                <Text>• S - Toggle selection (when in multi-select mode)</Text>
                <Text>• A - Toggle all visible customers (when in multi-select mode)</Text>
              </Box>
            </Box>

            <Box flexDirection="column" marginBottom={2}>
              <Text color="yellow" bold>Search & Filter:</Text>
              <Box flexDirection="column" marginLeft={2}>
                <Text>• F - Enter fuzzy search mode</Text>
                <Text>• C - Clear current search</Text>
                <Text>• I - Toggle $0 credit filter (hide/show)</Text>
              </Box>
            </Box>

            <Box flexDirection="column" marginBottom={2}>
              <Text color="yellow" bold>Views & Navigation:</Text>
              <Box flexDirection="column" marginLeft={2}>
                <Text>• 1 - View Plans overview</Text>
                <Text>• 2 - View Customers (current plan)</Text>
                <Text>• 3 - View Overall Summary</Text>
                <Text>• H - Toggle this help screen</Text>
                <Text>• Esc - Go back / Close modals</Text>
                <Text>• Q - Quit application</Text>
              </Box>
            </Box>

            <Box flexDirection="column" marginBottom={2}>
              <Text color="yellow" bold>Actions Menu (when open):</Text>
              <Box flexDirection="column" marginLeft={2}>
                <Text>• ↑/↓ - Navigate actions</Text>
                <Text>• Enter - Execute selected action</Text>
                <Text>• Esc - Close actions menu</Text>
              </Box>
            </Box>

            <Box flexDirection="column" marginBottom={2}>
              <Text color="yellow" bold>Search Mode (when active):</Text>
              <Box flexDirection="column" marginLeft={2}>
                <Text>• Type to search customers</Text>
                <Text>• Enter - Apply search and exit search mode</Text>
                <Text>• Esc - Cancel search and exit search mode</Text>
              </Box>
            </Box>

            <Text color="gray" marginTop={2}>
              Press H or Esc to close this help screen
            </Text>
          </Box>
        </FullScreenDetails>
      )}

      {/* Component Dialog */}
      {externalActions.isComponentDialogOpen && externalActions.componentDialog && (
        <FullScreenDetails
          isOpen={externalActions.isComponentDialogOpen}
          onClose={externalActions.closeComponentDialog}
          title="Action Result"
        >
          {externalActions.componentDialog}
        </FullScreenDetails>
      )}

      {/* Batch Migration Progress View */}
      {isBatchMigrationInProgress && (
        <FullScreenDetails
          isOpen={isBatchMigrationInProgress}
          onClose={() => {
            setIsBatchMigrationInProgress(false);
            setMigrationStatuses(new Map());
            setIsMultiSelectMode(false);
            setSelectedCustomerIds(new Set());
          }}
          title="Batch Migration Progress"
        >
          <Box flexDirection="column" padding={1}>
            <Text color="cyan" bold marginBottom={2}>🚀 Batch Migration in Progress</Text>
            
            {/* Migration Status Table */}
            <Box flexDirection="column">
              <Text bold color="yellow" marginBottom={1}>Migration Status:</Text>
              
              {/* Table Header */}
              <Box flexDirection="row">
                <Text bold color="cyan">Customer (25 chars)</Text>
                <Text bold color="cyan">Status (15 chars)</Text>
                <Text bold color="cyan">Message (40 chars)</Text>
              </Box>
              
              {/* Separator */}
              <Text color="gray">{'─'.repeat(80)}</Text>
              
              {/* Migration rows */}
              {Array.from(migrationStatuses.entries()).map(([customerId, status]) => {
                const customer = currentCustomers.find(c => c.customer.id === customerId)?.customer;
                const customerName = customer?.name || customer?.email || customerId.slice(0, 12);
                
                let statusColor = 'gray';
                let statusIcon = '⏳';
                
                switch (status.status) {
                  case 'pending':
                    statusColor = 'gray';
                    statusIcon = '⏳';
                    break;
                  case 'in_progress':
                    statusColor = 'yellow';
                    statusIcon = '🔄';
                    break;
                  case 'completed':
                    statusColor = 'green';
                    statusIcon = '✅';
                    break;
                  case 'failed':
                    statusColor = 'red';
                    statusIcon = '❌';
                    break;
                }
                
                return (
                  <Box key={customerId} flexDirection="row">
                    <Text color="white">{customerName.slice(0, 22).padEnd(25)}</Text>
                    <Text color={statusColor}>{(statusIcon + ' ' + status.status.toUpperCase()).padEnd(15)}</Text>
                    <Text color="gray">{(status.message || '').padEnd(40)}</Text>
                  </Box>
                );
              })}
            </Box>
            
            <Box marginTop={2}>
              <Text color="gray">Press Esc to close (you can close during migration)</Text>
            </Box>
          </Box>
        </FullScreenDetails>
      )}

      {/* Options Menu */}
      {externalActions.isMenuOpen && (
        <Box
          marginTop={2}
          borderStyle="round"
          borderColor="yellow"
          padding={1}
          backgroundColor="black"
        >
          <Box flexDirection="column">
            <Text color="yellow" bold>
              {isMultiSelectMode && selectedCustomerIds.size > 0 ? (
                `Batch Actions for ${selectedCustomerIds.size} selected customers`
              ) : selectedCustomer ? (
                `Actions for: ${selectedCustomer.customer.name || selectedCustomer.customer.id.slice(0, 12)}`
              ) : (
                'Actions'
              )}
            </Text>
            <Box marginTop={1} flexDirection="column">
              {externalActions.actions.map((action, index) => {
                const isSelected = index === externalActions.selectedActionIndex;
                const isExecuting = externalActions.executingActionId === action.id;
                const showStatus = isExecuting && externalActions.currentStatus;
                
                return (
                  <Box key={action.id} flexDirection="column">
                    <Box flexDirection="row" alignItems="center">
                      <Text
                        color={isSelected ? 'black' : 'white'}
                        backgroundColor={isSelected ? 'yellow' : undefined}
                      >
                        {isSelected ? '→ ' : '  '}{index + 1}. {action.label}
                      </Text>
                      {isExecuting && (
                        <Box marginLeft={1} flexDirection="row" alignItems="center">
                          <Spinner />
                          <Text color="cyan" marginLeft={1}>
                            {externalActions.isLoading ? 'Running...' : 'Done'}
                          </Text>
                        </Box>
                      )}
                    </Box>
                    {showStatus && (
                      <Text color="gray" marginLeft={4}>
                        Status: {externalActions.currentStatus}
                      </Text>
                    )}
                  </Box>
                );
              })}
            </Box>
            <Text color="gray" marginTop={1}>
              {externalActions.isLoading ? 
                'Executing action... Please wait' : 
                'Use ↑↓ to navigate, Enter to select, Esc to cancel'
              }
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};

// Overall Summary Component (updated to use credit system)
interface OverallSummaryProps {
  totalCustomers: number;
  grandTotalSubscriptionRevenue: number;
  grandTotalCredits: number;
  planCount: number;
  config: BillingAnalysisConfig;
}

const OverallSummary: React.FC<OverallSummaryProps> = ({
  totalCustomers,
  grandTotalSubscriptionRevenue,
  grandTotalCredits,
  planCount,
  config
}) => {
  const grandTotalRevenue = grandTotalSubscriptionRevenue + grandTotalCredits;

  const summaryData = [
    {
      Metric: '👥 Total Customers',
      Value: totalCustomers.toString()
    },
    {
      Metric: '💵 Subscription Revenue',
      Value: `$${grandTotalSubscriptionRevenue.toFixed(2)}/month`
    },
    {
      Metric: `⚡ ${config.creditSystem.primary.displayName}`,
      Value: config.creditSystem.primary.formatter ?
        config.creditSystem.primary.formatter(grandTotalCredits) :
        `$${grandTotalCredits.toFixed(2)}`
    },
    {
      Metric: 'Total Revenue',
      Value: `$${grandTotalRevenue.toFixed(2)}`
    },
    {
      Metric: '📈 Avg Revenue/Customer',
      Value: `$${(grandTotalRevenue / totalCustomers).toFixed(2)}`
    },
    {
      Metric: '🎯 Active Plan Types',
      Value: planCount.toString()
    },
    {
      Metric: '💰 Monthly Recurring Revenue (MRR)',
      Value: `$${grandTotalSubscriptionRevenue.toFixed(2)}`
    }
  ];

  const columns = [
    { key: 'Metric', label: 'Metric', width: 35 },
    { key: 'Value', label: 'Value', width: 25, align: 'right' as const }
  ];

  return (
    <Box flexDirection="column" borderStyle="double" borderColor="magenta" padding={1}>
      <Text color="magenta" bold>OVERALL SUMMARY</Text>
      <Box marginTop={1}>
        <CustomTable data={summaryData} columns={columns} />
      </Box>
    </Box>
  );
};

// Plan Summary Table Component (unchanged)
interface PlanSummaryTableProps {
  planAnalysis: PlanAnalysis;
  totalCustomers: number;
  selectedIndex?: number;
}

const PlanSummaryTable: React.FC<PlanSummaryTableProps> = ({ planAnalysis, totalCustomers, selectedIndex = 0 }) => {
  const sortedPlans = Object.entries(planAnalysis).sort(([, a], [, b]) => b.customerCount - a.customerCount);

  const tableData = sortedPlans.map(([planName, data], index) => {
    const percentage = ((data.customerCount / totalCustomers) * 100).toFixed(1);
    const totalRevenue = data.totalSubscriptionRevenue + data.totalCreditsUsed;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentSignups = data.creationDates.filter(date => date > thirtyDaysAgo).length;

    return {
      Plan: planName,
      Customers: `${data.customerCount} (${percentage}%)`,
      'Plan Price': `$${data.planPrice.toFixed(2)}/mo`,
      'Sub Revenue': `$${data.totalSubscriptionRevenue.toFixed(2)}`,
      'Credits': `$${data.totalCreditsUsed.toFixed(2)}`,
      'Total Rev': `$${totalRevenue.toFixed(2)}`,
      'Recent': recentSignups.toString(),
      _isSelected: index === selectedIndex
    };
  });

  const columns = [
    { key: 'Plan', label: 'Plan Name', width: 22 },
    { key: 'Customers', label: 'Customers', width: 15 },
    { key: 'Plan Price', label: 'Plan Price', width: 12, align: 'right' as const },
    { key: 'Sub Revenue', label: 'Sub Revenue', width: 12, align: 'right' as const },
    { key: 'Credits', label: 'Credits', width: 10, align: 'right' as const },
    { key: 'Total Rev', label: 'Total Rev', width: 10, align: 'right' as const },
    { key: 'Recent', label: 'Recent', width: 8, align: 'center' as const }
  ];

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="blue" padding={1}>
      <Text color="blue" bold>Plans Overview (Use Up/Down to navigate, Enter to view customers)</Text>
      <Box marginTop={1}>
        <CustomTableWithHighlight data={tableData} columns={columns} />
      </Box>
    </Box>
  );
};

// Main App Component with configurable setup
interface BillingAnalysisAppProps {
  config?: BillingAnalysisConfig;
}

const BillingAnalysisApp: React.FC<BillingAnalysisAppProps> = ({
  config = defaultConfig
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalFetched, setTotalFetched] = useState(0);
  const [planAnalysis, setPlanAnalysis] = useState<PlanAnalysis>({});
  const [livePlanPrices, setLivePlanPrices] = useState<{ [key: string]: number }>({});
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(0);
  const [view, setView] = useState<'loading' | 'plans' | 'customers' | 'summary'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [grandTotalSubscriptionRevenue, setGrandTotalSubscriptionRevenue] = useState(0);
  const [grandTotalCredits, setGrandTotalCredits] = useState(0);
  const [isAnyMenuOpen, setIsAnyMenuOpen] = useState(false);
  const [isAnyModalOpen, setIsAnyModalOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const sortedPlans = Object.entries(planAnalysis).sort(([, a], [, b]) => b.customerCount - a.customerCount);
  const creditSystem = useCreditSystem(config.creditSystem);

  useInput((input, key) => {
    // Always allow quit, but block other inputs when modal/search is open
    // if ((input === 'q' || input === 'Q')) {
    //   process.exit(0);
    //   return;
    // }

    // Handle help screen at app level
    if (isHelpOpen) {
      if (key.escape || input === 'h' || input === 'H') {
        setIsHelpOpen(false);
      }
      return;
    }

    // Block ALL other key handling when any modal or search is open
    // This prevents interference with text input in search mode
    if (isAnyModalOpen) {
      return;
    }

    if (view === 'plans') {
      if (key.upArrow && selectedPlanIndex > 0) {
        setSelectedPlanIndex(selectedPlanIndex - 1);
      } else if (key.downArrow && selectedPlanIndex < sortedPlans.length - 1) {
        setSelectedPlanIndex(selectedPlanIndex + 1);
      } else if (key.return) {
        setView('customers');
      }
    }

    if (key.escape) {
      if (view === 'customers') {
        setView('plans');
      } else {
        process.exit(0);
      }
    } else if (input === '1') {
      setView('plans');
    } else if (input === '2') {
      setView('customers');
    } else if (input === '3') {
      setView('summary');
    } else if (input === 'h' || input === 'H') {
      setIsHelpOpen(true);
    } else if (key.backspace || input === 'b') {
      if (view === 'customers') {
        setView('plans');
      }
    }
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch products and build price lookup
        const products = await autumn.products.list();
        const pricesLookup: { [key: string]: number } = {};

        if (products?.data?.list) {
          products.data.list.forEach((product: any) => {
            if (product.group === "plan" && product.items?.length > 0) {
              const priceItem = product.items.find((item: any) => item.type === "price");
              if (priceItem) {
                let price = priceItem.price || 0;
                if (priceItem.interval === "year") {
                  price = price / 12;
                }
                pricesLookup[product.id] = price;
                if (product.name) {
                  pricesLookup[product.name] = price;
                }
              }
            }
          });
        }

        setLivePlanPrices(pricesLookup);

        // Fetch customers
        let allCustomers: Customer[] = [];
        let offset = 0;
        let pageNum = 1;
        const limit = 100;
        let customers: Customer[] = [];

        do {
          setCurrentPage(pageNum);

          const response = await autumn.customers.list({
            offset: offset,
            limit: limit
          });

          customers = response.data?.list || [];

          if (customers.length === 0) {
            break;
          }

          allCustomers.push(...customers);
          setTotalFetched(allCustomers.length);

          offset += limit;
          pageNum++;

          await new Promise(resolve => setTimeout(resolve, 100));

        } while (customers.length === limit);

        // Process analysis
        const analysis: PlanAnalysis = {};
        let totalSubscriptionRevenue = 0;
        let totalCredits = 0;

        const getPlanPrice = (plan: any): number => {
          if (!plan) return 0;
          if (plan.id && pricesLookup[plan.id] !== undefined) {
            return pricesLookup[plan.id];
          }
          if (plan.name && pricesLookup[plan.name] !== undefined) {
            return pricesLookup[plan.name];
          }
          return 0;
        };

        allCustomers.forEach((customer: Customer) => {
          const activePlan = customer.products?.find((p: any) => p.status === "active" && p.group === "plan");
          const planName = activePlan?.name || "No Active Plan";

          // Use configurable credit system
          const credits = creditSystem.getCreditsForCustomer(customer);
          const creditsUsed = credits.total;
          const planPrice = getPlanPrice(activePlan);

          totalCredits += creditsUsed;
          totalSubscriptionRevenue += planPrice;

          if (!analysis[planName]) {
            analysis[planName] = {
              customers: [],
              totalCreditsUsed: 0,
              avgCreditsPerCustomer: 0,
              customerCount: 0,
              environments: {},
              hasStripeIds: 0,
              creationDates: [],
              planPrice: planPrice,
              totalSubscriptionRevenue: 0,
              avgMonthlyRevenuePerCustomer: 0
            };
          }

          const planGroup = analysis[planName];
          planGroup.customers.push(customer);
          planGroup.totalCreditsUsed += creditsUsed;
          planGroup.totalSubscriptionRevenue += planPrice;
          planGroup.customerCount++;

          const env = customer.env || "unknown";
          planGroup.environments[env] = (planGroup.environments[env] || 0) + 1;

          if (customer.stripe_id) {
            planGroup.hasStripeIds++;
          }

          if (customer.created_at) {
            planGroup.creationDates.push(new Date(customer.created_at));
          }
        });

        // Calculate averages
        Object.values(analysis).forEach(data => {
          data.avgCreditsPerCustomer = data.totalCreditsUsed / data.customerCount;
          data.avgMonthlyRevenuePerCustomer = (data.totalSubscriptionRevenue + data.totalCreditsUsed) / data.customerCount;
        });

        setPlanAnalysis(analysis);
        setGrandTotalSubscriptionRevenue(totalSubscriptionRevenue);
        setGrandTotalCredits(totalCredits);
        setIsLoading(false);
        setView('plans');

      } catch (error) {
        setError(error instanceof Error ? error.message : 'An error occurred');
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (error) {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center">
        <Text color="red" bold>❌ Error: {error}</Text>
        <Text color="gray">Press 'q' to exit</Text>
      </Box>
    );
  }

  if (view === 'loading') {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center">
        <LoadingProgress
          currentPage={currentPage}
          totalFetched={totalFetched}
          isLoading={isLoading}
        />
        <Text color="gray" marginTop={1}>Analyzing customer data...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box flexDirection="row" justifyContent="space-between" marginBottom={1}>
        <Text color="magenta" bold>ATMN CLI Max</Text>
        <Box flexDirection="row" gap={2}>
          <Text color={view === 'plans' ? 'yellow' : 'gray'}>[1] Plans</Text>
          <Text color={view === 'customers' ? 'yellow' : 'gray'}>[2] Customers</Text>
          <Text color={view === 'summary' ? 'yellow' : 'gray'}>[3] Summary</Text>
          <Text color="gray">[H] Help</Text>
        </Box>
      </Box>

      {view === 'plans' && (
        <PlanSummaryTable
          planAnalysis={planAnalysis}
          totalCustomers={totalFetched}
          selectedIndex={selectedPlanIndex}
        />
      )}

      {view === 'customers' && sortedPlans[selectedPlanIndex] && (
        <CustomerTable
          customers={sortedPlans[selectedPlanIndex][1].customers}
          planName={sortedPlans[selectedPlanIndex][0]}
          livePlanPrices={livePlanPrices}
          onMenuStateChange={setIsAnyMenuOpen}
          onModalStateChange={setIsAnyModalOpen}
          config={config}
        />
      )}

      {view === 'summary' && (
        <OverallSummary
          totalCustomers={totalFetched}
          grandTotalSubscriptionRevenue={grandTotalSubscriptionRevenue}
          grandTotalCredits={grandTotalCredits}
          planCount={Object.keys(planAnalysis).length}
          config={config}
        />
      )}

      {/* Global Help Screen */}
      {isHelpOpen && (
        <FullScreenDetails
          isOpen={isHelpOpen}
          onClose={() => setIsHelpOpen(false)}
          title="Help - Keyboard Shortcuts"
        >
          <Box flexDirection="column" padding={2}>
            <Text color="cyan" bold marginBottom={2}>🔧 ATMN CLI Max - Keyboard Shortcuts</Text>
            
            <Box flexDirection="column" marginBottom={2}>
              <Text color="yellow" bold>Global Navigation:</Text>
              <Box flexDirection="column" marginLeft={2}>
                <Text>• 1 - View Plans overview</Text>
                <Text>• 2 - View Customers (current plan)</Text>
                <Text>• 3 - View Overall Summary</Text>
                <Text>• H - Toggle this help screen</Text>
                <Text>• Q - Quit application</Text>
                <Text>• Esc - Go back / Close modals</Text>
              </Box>
            </Box>

            <Box flexDirection="column" marginBottom={2}>
              <Text color="yellow" bold>Plans View:</Text>
              <Box flexDirection="column" marginLeft={2}>
                <Text>• ↑/↓ - Select plan</Text>
                <Text>• Enter - View customers for selected plan</Text>
              </Box>
            </Box>

            <Box flexDirection="column" marginBottom={2}>
              <Text color="yellow" bold>Customer List Navigation:</Text>
              <Box flexDirection="column" marginLeft={2}>
                <Text>• ↑/↓ (Up/Down Arrows) - Select customer</Text>
                <Text>• ←/→ (Left/Right Arrows) - Navigate pages</Text>
                <Text>• P/N - Previous/Next page</Text>
                <Text>• Enter - Open actions menu for selected customer(s)</Text>
                <Text>• L - Open full screen customer details</Text>
                <Text>• M - Toggle multi-select mode</Text>
                <Text>• S - Toggle selection (when in multi-select mode)</Text>
                <Text>• A - Toggle all visible customers (when in multi-select mode)</Text>
              </Box>
            </Box>

            <Box flexDirection="column" marginBottom={2}>
              <Text color="yellow" bold>Search & Filter:</Text>
              <Box flexDirection="column" marginLeft={2}>
                <Text>• F - Enter fuzzy search mode</Text>
                <Text>• C - Clear current search</Text>
                <Text>• I - Toggle $0 credit filter (hide/show)</Text>
              </Box>
            </Box>

            <Box flexDirection="column" marginBottom={2}>
              <Text color="yellow" bold>Actions Menu (when open):</Text>
              <Box flexDirection="column" marginLeft={2}>
                <Text>• ↑/↓ - Navigate actions</Text>
                <Text>• Enter - Execute selected action</Text>
                <Text>• Esc - Close actions menu</Text>
              </Box>
            </Box>

            <Box flexDirection="column" marginBottom={2}>
              <Text color="yellow" bold>Search Mode (when active):</Text>
              <Box flexDirection="column" marginLeft={2}>
                <Text>• Type to search customers</Text>
                <Text>• Enter - Apply search and exit search mode</Text>
                <Text>• Esc - Cancel search and exit search mode</Text>
              </Box>
            </Box>

            <Text color="gray" marginTop={2}>
              Press H or Esc to close this help screen
            </Text>
          </Box>
        </FullScreenDetails>
      )}

      {/* <Box marginTop={1} borderStyle="single" borderColor="gray" padding={1}>
        <Text color="gray">
          Press H.
        </Text>
      </Box> */}
    </Box>
  );
};

// Export the app with different configurations
export const createBillingApp = (config?: BillingAnalysisConfig) => {
  return () => <BillingAnalysisApp config={config} />;
};

// Default export with default config
const DefaultApp = () => <BillingAnalysisApp config={defaultConfig} />;

// Render the app
render(<DefaultApp />);
