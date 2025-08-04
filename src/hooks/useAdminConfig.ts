import { useState, useEffect } from "react";

interface AdminConfig {
  timeoutSeconds: number;
  autoSelectOnTimeout: boolean;
  pauseOnDisconnect: boolean;
}

interface UseAdminConfigReturn {
  config: AdminConfig;
  updateConfig: (field: keyof AdminConfig, value: number | boolean) => void;
  resetConfig: (initialConfig?: Partial<AdminConfig>) => void;
}

export function useAdminConfig(initialConfig?: Partial<AdminConfig>): UseAdminConfigReturn {
  const [config, setConfig] = useState<AdminConfig>({
    timeoutSeconds: initialConfig?.timeoutSeconds || 30,
    autoSelectOnTimeout: initialConfig?.autoSelectOnTimeout ?? true,
    pauseOnDisconnect: initialConfig?.pauseOnDisconnect ?? false,
  });

  useEffect(() => {
    if (initialConfig) {
      setConfig(prev => ({
        ...prev,
        ...initialConfig,
      }));
    }
  }, [initialConfig]);

  const updateConfig = (field: keyof AdminConfig, value: number | boolean) => {
    setConfig(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const resetConfig = (newInitialConfig?: Partial<AdminConfig>) => {
    setConfig({
      timeoutSeconds: newInitialConfig?.timeoutSeconds || initialConfig?.timeoutSeconds || 30,
      autoSelectOnTimeout: newInitialConfig?.autoSelectOnTimeout ?? initialConfig?.autoSelectOnTimeout ?? true,
      pauseOnDisconnect: newInitialConfig?.pauseOnDisconnect ?? initialConfig?.pauseOnDisconnect ?? false,
    });
  };

  return {
    config,
    updateConfig,
    resetConfig,
  };
}