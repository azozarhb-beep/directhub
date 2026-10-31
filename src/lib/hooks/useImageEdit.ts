'use client';

import { useState, useCallback } from 'react';
import { editImage } from '@/lib/ai/imageEdit';
import Error from '@/app/error';


export function useImageEdit(provider: string, model: string) {
  const [image, setImage] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const edit = useCallback(
    async (sourceImage: string, prompt: string, parameters: object = {}) => {
      setImage(null);
      setIsLoading(true);
      setError(null);

      try {
        const result = await editImage(provider, model, sourceImage, prompt, parameters);
        setImage(result);
        return result;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setIsLoading(false);
      }
    },
    [provider, model]
  );

  return { image, isLoading, error, edit };
}
