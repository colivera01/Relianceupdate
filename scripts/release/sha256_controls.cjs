#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');

const SHA256_LOWERCASE_HEX = /^[0-9a-f]{64}$/;

function assertSha256Control(value, label = 'SHA-256 control') {
  assert.equal(typeof value, 'string', `${label} must be a string`);
  assert(SHA256_LOWERCASE_HEX.test(value), `${label} must be exactly 64 lowercase hexadecimal characters`);
  return value;
}

function assertSha256ControlMatch(actual, expected, label = 'SHA-256 control differs') {
  assertSha256Control(actual, `Observed ${label}`);
  assertSha256Control(expected, `Expected ${label}`);
  assert.equal(actual, expected, label);
}

function isSha256ControlField(name) {
  return /(?:sha256|hash)$/i.test(name);
}

function validateSha256ControlObject(value, label = 'release control') {
  let count = 0;
  const visit = (node, currentPath) => {
    if (Array.isArray(node)) {
      node.forEach((entry, index) => visit(entry, `${currentPath}[${index}]`));
      return;
    }
    if (!node || typeof node !== 'object') return;
    for (const [name, child] of Object.entries(node)) {
      const childPath = currentPath ? `${currentPath}.${name}` : name;
      if (isSha256ControlField(name) && (!child || typeof child !== 'object')) {
        assertSha256Control(child, `${label} ${childPath}`);
        count += 1;
      }
      if (child && typeof child === 'object') visit(child, childPath);
    }
  };
  visit(value, '');
  return count;
}

function validateSha256Map(value, label = 'SHA-256 map') {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  for (const [name, digest] of Object.entries(value)) assertSha256Control(digest, `${label} ${name}`);
  return Object.keys(value).length;
}

module.exports = {
  SHA256_LOWERCASE_HEX,
  assertSha256Control,
  assertSha256ControlMatch,
  isSha256ControlField,
  validateSha256ControlObject,
  validateSha256Map,
};
