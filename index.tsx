#!/usr/bin/env bun
/**
 * ATMN CLI Max - Simple Usage Example
 * 
 * This is a minimal example showing how to use ATMN CLI Max
 * with the default configuration.
 */

import { render } from 'ink';
import { createBillingApp } from './src/index';
import React from 'react';

// Simple usage with default configuration
const DefaultBillingApp = createBillingApp();

console.log(`
🚀 ATMN CLI Max - Simple Example

Starting with default configuration:
- Token-based credit system
- Standard actions (Open in Autumn)  
- Default customer details view
- 10 items per page

Environment: Make sure AUTUMN_PROD_SECRET_KEY is set

Navigation:
- ↑↓: Navigate plans/customers
- Enter: Select/open actions
- F: Toggle $0 filter  
- D: Toggle details
- Q: Quit

Loading customer data...
`);

// Render the application
render(<DefaultBillingApp />);
