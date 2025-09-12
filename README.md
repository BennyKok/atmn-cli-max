# ATMN CLI Max

A modular, configurable billing analysis CLI tool built with React Ink for analyzing customer billing data from Autumn.

<img width="1634" height="624" alt="Cursor 2025-09-11 18 11 48" src="https://github.com/user-attachments/assets/7b5cb22f-1897-4d37-bf5b-94e38452c575" />

## Quick Start

```bash
# Run with default configuration  
bun run simple-example.tsx
```

## Architecture

ATMN CLI Max is built with modularity in mind:

- **Main App** (`analyse-ink-refactored.tsx`): Core application logic
- **Configuration** (`billing-config.tsx`): Centralized configuration system  
- **Credit System** (`credit-system.tsx`): Configurable credit/token handling
- **External Actions** (`external-actions.tsx`): Custom action handlers
- **Customer Details** (`customer-details.tsx`): Configurable detail views

## Usage Examples

### Basic Usage

```typescript
import { createBillingApp } from './index';
import { render } from 'ink';

// Default configuration
const app = createBillingApp();
render(app());
```

### Using Pre-configured Setups

```typescript
import { createBillingApp, configurations } from './index';

// Token-based system
const tokenApp = createBillingApp(configurations.tokenBased);

// Multi-credit system
const multiApp = createBillingApp(configurations.multiCredit);

// Compact view for large datasets
const compactApp = createBillingApp(configurations.compact);
```

### Custom Configuration

```typescript
import { 
  createBillingApp, 
  createConfig,
  alternativeCreditSystems,
  customerDetailsConfigs 
} from './index';

const customApp = createBillingApp(
  createConfig()
    .withCreditSystem(alternativeCreditSystems.tokens)
    .withCustomerDetails(customerDetailsConfigs.compact)
    .withItemsPerPage(15)
    .build()
);
```

### Custom Actions

```typescript
import { createBillingApp, createConfig, ExternalActionsConfig } from './index';

const customActions: ExternalActionsConfig = {
  actions: [
    {
      id: 'slack',
      label: 'Send to Slack',
      description: 'Send customer info to Slack channel',
      handler: async (customerId: string, customer: any) => {
        // Your Slack integration logic
        await sendToSlack(customer);
      }
    }
  ]
};

const app = createBillingApp(
  createConfig()
    .withActions(customActions)
    .build()
);
```

### Custom Credit System

```typescript
import { createBillingApp, createConfig, CreditSystemConfig } from './index';

const customCredits: CreditSystemConfig = {
  primary: {
    key: 'compute-units',
    name: 'Compute Units',
    displayName: 'CU',
    currency: '',
    divisor: 1,
    formatter: (amount: number) => `${Math.round(amount)} CU`
  }
};

const app = createBillingApp(
  createConfig()
    .withCreditSystem(customCredits)
    .build()
);
```

## Available Exports

### Main Functions
- `createBillingApp(config?)` - Main application factory
- `createConfig(baseConfig?)` - Configuration builder helper

### Configuration
- `defaultConfig` - Default application configuration
- `configurations` - Pre-built configuration objects
- `ConfigBuilder` - Class for building custom configurations
- `exampleCustomConfigurations` - Example custom configurations

### Types
- `BillingAnalysisConfig` - Main configuration interface
- `ExternalActionsConfig` - External actions configuration
- `CreditSystemConfig` - Credit system configuration
- `Customer` - Customer data interface
- `CustomerDetailsProps` - Customer details component props

### Credit System
- `alternativeCreditSystems` - Pre-built credit system configurations
- `useCreditSystem(config)` - React hook for credit operations
- `getCustomerCredits(customer, config)` - Helper function

### Actions & UI
- `defaultActionsConfig` - Default action configuration  
- `useExternalActions(config)` - React hook for action management
- `customerDetailsConfigs` - Pre-built detail view configurations
- `useCustomerDetails(config)` - React hook for detail management

## Navigation

### Plans View
- `↑↓` - Navigate between plans
- `Enter` - View customers for selected plan
- `1-3` - Switch between views
- `Q` - Quit

### Customers View  
- `←→` - Navigate pages
- `↑↓` - Select customer
- `Enter` - Show action menu
- `F` - Toggle $0 credit filter
- `D` - Toggle customer details
- `Esc` - Back to plans view

### Action Menu
- `↑↓` - Navigate actions
- `Enter` - Execute selected action
- `Esc` - Close menu

## Environment Setup

Requires `AUTUMN_PROD_SECRET_KEY` environment variable for API access.

```bash
export AUTUMN_PROD_SECRET_KEY="your-secret-key-here"
bun run simple-example.tsx
```

## Key Features

### ✅ Modular Actions System
Replace hardcoded actions with configurable external actions:

```tsx
const customActions: ExternalActionsConfig = {
  actions: [
    {
      id: 'admin',
      label: 'Open in Admin',
      handler: (customerId: string) => {
        const url = `https://admin.example.com/user/${customerId}`;
        import('child_process').then(cp => cp.exec(`open "${url}"`));
      }
    },
    {
      id: 'slack',
      label: 'Send to Slack', 
      handler: async (customerId: string, customer: any) => {
        // Your Slack integration logic
        await sendToSlack(customer);
      }
    }
  ]
};
```

### ✅ Configurable Credit Systems
Replace hardcoded "gpu-credit" with flexible credit configurations:

```tsx
// Token-based system
const tokenSystem: CreditSystemConfig = {
  primary: {
    key: 'ai-tokens',
    name: 'AI Tokens',
    displayName: 'Tokens',
    currency: '',
    divisor: 1,
    formatter: (amount: number) => `${Math.round(amount)} tokens`
  }
};

// Multi-credit system
const multiCreditSystem: CreditSystemConfig = {
  primary: { key: 'gpu-credit', name: 'GPU Credits', ... },
  secondary: [
    { key: 'cpu-credit', name: 'CPU Credits', ... },
    { key: 'storage-credit', name: 'Storage Credits', ... }
  ]
};
```

### ✅ Custom Customer Details Components
Add custom detail views for selected customers:

```tsx
// Default detailed view
customerDetails: customerDetailsConfigs.default

// Compact view for large datasets  
customerDetails: customerDetailsConfigs.compact

// Or create your own custom component
```

## File Structure

```
atmn-cli-max/
├── index.ts                    # Main exports
├── simple-example.tsx          # Simple usage example
├── README.md                   # This file
├── analyse-ink-refactored.tsx  # Main application
├── billing-config.tsx          # Configuration system
├── credit-system.tsx           # Credit/token handling
├── external-actions.tsx        # Action handlers
└── customer-details.tsx        # Detail views
```

## Migration from Original

The original `analyse-ink.tsx` file had hardcoded elements that are now configurable:

```tsx
// OLD: Hardcoded actions
const openCustomerInAdmin = (customerId: string) => { ... };

// OLD: Hardcoded credit system  
const gpuCredit = customer.features?.["gpu-credit"];

// OLD: No customer details component
```

The new modular system replaces these with:

```tsx
// NEW: Configurable actions
const actions = useExternalActions(config.actions);

// NEW: Configurable credit system
const credits = creditSystem.getCreditsForCustomer(customer);

// NEW: Configurable customer details
<customerDetails.DetailsComponent customer={customer} ... />
```

## Contributing

To add new features:

1. **New Actions**: Add to `external-actions.tsx`
2. **New Credit Systems**: Add to `credit-system.tsx` 
3. **New Detail Components**: Add to `customer-details.tsx`
4. **New Configurations**: Add to `billing-config.tsx`

All changes are backwards compatible - the tool works with default configuration out of the box.
