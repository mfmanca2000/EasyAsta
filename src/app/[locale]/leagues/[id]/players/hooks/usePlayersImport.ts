import { useState } from "react";
import { useTranslations } from "next-intl";

interface ImportResult {
  success: boolean;
  error?: string;
  warning?: boolean;
  details?: string[];
  data?: {
    count: number;
  };
}

interface UsePlayersImportProps {
  leagueId: string;
  onImportSuccess?: () => void;
}

export function usePlayersImport({ leagueId, onImportSuccess }: UsePlayersImportProps) {
  const t = useTranslations();
  const [uploading, setUploading] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);

  const importPlayers = async (file: File): Promise<ImportResult> => {
    if (!file) {
      return { success: false, error: t("errors.fileRequired") };
    }

    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      return { success: false, error: t("errors.invalidFileType") };
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("leagueId", leagueId);

      const response = await fetch("/api/players/import", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      console.log("Import result:", result);

      if (result.success) {
        onImportSuccess?.();
      }

      return result;
    } catch (error) {
      console.error("Import error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : t("errors.uploadError"),
      };
    } finally {
      setUploading(false);
    }
  };

  const handleImportComplete = (result: ImportResult) => {
    if (result.success) {
      setShowImportForm(false);
    }
  };

  const openImportForm = () => setShowImportForm(true);
  const closeImportForm = () => setShowImportForm(false);

  return {
    uploading,
    showImportForm,
    importPlayers,
    handleImportComplete,
    openImportForm,
    closeImportForm,
  };
}
