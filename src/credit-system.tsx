// Types for credit system
export interface CreditConfig {
  key: string;
  name: string;
  displayName: string;
  currency: string;
  divisor: number;
  formatter?: (amount: number) => string;
}

export interface CreditSystemConfig {
  primary: CreditConfig;
  secondary?: CreditConfig[];
}

// Credit system examples - choose one that fits your needs

// Alternative credit system examples
export const alternativeCreditSystems = {
  tokens: {
    primary: {
      key: 'ai-tokens',
      name: 'AI Tokens',
      displayName: 'Tokens',
      currency: '',
      divisor: 1,
      formatter: (amount: number) => `${Math.round(amount)} tokens`
    }
  },
  
  points: {
    primary: {
      key: 'reward-points',
      name: 'Reward Points',
      displayName: 'Points',
      currency: '',
      divisor: 1,
      formatter: (amount: number) => `${Math.round(amount)} pts`
    }
  },

  multiCredit: {
    primary: {
      key: 'gpu-credit',
      name: 'GPU Credits',
      displayName: 'GPU Credits',
      currency: '$',
      divisor: 100,
      formatter: (amount: number) => `$${amount.toFixed(2)}`
    },
    secondary: [
      {
        key: 'cpu-credit',
        name: 'CPU Credits',
        displayName: 'CPU Credits',
        currency: '$',
        divisor: 100,
        formatter: (amount: number) => `$${amount.toFixed(2)}`
      },
      {
        key: 'storage-credit',
        name: 'Storage Credits', 
        displayName: 'Storage',
        currency: '$',
        divisor: 100,
        formatter: (amount: number) => `$${amount.toFixed(2)}`
      }
    ]
  }
};

// Helper functions
export const getCustomerCredits = (customer: any, config: CreditSystemConfig) => {
  const primaryCredit = customer.features?.[config.primary.key];
  const primaryAmount = primaryCredit ? Math.max(0, -(primaryCredit.balance ?? 0) / config.primary.divisor) : 0;
  
  const secondaryCredits = config.secondary?.map(creditConfig => {
    const credit = customer.features?.[creditConfig.key];
    const amount = credit ? Math.max(0, -(credit.balance ?? 0) / creditConfig.divisor) : 0;
    return {
      config: creditConfig,
      amount,
      formatted: creditConfig.formatter ? creditConfig.formatter(amount) : `${amount}`
    };
  }) || [];

  return {
    primary: {
      config: config.primary,
      amount: primaryAmount,
      formatted: config.primary.formatter ? config.primary.formatter(primaryAmount) : `${primaryAmount}`
    },
    secondary: secondaryCredits,
    total: primaryAmount + secondaryCredits.reduce((sum, sc) => sum + sc.amount, 0)
  };
};

export const formatCreditAmount = (amount: number, config: CreditConfig) => {
  if (config.formatter) {
    return config.formatter(amount);
  }
  return `${config.currency}${amount.toFixed(2)}`;
};

export const getCreditBalance = (customer: any, creditKey: string, divisor: number = 100) => {
  const credit = customer.features?.[creditKey];
  return credit ? Math.max(0, -(credit.balance ?? 0) / divisor) : 0;
};

// Hook for using credit system
export const useCreditSystem = (config: CreditSystemConfig) => {
  const getCreditsForCustomer = (customer: any) => getCustomerCredits(customer, config);
  
  const formatCredit = (amount: number, creditConfig: CreditConfig = config.primary) => 
    formatCreditAmount(amount, creditConfig);

  return {
    config,
    getCreditsForCustomer,
    formatCredit
  };
};
