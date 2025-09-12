#!/usr/bin/env bun
import React, { useState, useEffect } from 'react';
import { render, Box, Text, Spacer, useInput } from 'ink';
import { Spinner } from '@inkjs/ui';
import { Autumn } from "autumn-js";

// Import external modules
import { useExternalActions, type ExternalActionsConfig } from './external-actions';
import { useCreditSystem, getCustomerCredits, type CreditSystemConfig } from './credit-system';
import { useCustomerDetails, type Customer, type CustomerDetailsProps } from './customer-details';
import { type BillingAnalysisConfig, defaultConfig, configurations } from './billing-config';

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

const CustomTable: React.FC<CustomTableProps> = ({ data, columns }) => {
  if (data.length === 0) return <Text color="gray">No data available</Text>;

  const tableColumns = columns || Object.keys(data[0]).map(key => ({
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

  const tableColumns = columns || Object.keys(data[0])
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
        const prefix = isSelected ? '→ ' : '  ';
        return (
          <Text
            key={rowIndex}
            color={isSelected ? 'black' : 'white'}
            backgroundColor={isSelected ? 'yellow' : undefined}
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
  config: BillingAnalysisConfig;
}

const CustomerTable: React.FC<CustomerTableProps> = ({
  customers,
  planName,
  livePlanPrices,
  onMenuStateChange,
  config
}) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedCustomerIndex, setSelectedCustomerIndex] = useState(0);
  const [hideZeroCreditUsers, setHideZeroCreditUsers] = useState(false);

  const itemsPerPage = config.ui?.itemsPerPage || 10;

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
      };
    })
    .filter(({ creditsUsed }) => !hideZeroCreditUsers || creditsUsed > 0)
    .sort((a, b) => b.totalValue - a.totalValue);

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
  }, [externalActions.isMenuOpen, onMenuStateChange]);

  const handleOptionSelect = () => {
    const customer = currentCustomers[selectedCustomerIndex].customer;
    externalActions.executeSelectedAction(customer.id, customer);
  };

  useInput((input, key) => {
    // Handle options menu navigation
    if (externalActions.isMenuOpen) {
      if (key.upArrow) {
        externalActions.navigateUp();
      } else if (key.downArrow) {
        externalActions.navigateDown();
      } else if (key.return) {
        handleOptionSelect();
      } else if (key.escape) {
        externalActions.closeMenu();
      }
      return; // Don't handle other navigation when menu is open
    }

    // Handle main table navigation
    if (key.leftArrow && currentPage > 0) {
      setCurrentPage(currentPage - 1);
    } else if (key.rightArrow && currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    } else if (key.upArrow && selectedCustomerIndex > 0) {
      setSelectedCustomerIndex(selectedCustomerIndex - 1);
    } else if (key.downArrow && selectedCustomerIndex < currentCustomers.length - 1) {
      setSelectedCustomerIndex(selectedCustomerIndex + 1);
    } else if (key.return && currentCustomers[selectedCustomerIndex]) {
      externalActions.openMenu();
    } else if (input === 'f' || input === 'F') {
      setHideZeroCreditUsers(!hideZeroCreditUsers);
    } else if (input === 'd' || input === 'D') {
      customerDetails.toggleDetails();
    }
  });

  // Prepare data for custom table
  const tableData = currentCustomers.map(({ customer, planPrice, creditsUsed, totalValue }, index) => {
    const credits = creditSystem.getCreditsForCustomer(customer);
    return {
      ID: customer.id.slice(0, 8) + '...',
      Name: (customer.name || 'N/A').slice(0, 15),
      Email: (customer.email || 'N/A').slice(0, 22),
      'Plan ($)': planPrice.toFixed(2),
      'Credits ($)': credits.primary.formatted,
      'Total ($)': totalValue.toFixed(2),
      Stripe: customer.stripe_id ? '✓' : '✗',
      Env: (customer.env || 'unknown').slice(0, 5),
      _isSelected: index === selectedCustomerIndex
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
    <Box flexDirection="column" borderStyle="round" borderColor="green" padding={1}>
      <Box flexDirection="row" justifyContent="space-between" alignItems="center">
        <Text color="green" bold>
          {planName} Customers (Page {currentPage + 1}/{totalPages})
        </Text>
        <Text color={hideZeroCreditUsers ? 'yellow' : 'gray'}>
          {hideZeroCreditUsers
            ? `Showing ${filteredCount}/${totalCustomersBeforeFilter} (hiding $0 credits)`
            : `Showing all ${totalCustomersBeforeFilter} customers`
          }
        </Text>
      </Box>

      <Text color="gray">
        Left/right: pages, up/down: select, Enter: options, F: toggle $0 filter, D: toggle details, Esc: back
      </Text>

      <Box marginTop={1}>
        <CustomTableWithHighlight data={tableData} columns={columns} />
      </Box>

      {/* Customer Details */}
      {customerDetails.showDetails && selectedCustomer && (
        <customerDetails.DetailsComponent
          customer={selectedCustomer.customer}
          planName={planName}
          planPrice={selectedCustomer.planPrice}
          creditSystem={config.creditSystem}
        />
      )}

      {/* Options Menu */}
      {externalActions.isMenuOpen && selectedCustomer && (
        <Box
          marginTop={2}
          borderStyle="round"
          borderColor="yellow"
          padding={1}
          backgroundColor="black"
        >
          <Box flexDirection="column">
            <Text color="yellow" bold>
              Open Customer: {selectedCustomer.customer.id}
            </Text>
            <Box marginTop={1} flexDirection="column">
              {externalActions.actions.map((action, index) => (
                <Text
                  key={action.id}
                  color={index === externalActions.selectedActionIndex ? 'black' : 'white'}
                  backgroundColor={index === externalActions.selectedActionIndex ? 'yellow' : undefined}
                >
                  {index === externalActions.selectedActionIndex ? '→ ' : '  '}{index + 1}. {action.label}
                </Text>
              ))}
            </Box>
            <Text color="gray" marginTop={1}>Use ↑↓ to navigate, Enter to select, Esc to cancel</Text>
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

  const sortedPlans = Object.entries(planAnalysis).sort(([, a], [, b]) => b.customerCount - a.customerCount);
  const creditSystem = useCreditSystem(config.creditSystem);

  useInput((input, key) => {
    if (view === 'plans') {
      if (key.upArrow && selectedPlanIndex > 0) {
        setSelectedPlanIndex(selectedPlanIndex - 1);
      } else if (key.downArrow && selectedPlanIndex < sortedPlans.length - 1) {
        setSelectedPlanIndex(selectedPlanIndex + 1);
      } else if (key.return) {
        setView('customers');
      }
    }

    if (input === 'q') {
      process.exit(0);
    } else if (key.escape && !isAnyMenuOpen) {
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
          <Text color="gray">[Q] Quit</Text>
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

      <Box marginTop={1} borderStyle="single" borderColor="gray" padding={1}>
        <Text color="gray">
          Navigation: {view === 'plans' ? 'Up/Down: Select Plan, Enter: View Customers' :
            view === 'customers' ? 'Left/Right: Navigate Pages, Up/Down: Select Customer, Enter: Show Options, F: Toggle $0 Filter, D: Toggle Details, Esc: Back to Plans' :
              'Use number keys to switch views'} | Q: Quit
        </Text>
      </Box>
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
