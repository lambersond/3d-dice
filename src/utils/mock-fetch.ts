// Test-only `fetch` helpers. Lifted out of `jest.setup.ts` so source
// files (test utilities, individual tests) can import them without
// reaching into the project root setup file.

/**
 * Replaces `globalThis.fetch` with a jest mock that resolves a single
 * synthetic `Response`. Matches the shape jest's `Response` polyfill
 * + assertions can read from.
 */
export function mockFetch({ status = 200, responseData = {} } = {}) {
  globalThis.fetch = jest.fn(() => {
    return Promise.resolve({
      status,
      ok: status >= 200 && status < 300,
      json: () => Promise.resolve(responseData),
      headers: new Headers(),
      redirected: false,
      statusText: 'OK',
      type: 'basic',
      url: '',
      clone: () => {},
      // eslint-disable-next-line unicorn/no-null
      body: null,
      bodyUsed: false,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      blob: () => Promise.resolve(new Blob()),
      formData: () => Promise.resolve(new FormData()),
      text: () => Promise.resolve(responseData),
    } as Response)
  })
}

/**
 * Like `mockFetch`, but queues N responses to be consumed in order.
 * Useful for tests that exercise multi-step flows (preview → commit,
 * etc.) and need to assert on the request body of each call.
 */
export function mockManyFetch(
  responses: Array<{ status?: number; responseData?: any }> = [
    { status: 200, responseData: {} },
  ],
) {
  const fetchMock = jest.fn<Promise<Response>, [RequestInfo, RequestInit?]>()

  for (const { status = 200, responseData = {} } of responses) {
    const res: Partial<Response> = {
      status,
      ok: status >= 200 && status < 300,
      json: () => Promise.resolve(responseData),
      text: () =>
        typeof responseData === 'string'
          ? Promise.resolve(responseData)
          : Promise.resolve(JSON.stringify(responseData)),
      headers: new Headers(),
      redirected: false,
      statusText: 'OK',
      type: 'basic',
      url: '',
      clone: () => ({}) as Response,
      body: undefined,
      bodyUsed: false,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      blob: () => Promise.resolve(new Blob()),
      formData: () => Promise.resolve(new FormData()),
    }
    fetchMock.mockResolvedValueOnce(res as Response)
  }

  globalThis.fetch = fetchMock as any
  return fetchMock
}
