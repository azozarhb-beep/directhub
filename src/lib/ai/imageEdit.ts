import { callAIEndpoint } from './aiClient';

const ENDPOINT = '/api/ai/image-edit';

export async function editImage(
  provider: string,
  model: string,
  image: string,
  prompt: string,
  parameters: object = {}
) {
  return callAIEndpoint(ENDPOINT, { provider, model, image, prompt, parameters });
}
