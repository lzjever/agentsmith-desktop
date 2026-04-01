import { normalizeDeploymentBaseUrl } from '../normalize';

describe('normalizeDeploymentBaseUrl', () => {
  it('adds https when protocol is omitted', () => {
    expect(normalizeDeploymentBaseUrl('mbos.imotion.ai:3001')).toBe('https://mbos.imotion.ai:3001');
  });

  it('drops path and query components', () => {
    expect(normalizeDeploymentBaseUrl('https://mbos.imotion.ai:3001/zh-CN/files?x=1')).toBe('https://mbos.imotion.ai:3001');
  });

  it('rejects empty input', () => {
    expect(() => normalizeDeploymentBaseUrl('   ')).toThrow('deployment_url_required');
  });
});
