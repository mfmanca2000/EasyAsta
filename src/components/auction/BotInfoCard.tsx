"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap } from "lucide-react";

export default function BotInfoCard() {
  const t = useTranslations("auction");

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-700">
          <Zap className="h-5 w-5" />
          {t("admin.testModeInfo")}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-blue-600 space-y-2">
        <p>• {t("admin.testModeInfoLine1")}</p>
        <p>• {t("admin.testModeInfoLine2")}</p>
        <p>• {t("admin.testModeInfoLine3")}</p>
        <p>• {t("admin.testModeInfoLine4")}</p>
      </CardContent>
    </Card>
  );
}