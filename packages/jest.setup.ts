import '@testing-library/jest-dom'

const noop = () => {}

class ResizeObserverStub {
  observe = noop
  unobserve = noop
  disconnect = noop
}

globalThis.ResizeObserver ??=
  ResizeObserverStub as unknown as typeof ResizeObserver

if (globalThis.window !== undefined && !globalThis.matchMedia) {
  Object.defineProperty(globalThis, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: undefined,
      addListener: noop,
      removeListener: noop,
      addEventListener: noop,
      removeEventListener: noop,
      dispatchEvent: () => false,
    }),
  })
}
