import { describe, expect, it } from 'vitest';
import { diagnoseGitHubError } from '../src/photos/errors';

describe('GitHub 拒绝请求的诊断', () => {
  it('读仓库成功不代表 token 能写入；实际权限错误提供明确恢复操作', () => {
    const error = diagnoseGitHubError(
      403,
      new Headers({ 'x-github-request-id': 'A123:B456' }),
      { message: 'Resource not accessible by personal access token' },
      'upload-photo',
    );
    expect(error.reason).toBe('permissions');
    expect(error.message).toContain('上传照片');
    expect(error.message).toContain('Read and write');
    expect(error.message).toContain('Resource owner');
    expect(error.message).toContain('断开并重新连接');
    expect(error.requestId).toBe('A123:B456');
  });
  it('相同 403 状态下将主限流与权限不足区分开', () => {
    const now = 1_700_000_000_000;
    const error = diagnoseGitHubError(
      403,
      new Headers({
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String((now + 120_000) / 1000),
      }),
      { message: 'API rate limit exceeded' },
      'upload-photo',
      now,
    );
    expect(error.reason).toBe('rate-limit');
    expect(error.retryAt).toBe(now + 120_000);
    expect(error.message).toContain('120 秒');
    expect(error.message).not.toContain('Read and write');
  });
  it('识别 secondary limit 与 Retry-After，不建议更换权限', () => {
    const now = 1_700_000_000_000;
    const error = diagnoseGitHubError(
      403,
      new Headers({ 'retry-after': '90' }),
      { message: 'You have exceeded a secondary rate limit' },
      'read-photo',
      now,
    );
    expect(error.reason).toBe('rate-limit');
    expect(error.retryAt).toBe(now + 90_000);
    expect(error.message).toContain('核对已有照片');
  });
  it('识别 403/422 分支规则，包括嵌套错误信息', () => {
    const error = diagnoseGitHubError(
      422,
      new Headers(),
      {
        message: 'Validation Failed',
        errors: [{ message: 'Changes must be made through a pull request.' }],
      },
      'upload-photo',
    );
    expect(error.reason).toBe('branch-rules');
    expect(error.message).toContain('图片分支');
  });
  it('区分登录失效和组织 SSO，未知响应不把敏感正文写入错误提示', () => {
    expect(diagnoseGitHubError(401, new Headers(), {}, 'repository').reason).toBe('auth');
    expect(
      diagnoseGitHubError(
        403,
        new Headers(),
        { message: 'SAML single sign-on required' },
        'upload-photo',
      ).message,
    ).toContain('SSO');
    const error = diagnoseGitHubError(
      500,
      new Headers({ 'x-github-request-id': 'unsafe<value>' }),
      { message: 'Bearer secret-token' },
      'branch',
    );
    expect(error.message).not.toContain('secret-token');
    expect(error.requestId).toBeUndefined();
  });
});
