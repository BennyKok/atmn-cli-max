/**
 * Billing Analysis Scripts - Index Export
 * 
 * This is the main entry point for the modular billing analysis system.
 * 
 * Quick Start:
 * ```typescript
 * import { createBillingApp, configurations } from './atmn-cli-max';
 * 
 * // Use default configuration
 * const app = createBillingApp();
 * 
 * // Use pre-configured setup
 * const tokenApp = createBillingApp(configurations.tokenBased);
 * 
 * // Custom configuration
 * import { createConfig } from './atmn-cli-max';
 * const customApp = createBillingApp(
 *   createConfig()
 *     .withCreditSystem(alternativeCreditSystems.tokens)
 *     .withItemsPerPage(15)
 *     .build()
 * );
 * ```
 * 
 * Main Components:
 * - createBillingApp: Main application factory
 * - createConfig/ConfigBuilder: Configuration system
 * - configurations: Pre-built configurations
 * - Credit system: Configurable credit/token handling
 * - External actions: Custom action handlers
 * - Customer details: Configurable detail views
 */

// Main Application
export { createBillingApp } from './main';

// Configuration System
export type { BillingAnalysisConfig } from './billing-config';
export {
  defaultConfig,
  configurations,
  ConfigBuilder,
  createConfig,
  exampleCustomConfigurations
} from './billing-config';

// External Actions
export type { 
  ActionOption,
  ExternalActionsConfig 
} from './external-actions';
export {
  defaultActionsConfig,
  executeAction,
  useExternalActions
} from './external-actions';

// Credit System
export type {
  CreditConfig,
  CreditSystemConfig
} from './credit-system';
export {
  alternativeCreditSystems,
  getCustomerCredits,
  formatCreditAmount,
  getCreditBalance,
  useCreditSystem
} from './credit-system';

// Customer Details
export type {
  Customer,
  CustomerDetailsProps,
  CustomCustomerDetailsConfig
} from './customer-details';
export {
  DefaultCustomerDetails,
  CompactCustomerDetails,
  customerDetailsConfigs,
  useCustomerDetails
} from './customer-details';

// Re-export everything for convenience
export * from './main';
export * from './billing-config';
export * from './external-actions';
export * from './credit-system';
export * from './customer-details';
