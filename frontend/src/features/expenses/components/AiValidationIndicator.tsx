import { CircleCheckBig, CircleX, Loader2 } from 'lucide-react';
import type { AiValidation, OcrData } from '@/core/types/ticket.types';

interface AiValidationIndicatorProps {
  aiValidation: AiValidation | null;
  ocrData: OcrData | null;
}

export function AiValidationIndicator({ aiValidation, ocrData }: AiValidationIndicatorProps) {
  if (!aiValidation) return null;

  const status = aiValidation.status;

  if (status === 'pending' || status === 'in_progress') {
    const isOcrRunning = ocrData?.status === 'processing';
    const label = isOcrRunning
      ? 'Validating receipt (OCR in progress)'
      : 'AI validation in progress';

    return (
      <span
        className="inline-flex items-center text-(--muted-foreground)"
        title={label}
        aria-label={label}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
      </span>
    );
  }

  if (status === 'passed') {
    const label = 'AI validation confident';
    return (
      <span
        className="inline-flex items-center text-success-600 dark:text-success-400"
        title={label}
        aria-label={label}
      >
        <CircleCheckBig className="h-4 w-4" />
      </span>
    );
  }

  if (status === 'flagged' || status === 'error') {
    const label = status === 'error' ? 'AI validation failed' : 'AI validation flagged for review';
    return (
      <span
        className="inline-flex items-center text-danger-600 dark:text-danger-400"
        title={label}
        aria-label={label}
      >
        <CircleX className="h-4 w-4" />
      </span>
    );
  }

  return null;
}
