import {
  createOneirodexClient,
  type OneirodexClient,
  type OneirodexClientConfig,
} from '@oneirodex/api-client'
import type { AuthStore } from './auth.js'

export function createDesktopApi(auth: AuthStore): OneirodexClient {
  const config: OneirodexClientConfig = {
    baseUrl: auth.getBaseUrl(),
    getToken: () => auth.getToken(),
  }
  return createOneirodexClient(config)
}

export type { OneirodexClient }
