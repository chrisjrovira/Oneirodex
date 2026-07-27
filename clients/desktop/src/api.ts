import {
  createGamethecaClient,
  type GamethecaClient,
  type GamethecaClientConfig,
} from '@gametheca/api-client'
import type { AuthStore } from './auth.js'

export function createDesktopApi(auth: AuthStore): GamethecaClient {
  const config: GamethecaClientConfig = {
    baseUrl: auth.getBaseUrl(),
    getToken: () => auth.getToken(),
  }
  return createGamethecaClient(config)
}

export type { GamethecaClient }
