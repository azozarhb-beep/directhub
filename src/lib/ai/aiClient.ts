export async function callAIEndpoint(endpoint: string, payload: object, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error('API Route Error:', {
        error: data.error,
        details: data.details,
      });
      throw new Error(data.error || `Request failed: ${response.status}`);
    }

    return data;
  } catch (error) {
    if ((error as any)?.name === 'AbortError') {
      const timeoutError = new Error('AI request timed out after 30 seconds. Please try again.');
      console.error('AI request timeout:', timeoutError.message);
      throw timeoutError;
    }
    console.error('API request error:', error);
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
