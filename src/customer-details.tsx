import React from 'react';
import { Box, Text } from 'ink';
import { getCustomerCredits, type CreditSystemConfig } from './credit-system';

// Types
export interface Customer {
  id: string;
  name?: string;
  email?: string;
  stripe_id?: string;
  env?: string;
  created_at?: string;
  products?: any[];
  features?: {
    [key: string]: {
      balance?: number;
    };
  };
}

export interface CustomerDetailsProps {
  customer: Customer;
  planName: string;
  planPrice: number;
  creditSystem: CreditSystemConfig;
}

// Default customer details component
export const DefaultCustomerDetails: React.FC<CustomerDetailsProps> = ({ 
  customer, 
  planName, 
  planPrice,
  creditSystem
}) => {
  const credits = getCustomerCredits(customer, creditSystem);
  
  const createdDate = customer.created_at ? new Date(customer.created_at).toLocaleDateString() : 'Unknown';
  const activePlan = customer.products?.find(p => p.status === "active" && p.group === "plan");
  
  return (
    <Box 
      flexDirection="column" 
      borderStyle="round" 
      borderColor="cyan" 
      padding={1}
      marginTop={1}
    >
      <Text color="cyan" bold>📋 Customer Details</Text>
      
      <Box flexDirection="row" marginTop={1}>
        <Box flexDirection="column" width={30}>
          <Text>🆔 <Text color="yellow">ID:</Text> {customer.id}</Text>
          <Text>👤 <Text color="yellow">Name:</Text> {customer.name || 'N/A'}</Text>
          <Text>📧 <Text color="yellow">Email:</Text> {customer.email || 'N/A'}</Text>
          <Text>🏢 <Text color="yellow">Environment:</Text> {customer.env || 'Unknown'}</Text>
          <Text>📅 <Text color="yellow">Created:</Text> {createdDate}</Text>
        </Box>
        
        <Box flexDirection="column" width={30}>
          <Text>💳 <Text color="yellow">Stripe ID:</Text> {customer.stripe_id ? '✓ Connected' : '✗ Not Connected'}</Text>
          <Text>🎯 <Text color="yellow">Plan:</Text> {planName}</Text>
          <Text>💰 <Text color="yellow">Plan Price:</Text> ${planPrice.toFixed(2)}/month</Text>
          <Text>⚡ <Text color="yellow">{credits.primary.config.displayName}:</Text> {credits.primary.formatted}</Text>
          {credits.secondary.map((credit, index) => (
            <Text key={index}>
              ⚡ <Text color="yellow">{credit.config.displayName}:</Text> {credit.formatted}
            </Text>
          ))}
        </Box>
      </Box>

      {activePlan && (
        <Box marginTop={1}>
          <Text color="gray" bold>Plan Details:</Text>
          <Text color="gray">• Status: {activePlan.status}</Text>
          <Text color="gray">• Plan ID: {activePlan.id}</Text>
          {activePlan.created_at && (
            <Text color="gray">• Subscribed: {new Date(activePlan.created_at).toLocaleDateString()}</Text>
          )}
        </Box>
      )}
      
      <Box marginTop={1} borderStyle="single" borderColor="gray" padding={1}>
        <Text color="green">Total Monthly Value: ${(planPrice + credits.total).toFixed(2)}</Text>
      </Box>
    </Box>
  );
};

// Alternative compact customer details
export const CompactCustomerDetails: React.FC<CustomerDetailsProps> = ({ 
  customer, 
  planName, 
  planPrice,
  creditSystem
}) => {
  const credits = getCustomerCredits(customer, creditSystem);
  
  return (
    <Box 
      flexDirection="row" 
      borderStyle="single" 
      borderColor="blue" 
      padding={1}
      marginTop={1}
      justifyContent="space-between"
    >
      <Box flexDirection="column">
        <Text color="blue" bold>{customer.name || customer.email || 'Unknown'}</Text>
        <Text color="gray">{customer.id}</Text>
      </Box>
      
      <Box flexDirection="column" alignItems="flex-end">
        <Text>{planName} - <Text color="green">${planPrice.toFixed(2)}/mo</Text></Text>
        <Text>{credits.primary.config.displayName}: <Text color="yellow">{credits.primary.formatted}</Text></Text>
      </Box>
    </Box>
  );
};

// Customer details with custom renderer
export interface CustomCustomerDetailsConfig {
  component: React.FC<CustomerDetailsProps>;
  height?: number;
  showByDefault?: boolean;
}

export const customerDetailsConfigs = {
  default: {
    component: DefaultCustomerDetails,
    height: 12,
    showByDefault: false
  },
  compact: {
    component: CompactCustomerDetails,
    height: 4,
    showByDefault: true
  }
};

// Hook for managing customer details
export const useCustomerDetails = (config: CustomCustomerDetailsConfig = customerDetailsConfigs.default) => {
  const [showDetails, setShowDetails] = React.useState(config.showByDefault || false);
  
  const toggleDetails = () => setShowDetails(!showDetails);
  const hideDetails = () => setShowDetails(false);
  const showDetailsView = () => setShowDetails(true);
  
  return {
    showDetails,
    toggleDetails,
    hideDetails,
    showDetailsView,
    DetailsComponent: config.component,
    height: config.height || 12
  };
};
