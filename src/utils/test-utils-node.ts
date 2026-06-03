import { createRequest, RequestOptions } from 'node-mocks-http'
import type { NextRequest } from 'next/server'

/**
 * A simple mockGetRequest function that returns a NextRequest object.
 * @param route Example: api/path/to/route
 * @returns NextRequest
 */
export const mockGetRequest = (route: string, options?: RequestOptions) =>
  createRequest({
    method: 'GET',
    url: `http://localhost:3000/${route}`,
    nextUrl: new URL(`http://localhost:3000/${route}`),
    ...options,
  }) as unknown as NextRequest

/**
 * A simple mockDeleteRequest function that returns a NextRequest object.
 * @param route Example: api/path/to/route
 * @returns NextRequest
 */
export const mockDeleteRequest = (route: string, options?: RequestOptions) =>
  createRequest({
    method: 'DELETE',
    url: `http://localhost:3000/${route}`,
    nextUrl: new URL(`http://localhost:3000/${route}`),
    ...options,
  }) as unknown as NextRequest

/**
 * A simple mockPostRequest function that returns a NextRequest object.
 * @param route Example: api/path/to/route
 * @param res data that is passed in request
 * @returns NextRequest
 */
export const mockPostRequest = (route: string, res: any) => {
  const req = createRequest({
    method: 'POST',
    url: `http://localhost:3000/${route}`,
  }) as unknown as NextRequest
  // node mocks doesn't create request with json function
  return Object.assign(req, {
    json: () => res,
    text: () => JSON.stringify(res),
  })
}

export { mockFetch, mockManyFetch } from './mock-fetch'
