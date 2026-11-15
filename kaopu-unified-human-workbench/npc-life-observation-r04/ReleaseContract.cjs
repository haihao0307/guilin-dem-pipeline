'use strict';

/** Pure release identity. Build, staging, publication and public verification
 * must derive the immutable destination from this one contract. No I/O here. */
const VERSION = 'NPC-LIFE-OBSERVATION-R04';
const PUBLIC_ROOT = 'https://haihao0307.github.io/guilin-dem-pipeline/';
const RELEASE_DIRECTORY = 'npc-life-observation/r04-20261021/';
const SOURCE_HEAD = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;

function invalid(field, expectation) {
  const error = new Error('Invalid R04 release receipt: ' + field + ' ' + expectation);
  error.code = 'RELEASE_CONTRACT_INVALID';
  error.field = field;
  throw error;
}

function releaseTarget(sourceHead) {
  if (typeof sourceHead !== 'string' || !SOURCE_HEAD.test(sourceHead))
    invalid('sourceHead', 'must be exactly 40 lowercase hexadecimal characters');
  const publicPath = RELEASE_DIRECTORY + sourceHead + '/';
  return {version: VERSION, sourceHead, publicPath, publicURL: PUBLIC_ROOT + publicPath};
}

/** Validate target identity and the standalone preview's byte receipt.
 * Returns true on success; throws RELEASE_CONTRACT_INVALID with a field on
 * failure. This validates metadata, not an HTTP response or file contents. */
function validateBuildReceipt(build) {
  if (!build || typeof build !== 'object' || Array.isArray(build))
    invalid('build', 'must be a receipt object');
  const expected = releaseTarget(build.sourceHead);
  for (const [field, value] of Object.entries(expected))
    if (build[field] !== value) invalid(field, 'must equal ' + value);
  if (build.standalone !== true) invalid('standalone', 'must be the boolean true');
  if (typeof build.previewSHA256 !== 'string' || !SHA256.test(build.previewSHA256))
    invalid('previewSHA256', 'must be exactly 64 lowercase hexadecimal characters');
  if (!Number.isSafeInteger(build.previewBytes) || build.previewBytes <= 0)
    invalid('previewBytes', 'must be a positive safe integer');
  return true;
}

module.exports = {VERSION, releaseTarget, validateBuildReceipt};
