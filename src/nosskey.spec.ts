import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Nosskey } from './nosskey'
import { registerDummyPasskey } from './test-utils'

// Mock WebAuthn API and window
vi.stubGlobal('navigator', {
  credentials: {
    get: vi.fn(),
  },
})

vi.stubGlobal('window', {
  location: {
    hostname: 'localhost',
  },
})

describe('Nosskey', () => {
  const options = {
    userId: 'test@example.com',
    appNamespace: 'test-app',
  }

  describe('constructor', () => {
    it('should create a new instance with options', () => {
      const nosskey = new Nosskey(options)
      expect(nosskey).toBeInstanceOf(Nosskey)
    })
  })

  describe('deriveKey', () => {
    it('should derive a key pair', async () => {
      const nosskey = new Nosskey(options)
      const mockCredential = await registerDummyPasskey(options.userId)
      vi.mocked(navigator.credentials.get).mockResolvedValue(mockCredential)

      const key = await nosskey.deriveKey()
      expect(key).toBeDefined()
      expect(key.sk).toBeInstanceOf(Uint8Array)
      expect(key.pk).toBeInstanceOf(Uint8Array)
      expect(key.credentialId).toBeInstanceOf(Uint8Array)
      expect(key.rawSignature).toBeInstanceOf(Uint8Array)
    })
  })

  describe('generateChallenge', () => {
    it('should generate a deterministic challenge', async () => {
      const challenge1 = await Nosskey.generateChallenge('user1', 'app1')
      const challenge2 = await Nosskey.generateChallenge('user1', 'app1')
      expect(challenge1).toEqual(challenge2)
    })

    it('should generate different challenges for different inputs', async () => {
      const challenge1 = await Nosskey.generateChallenge('user1', 'app1')
      const challenge2 = await Nosskey.generateChallenge('user2', 'app1')
      expect(challenge1).not.toEqual(challenge2)
    })
  })

  describe('toHex', () => {
    it('should convert buffer to hex string', () => {
      const buf = new Uint8Array([0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef])
      const hex = Nosskey.toHex(buf)
      expect(hex).toBe('0123456789abcdef')
    })
  })
}) 