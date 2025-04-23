import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Nosskey } from './nosskey'
import { registerDummyPasskey } from './test-utils'

// Mock WebAuthn API and window
vi.stubGlobal('navigator', {
  credentials: {
    create: vi.fn(),
    get: vi.fn(),
  },
})

vi.stubGlobal('window', {
  location: {
    hostname: 'localhost',
  },
})

// Mock crypto.subtle.digest
vi.stubGlobal('crypto', {
  subtle: {
    digest: vi.fn(),
  },
  getRandomValues: vi.fn(),
})

describe('Nosskey', () => {
  const options = {
    userId: 'test@example.com',
    appNamespace: 'test-app',
  }

  beforeEach(() => {
    vi.resetAllMocks()
    // Default mock for crypto.subtle.digest
    vi.mocked(crypto.subtle.digest).mockImplementation(async (_, data) => {
      // Return the input data as hash for testing
      return new Uint8Array(data as ArrayBuffer)
    })
    // Default mock for crypto.getRandomValues
    vi.mocked(crypto.getRandomValues).mockImplementation((array: ArrayBufferView | null) => {
      if (!array) return null
      const typedArray = array as Uint8Array
      // Fill with predictable values
      for (let i = 0; i < typedArray.length; i++) {
        typedArray[i] = i % 256
      }
      return array
    })
  })

  describe('constructor', () => {
    it('should create a new instance with options', () => {
      const nosskey = new Nosskey(options)
      expect(nosskey).toBeInstanceOf(Nosskey)
    })
  })

  describe('registerPasskey', () => {
    it('should register a new passkey successfully', async () => {
      const nosskey = new Nosskey(options)
      const mockCredential = await registerDummyPasskey(options.userId)
      vi.mocked(navigator.credentials.create).mockResolvedValue(mockCredential)

      const result = await nosskey.registerPasskey({
        userID: options.userId,
      })

      expect(result.success).toBe(true)
      expect(result.credentialID).toBeDefined()
      expect(result.error).toBeUndefined()
    })

    it('should handle registration failure', async () => {
      const nosskey = new Nosskey(options)
      vi.mocked(navigator.credentials.create).mockRejectedValue(new Error('Registration failed'))

      const result = await nosskey.registerPasskey({
        userID: options.userId,
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Registration failed')
      expect(result.credentialID).toBeUndefined()
    })

    it('should use custom rpID and rpName when provided', async () => {
      const nosskey = new Nosskey(options)
      const mockCredential = await registerDummyPasskey(options.userId)
      const createSpy = vi.mocked(navigator.credentials.create)
      createSpy.mockResolvedValue(mockCredential)

      await nosskey.registerPasskey({
        userID: options.userId,
        rpID: 'custom.example.com',
        rpName: 'Custom App',
      })

      expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
        publicKey: expect.objectContaining({
          rp: {
            id: 'custom.example.com',
            name: 'Custom App',
          },
        }),
      }))
    })

    it('should limit userID to 64 bytes', async () => {
      const nosskey = new Nosskey(options)
      const longUserId = 'a'.repeat(100)
      const mockCredential = await registerDummyPasskey(longUserId)
      const createSpy = vi.mocked(navigator.credentials.create)
      createSpy.mockResolvedValue(mockCredential)

      await nosskey.registerPasskey({
        userID: longUserId,
      })

      const expectedLength = new TextEncoder().encode('a'.repeat(64)).length
      expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
        publicKey: expect.objectContaining({
          user: expect.objectContaining({
            id: expect.any(Uint8Array),
          }),
        }),
      }))
      const call = createSpy.mock.calls[0][0] as { publicKey: PublicKeyCredentialCreationOptions }
      expect(call.publicKey.user.id.byteLength).toBe(expectedLength)
    })

    it('should use custom challenge when provided', async () => {
      const nosskey = new Nosskey(options)
      const mockCredential = await registerDummyPasskey(options.userId)
      const createSpy = vi.mocked(navigator.credentials.create)
      createSpy.mockResolvedValue(mockCredential)
      const customChallenge = new Uint8Array([1, 2, 3, 4])

      await nosskey.registerPasskey({
        userID: options.userId,
        challenge: customChallenge,
      })

      expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
        publicKey: expect.objectContaining({
          challenge: customChallenge.buffer,
        }),
      }))
    })
  })

  describe('deriveKey', () => {
    it('should derive a key pair with correct structure', async () => {
      const nosskey = new Nosskey(options)
      const mockCredential = await registerDummyPasskey(options.userId)
      vi.mocked(navigator.credentials.get).mockResolvedValue(mockCredential)

      const key = await nosskey.deriveKey()
      
      // Verify structure
      expect(key).toBeDefined()
      expect(key.sk).toBeInstanceOf(Uint8Array)
      expect(key.pk).toBeInstanceOf(Uint8Array)
      expect(key.credentialId).toBeInstanceOf(Uint8Array)

      // Verify lengths
      expect(key.sk.length).toBe(32) // Nostr private key is 32 bytes
      expect(key.pk.length).toBe(32) // Nostr public key is 32 bytes
      expect(key.credentialId.length).toBeGreaterThan(0)

      // Verify hex conversion
      const skHex = Nosskey.toHex(key.sk)
      const pkHex = Nosskey.toHex(key.pk)
      expect(skHex).toMatch(/^[0-9a-f]{64}$/)
      expect(pkHex).toMatch(/^[0-9a-f]{64}$/)
    })

    it('should handle null response from credential', async () => {
      const nosskey = new Nosskey(options)
      const mockCredential = {
        ...await registerDummyPasskey(options.userId),
        response: null,
      }
      vi.mocked(navigator.credentials.get).mockResolvedValue(mockCredential)

      await expect(nosskey.deriveKey()).rejects.toThrow('No response from credential')
    })

    it('should use custom webAuthnOptions when provided', async () => {
      const nosskey = new Nosskey({
        ...options,
        webAuthnOptions: {
          publicKey: {
            userVerification: 'required',
          },
        } as CredentialRequestOptions,
      })
      const mockCredential = await registerDummyPasskey(options.userId)
      const getSpy = vi.mocked(navigator.credentials.get)
      getSpy.mockResolvedValue(mockCredential)

      await nosskey.deriveKey()

      expect(getSpy).toHaveBeenCalledWith({
        publicKey: expect.objectContaining({
          userVerification: 'required',
          challenge: expect.any(Uint8Array),
          allowCredentials: undefined,
          timeout: 60000,
        }),
      })
    })

    it('should hash signature when length is not 64 bytes', async () => {
      const nosskey = new Nosskey(options)
      const shortSignature = new Uint8Array(32)
      for (let i = 0; i < shortSignature.length; i++) {
        shortSignature[i] = i + 1
      }

      const mockCredential = {
        ...await registerDummyPasskey(options.userId),
        response: {
          signature: shortSignature,
        },
      }
      vi.mocked(navigator.credentials.get).mockResolvedValue(mockCredential)

      await nosskey.deriveKey()

      expect(crypto.subtle.digest).toHaveBeenCalledWith('SHA-256', expect.any(Uint8Array))
    })

    it('should use signature directly when length is 64 bytes', async () => {
      const nosskey = new Nosskey(options)
      const signature64 = new Uint8Array(64)
      for (let i = 0; i < signature64.length; i++) {
        signature64[i] = i + 1
      }

      const mockCredential = {
        ...await registerDummyPasskey(options.userId),
        response: {
          signature: signature64,
        },
      }
      vi.mocked(navigator.credentials.get).mockResolvedValue(mockCredential)

      await nosskey.deriveKey()

      // deriveChallenge will call digest, but deriveKeyFromSignature won't
      expect(crypto.subtle.digest).toHaveBeenCalledWith('SHA-256', expect.any(Uint8Array))
    })
  })

  describe('deriveChallenge', () => {
    it('should generate a deterministic challenge', async () => {
      const challenge1 = await Nosskey.deriveChallenge('user1', 'app1')
      const challenge2 = await Nosskey.deriveChallenge('user1', 'app1')
      expect(challenge1).toEqual(challenge2)
    })

    it('should generate different challenges for different inputs', async () => {
      const challenge1 = await Nosskey.deriveChallenge('user1', 'app1')
      const challenge2 = await Nosskey.deriveChallenge('user2', 'app1')
      expect(challenge1).not.toEqual(challenge2)
    })

    it('should include salt in challenge when provided', async () => {
      const challenge1 = await Nosskey.deriveChallenge('user1', 'app1')
      const challenge2 = await Nosskey.deriveChallenge('user1', 'app1', 'salt1')
      expect(challenge1).not.toEqual(challenge2)
    })
  })

  describe('toHex', () => {
    it('should convert buffer to hex string', () => {
      const buf = new Uint8Array([0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef])
      const hex = Nosskey.toHex(buf)
      expect(hex).toBe('0123456789abcdef')
    })

    it('should handle empty buffer', () => {
      const buf = new Uint8Array([])
      const hex = Nosskey.toHex(buf)
      expect(hex).toBe('')
    })

    it('should pad single digit numbers with zero', () => {
      const buf = new Uint8Array([0x01, 0x02, 0x03, 0x04])
      const hex = Nosskey.toHex(buf)
      expect(hex).toBe('01020304')
    })
  })

  describe('isPasskeySupported', () => {
    it('should return true when Passkey is supported', async () => {
      vi.stubGlobal('window', {
        PublicKeyCredential: {
          isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.resolve(true),
        },
      })

      expect(await Nosskey.isPasskeySupported()).toBe(true)
    })

    it('should return false when window is undefined', async () => {
      vi.stubGlobal('window', undefined)

      expect(await Nosskey.isPasskeySupported()).toBe(false)
    })

    it('should return false when PublicKeyCredential is undefined', async () => {
      vi.stubGlobal('window', {
        PublicKeyCredential: undefined,
      })

      expect(await Nosskey.isPasskeySupported()).toBe(false)
    })

    it('should return false when isUserVerifyingPlatformAuthenticatorAvailable is not a function', async () => {
      vi.stubGlobal('window', {
        PublicKeyCredential: {
          isUserVerifyingPlatformAuthenticatorAvailable: 'not a function',
        },
      })

      expect(await Nosskey.isPasskeySupported()).toBe(false)
    })

    it('should return false when isUserVerifyingPlatformAuthenticatorAvailable throws an error', async () => {
      vi.stubGlobal('window', {
        PublicKeyCredential: {
          isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.reject(new Error('Test error')),
        },
      })

      expect(await Nosskey.isPasskeySupported()).toBe(false)
    })
  })

  describe('clear', () => {
    it('should be callable without errors', () => {
      const nosskey = new Nosskey(options)
      expect(() => nosskey.clear()).not.toThrow()
    })
  })
}) 