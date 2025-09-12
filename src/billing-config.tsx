import { type ExternalActionsConfig, defaultActionsConfig } from './';
import { type CreditSystemConfig, alternativeCreditSystems } from './';
import { type CustomCustomerDetailsConfig, customerDetailsConfigs } from './';

// Main configuration interface
export interface BillingAnalysisConfig {
  actions: ExternalActionsConfig;
  creditSystem: CreditSystemConfig;
  customerDetails: CustomCustomerDetailsConfig;
  ui?: {
    itemsPerPage?: number;
    colors?: {
      primary?: string;
      secondary?: string;
      accent?: string;
    };
  };
}

// Default configuration
export const defaultConfig: BillingAnalysisConfig = {
  actions: defaultActionsConfig,
  creditSystem: alternativeCreditSystems.tokens,
  customerDetails: customerDetailsConfigs.default,
  ui: {
    itemsPerPage: 10,
    colors: {
      primary: 'cyan',
      secondary: 'yellow',
      accent: 'green'
    }
  }
};

// Pre-configured setups for different use cases
export const configurations = {
  // Default configuration
  default: defaultConfig,

  // Token-based system
  tokenBased: {
    ...defaultConfig,
    creditSystem: alternativeCreditSystems.tokens,
    customerDetails: customerDetailsConfigs.compact
  },

  // Multi-credit system
  multiCredit: {
    ...defaultConfig,
    creditSystem: alternativeCreditSystems.multiCredit,
    customerDetails: customerDetailsConfigs.default
  },

  // Compact view for large datasets
  compact: {
    ...defaultConfig,
    customerDetails: customerDetailsConfigs.compact,
    ui: {
      ...defaultConfig.ui,
      itemsPerPage: 15
    }
  }
};

// Custom configuration builder
export class ConfigBuilder {
  private config: BillingAnalysisConfig;

  constructor(baseConfig: BillingAnalysisConfig = defaultConfig) {
    this.config = { ...baseConfig };
  }

  withActions(actions: ExternalActionsConfig): ConfigBuilder {
    this.config.actions = actions;
    return this;
  }

  withCreditSystem(creditSystem: CreditSystemConfig): ConfigBuilder {
    this.config.creditSystem = creditSystem;
    return this;
  }

  withCustomerDetails(customerDetails: CustomCustomerDetailsConfig): ConfigBuilder {
    this.config.customerDetails = customerDetails;
    return this;
  }

  withItemsPerPage(count: number): ConfigBuilder {
    if (!this.config.ui) this.config.ui = {};
    this.config.ui.itemsPerPage = count;
    return this;
  }

  build(): BillingAnalysisConfig {
    return this.config;
  }
}

// Helper function to create custom config
export const createConfig = (baseConfig?: BillingAnalysisConfig): ConfigBuilder => {
  return new ConfigBuilder(baseConfig);
};

// Example of how to create custom configurations
export const exampleCustomConfigurations = {
  // Custom actions with Slack integration
  customActionsConfig: createConfig()
    .withActions({
      actions: [
        ...defaultActionsConfig.actions,
        {
          id: 'slack',
          label: 'Send to Slack',
          description: 'Send customer info to Slack channel',
          handler: async (customerId: string, customer: any) => {
            // Custom Slack integration logic here
            console.log(`Sending ${customerId} info to Slack...`);
          }
        }
      ]
    })
    .build(),

  // Custom credit system for different business model
  customCreditConfig: createConfig()
    .withCreditSystem({
      primary: {
        key: 'compute-units',
        name: 'Compute Units',
        displayName: 'Compute Units',
        currency: '',
        divisor: 1,
        formatter: (amount: number) => `${Math.round(amount)} CU`
      }
    })
    .build()
};

export default defaultConfig;
