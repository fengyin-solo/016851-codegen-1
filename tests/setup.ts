import { beforeAll, afterAll, afterEach } from 'vitest'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    configurable: true,
  })
}

// jsdom 环境下 window 存在；node 环境下兜底补上
if (typeof (globalThis as { window?: typeof globalThis }).window === 'undefined') {
  Object.defineProperty(globalThis, 'window', {
    value: globalThis,
    configurable: true,
  })
}

beforeAll(() => {
  // Setup before all tests
})

afterEach(() => {
  // Clear localStorage after each test
  localStorage.clear()
})

afterAll(() => {
  // Cleanup after all tests
})
