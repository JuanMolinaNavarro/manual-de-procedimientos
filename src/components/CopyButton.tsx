/**
 * Botón para copiar texto al portapapeles.
 * Diseñado para respuestas rápidas de agentes.
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface CopyButtonProps {
  text: string;
}

export default function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Button type="button" variant="secondary" onClick={handleCopy}>
      {copied ? 'Copiado' : 'Copiar'}
    </Button>
  );
}
