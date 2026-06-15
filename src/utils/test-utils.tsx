import { RenderOptions, render as rtlRender } from '@testing-library/react'
import { Options, userEvent } from '@testing-library/user-event'
import type { ReactNode } from 'react'

function TestProviders({ children }: Readonly<{ children: ReactNode }>) {
  return <>{children}</>
}

export async function resolvedComponent(Component: any, props?: any) {
  const ComponentResolved = await Component(props)
  return () => ComponentResolved
}

export const DOM_NESTING_ERROR = 'In HTML, %s cannot be a child of <%s>'

/**
 * This function is a custom hook that returns a click function.
 * It returns an awaitable click function that can be used to click on an element.
 * @param element - The element to be rendered.
 * @param renderOptions - The render options.
 * @param userEventOptions - The userEvent options.
 * @returns The click function.
 *
 * @example
 * ```tsx
 * import { useClick, screen } from '@/utils/test-utils'
 * import { Button } from './Button'
 *
 * it('should call onClick when the button is clicked', async () => {
 *   const onClickMock = jest.fn()
 *   const click = useClick(<Button onClick={onClickMock}>Click me</Button>)
 *
 *   await click(screen.getByText('Click me'))
 *
 *   expect(onClickMock).toHaveBeenCalled()
 * })
 * ```
 */
export const useClick = (
  element: ReactNode,
  renderOptions?: RenderOptions,
  userEventOptions?: Options,
) => {
  const { user } = useUser(element, renderOptions, userEventOptions)
  return user.click
}

/**
 * This function is a custom hook that returns a userEvent user object.
 * @param element - The element to be rendered.
 * @param renderOptions - The render options.
 * @param userEventOptions - The userEvent options.
 * @returns The userEvent object with all of the methods.
 *
 * @example
 * ```tsx
 * import { useUser, screen } from '@/utils/test-utils'
 * import { Input } from './Input'
 *
 * it('should change input value', async () => {
 *   const { user } = useUser(<Input data-testid='input' />)
 *
 *   await user.type(screen.getByTestId('input'), 'Hello, World!')
 *
 *   expect(screen.getByTestId('input')).toHaveValue('Hello, World!')
 * })
 * ```
 */
export const useUser = (
  element: ReactNode,
  renderOptions?: RenderOptions,
  userEventOptions?: Options,
) => {
  const user = userEvent.setup(userEventOptions)
  return {
    user,
    ...rtlRender(element, { wrapper: TestProviders, ...renderOptions }),
  }
}

export { mockFetch, mockManyFetch } from './mock-fetch'
export * from '@testing-library/react'
export * from '@testing-library/user-event'
