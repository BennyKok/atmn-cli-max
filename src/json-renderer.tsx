import React, { useState } from 'react';
import { Box, Static, Text, useInput } from 'ink';

// Types
export interface JsonRendererProps {
  data: any;
  title?: string;
  maxItems?: number;
  showFullScreen?: boolean;
  onFullScreenToggle?: () => void;
  onAction?: (action: string, data: any) => void;
  compact?: boolean;
}

export interface FieldConfig {
  key: string;
  label: string;
  formatter?: (value: any) => string;
  important?: boolean;
  sensitive?: boolean;
}

// Default field configurations for common data types
export const defaultFieldConfigs: FieldConfig[] = [
  { key: 'id', label: '🆔 ID', important: true },
  { key: 'user_id', label: '👤 User ID', important: true },
  { key: 'org_id', label: '🏢 Organization ID' },
  { key: 'name', label: '📝 Name', important: true },
  { key: 'email', label: '📧 Email', important: true },
  { key: 'created_at', label: '📅 Created', formatter: (val) => val ? new Date(val).toLocaleString() : 'N/A' },
  { key: 'updated_at', label: '📅 Updated', formatter: (val) => val ? new Date(val).toLocaleString() : 'N/A' },
  { key: 'spend_limit', label: '💰 Spend Limit', formatter: (val) => val ? `$${val}` : 'N/A' },
  { key: 'max_spend_limit', label: '💰 Max Spend', formatter: (val) => val ? `$${val}` : 'N/A' },
  { key: 'credit', label: '⚡ Credits', formatter: (val) => val ? `$${val}` : '$0' },
  { key: 's3_bucket_name', label: '🪣 S3 Bucket' },
  { key: 's3_region', label: '🌍 S3 Region' },
  { key: 'api_version', label: '🔌 API Version' },
  { key: 'machine_limit', label: '🖥️ Machine Limit' },
  { key: 'max_gpu', label: '🚀 Max GPU' },
  { key: 'workflow_limit', label: '⚙️ Workflow Limit' },
];

// Utility functions
const formatValue = (value: any, formatter?: (val: any) => string): string => {
  if (formatter) {
    return formatter(value);
  }

  if (value === null || value === undefined) {
    return 'N/A';
  }

  if (typeof value === 'boolean') {
    return value ? '✓' : '✗';
  }

  if (typeof value === 'string' && value.length > 50) {
    return value.slice(0, 47) + '...';
  }

  return String(value);
};

const getFieldConfig = (key: string, fieldConfigs: FieldConfig[] = defaultFieldConfigs): FieldConfig | null => {
  return fieldConfigs.find(config => config.key === key) || null;
};

// Compact JSON renderer - shows key fields in a table-like format
export const CompactJsonRenderer: React.FC<JsonRendererProps & { fieldConfigs?: FieldConfig[] }> = ({
  data,
  title = "Settings",
  maxItems = 6,
  fieldConfigs = defaultFieldConfigs
}) => {
  if (!data || typeof data !== 'object') {
    return <Text color="gray">No data available</Text>;
  }

  // Extract important fields first, then others
  const entries = Object.entries(data);
  const importantEntries = entries.filter(([key]) => {
    const config = getFieldConfig(key, fieldConfigs);
    return config?.important;
  });

  const otherEntries = entries.filter(([key]) => {
    const config = getFieldConfig(key, fieldConfigs);
    return !config?.important;
  });

  const displayEntries = [
    ...importantEntries.slice(0, Math.floor(maxItems * 0.7)),
    ...otherEntries.slice(0, maxItems - importantEntries.slice(0, Math.floor(maxItems * 0.7)).length)
  ];

  const hasMore = entries.length > displayEntries.length;

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="blue" padding={1}>
      <Text color="blue" bold>📊 {title}</Text>
      <Box flexDirection="column" marginTop={1}>
        {displayEntries.map(([key, value]) => {
          const config = getFieldConfig(key, fieldConfigs);
          const label = config?.label || key;
          const formattedValue = formatValue(value, config?.formatter);
          const isImportant = config?.important;

          return (
            <Box key={key} flexDirection="row" justifyContent="space-between">
              <Text color={isImportant ? "yellow" : "white"}>{label}:</Text>
              <Text color={isImportant ? "cyan" : "gray"} wrap="truncate">
                {formattedValue}
              </Text>
            </Box>
          );
        })}
      </Box>

      {hasMore && (
        <Box marginTop={1} borderStyle="single" borderColor="gray" padding={0}>
          <Text color="gray" dimColor>
            ... and {entries.length - displayEntries.length} more fields
          </Text>
          <Text color="yellow" dimColor>
            Press Shift+Enter for full details
          </Text>
        </Box>
      )}
    </Box>
  );
};

// Detailed JSON renderer - shows all fields in organized sections
export const DetailedJsonRenderer: React.FC<JsonRendererProps & { fieldConfigs?: FieldConfig[] }> = ({
  data,
  title = "Settings Details",
  fieldConfigs = defaultFieldConfigs
}) => {
  if (!data || typeof data !== 'object') {
    return <Text color="gray">No data available</Text>;
  }

  const entries = Object.entries(data);

  // Group fields by category (based on prefixes)
  const groups: { [category: string]: [string, any][] } = {
    'Identity': [],
    'Billing': [],
    'Storage': [],
    'Limits': [],
    'Dates': [],
    'Features': [],
    'Other': []
  };

  entries.forEach(([key, value]) => {
    if (key.includes('id') || key === 'name' || key === 'email') {
      groups['Identity'].push([key, value]);
    } else if (key.includes('spend') || key.includes('credit') || key.includes('price') || key.includes('billing')) {
      groups['Billing'].push([key, value]);
    } else if (key.includes('s3') || key.includes('bucket') || key.includes('storage')) {
      groups['Storage'].push([key, value]);
    } else if (key.includes('limit') || key.includes('max_') || key.includes('machine') || key.includes('gpu')) {
      groups['Limits'].push([key, value]);
    } else if (key.includes('_at') || key.includes('date')) {
      groups['Dates'].push([key, value]);
    } else if (key.includes('enable') || key.includes('use_') || key.includes('custom_')) {
      groups['Features'].push([key, value]);
    } else {
      groups['Other'].push([key, value]);
    }
  });

  // Remove empty groups
  Object.keys(groups).forEach(category => {
    if (groups[category].length === 0) {
      delete groups[category];
    }
  });

  return (
    <Box flexDirection="column">
      <Text color="cyan" bold>📋 {title}</Text>

      {Object.entries(groups).map(([category, categoryEntries]) => (
        <Box key={category} flexDirection="column" marginTop={1}>
          <Text color="yellow" bold>▶ {category}</Text>
          <Box flexDirection="column" marginLeft={2}>
            {categoryEntries.map(([key, value]) => {
              const config = getFieldConfig(key, fieldConfigs);
              const label = config?.label || key;
              const formattedValue = formatValue(value, config?.formatter);
              const isImportant = config?.important;
              const isSensitive = config?.sensitive;

              return (
                <Box key={key} flexDirection="row" justifyContent="space-between" marginY={0}>
                  <Text color={isImportant ? "yellow" : "white"} minWidth={25}>
                    {label}:
                  </Text>
                  <Text
                    color={isSensitive ? "red" : isImportant ? "cyan" : "gray"}
                    wrap="truncate"
                  >
                    {isSensitive && formattedValue !== 'N/A' ? '***HIDDEN***' : formattedValue}
                  </Text>
                </Box>
              );
            })}
          </Box>
        </Box>
      ))}
    </Box>
  );
};

// Full-screen modal component
export const FullScreenDetails: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  actions?: { key: string; label: string; handler: () => void }[];
}> = ({ isOpen, onClose, title, children, actions = [] }) => {
  const [selectedActionIndex, setSelectedActionIndex] = useState(0);

  useInput((input, key) => {
    if (!isOpen) return;

    if (key.escape) {
      onClose();
    } else if (actions.length > 0) {
      if (key.tab) {
        setSelectedActionIndex((prev) => (prev + 1) % actions.length);
      } else if (key.return) {
        actions[selectedActionIndex]?.handler();
      }
    }
  });

  if (!isOpen) return null;

  return (
    <Box
      position="absolute"
      top={0}
      left={0}
      width="100%"
      // height="100%"
      backgroundColor="black"
      borderStyle="classic"
      borderColor="cyan"
      flexDirection="column"
      padding={1}
    >
      {children}
    </Box>
  );
};

// Main JsonObjectRenderer component with full-screen capability
export const JsonObjectRenderer: React.FC<JsonRendererProps & { fieldConfigs?: FieldConfig[] }> = ({
  data,
  title = "Object Details",
  maxItems = 6,
  compact = true,
  onAction,
  fieldConfigs = defaultFieldConfigs
}) => {
  const [isFullScreenOpen, setIsFullScreenOpen] = useState(false);

  const actions = [
    {
      key: 'C',
      label: 'Copy JSON',
      handler: () => {
        // In a real implementation, you might want to copy to clipboard
        console.log('Copying JSON:', JSON.stringify(data, null, 2));
        onAction?.('copy', data);
      }
    },
    {
      key: 'E',
      label: 'Export',
      handler: () => {
        onAction?.('export', data);
      }
    }
  ];

  useInput((input, key) => {
    if (key.shift && key.return) {
      setIsFullScreenOpen(true);
    }
  });

  return (
    <>
      {compact ? (
        <CompactJsonRenderer
          data={data}
          title={title}
          maxItems={maxItems}
          fieldConfigs={fieldConfigs}
        />
      ) : (
        <DetailedJsonRenderer
          data={data}
          title={title}
          fieldConfigs={fieldConfigs}
        />
      )}

      <FullScreenDetails
        isOpen={isFullScreenOpen}
        onClose={() => setIsFullScreenOpen(false)}
        title={`Full Details - ${title}`}
        actions={actions}
      >
        <DetailedJsonRenderer
          data={data}
          title={title}
          fieldConfigs={fieldConfigs}
        />
      </FullScreenDetails>
    </>
  );
};

// Hook for managing JSON renderer state
export const useJsonRenderer = (initialData: any = null) => {
  const [data, setData] = useState(initialData);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const showFullScreen = () => setIsFullScreen(true);
  const hideFullScreen = () => setIsFullScreen(false);
  const toggleFullScreen = () => setIsFullScreen(!isFullScreen);

  return {
    data,
    setData,
    isFullScreen,
    showFullScreen,
    hideFullScreen,
    toggleFullScreen
  };
};
