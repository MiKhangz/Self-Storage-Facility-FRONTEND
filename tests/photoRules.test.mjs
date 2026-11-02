import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PHOTO_MAX_BYTES, photoProblem } from '../src/staff/photoRules.js'

test('a photo must be JPEG, PNG or WebP, and at most 5 MB', () => {
  assert.equal(photoProblem({ type: 'image/png', size: 10 }), null)
  assert.equal(photoProblem({ type: 'image/webp', size: PHOTO_MAX_BYTES }), null)
  assert.match(photoProblem({ type: 'application/pdf', size: 10 }), /JPEG/)
  assert.match(photoProblem({ type: 'image/jpeg', size: PHOTO_MAX_BYTES + 1 }), /5 MB/)
  assert.match(photoProblem({ type: 'image/jpeg', size: 0 }), /5 MB/)
})
