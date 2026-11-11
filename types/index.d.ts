/** Tokens the pet has eaten this conversation, as the API counted them. */
export type Feed = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  /** Model requests counted (main loop and subagents). */
  requests: number
  /** `$.clock.now()` of the last meal; 0 before the first. */
  lastFedAt: number
  /** `$.clock.now()` of the last evolution; 0 before the first. */
  evolvedAt: number
}

declare module 'claude-code' {
  interface PluginState {
    'token-pet': {
      feed: Feed
      /** Put away with /pet or by closing its pane. */
      isHidden: boolean
    }
  }
}
