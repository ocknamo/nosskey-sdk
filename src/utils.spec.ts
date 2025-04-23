import { describe, it, expect } from 'vitest'
import { createNosskey } from './utils'
import { NosskeyConfig } from './types'

describe('utils', () => {
  describe('createNosskey', () => {
    it('should create a new Nosskey instance', () => {
      const config: NosskeyConfig = {}
      const nosskey = createNosskey(config)
      expect(nosskey).toBeDefined()
    })
  })
}) 