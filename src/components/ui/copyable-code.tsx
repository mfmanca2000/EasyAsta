import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";

interface CopyableCodeProps {
  text: string;
  className?: string;
  iconSize?: number;
}

export function CopyableCode({ text, className, iconSize = 16 }: CopyableCodeProps) {
  const { copyToClipboard, isCopied } = useCopyToClipboard();

  const handleClick = () => {
    copyToClipboard(text);
  };

  return (
    <div 
      className={cn(
        "group font-mono bg-muted px-3 py-1 rounded cursor-pointer hover:bg-muted/80 transition-colors flex items-center justify-between gap-2",
        className
      )}
      onClick={handleClick}
      title="Click to copy"
    >
      <span className="select-all">{text}</span>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        {isCopied ? (
          <Check size={iconSize} className="text-green-600" />
        ) : (
          <Copy size={iconSize} className="text-muted-foreground" />
        )}
      </div>
    </div>
  );
}