import { describe, expect, it } from 'vitest';
import { isSoftwareRenderer } from './renderer';

describe('isSoftwareRenderer', () => {
  it.each([
    'ANGLE (Microsoft, Microsoft Basic Render Driver (0x0000008C) Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)',
    'llvmpipe (LLVM 15.0.7, 256 bits)',
    'Google SwiftShader',
  ])('spots the software fallback in %s', (renderer) => {
    expect(isSoftwareRenderer(renderer)).toBe(true);
  });

  it.each([
    'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 SUPER (0x00002783) Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'ANGLE (Intel, Intel(R) UHD Graphics 630 (0x00003E92) Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'Apple GPU',
    'Mali-G78',
  ])('trusts the graphics card in %s', (renderer) => {
    expect(isSoftwareRenderer(renderer)).toBe(false);
  });
});
