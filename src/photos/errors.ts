export type GitHubOperation = 'repository' | 'branch' | 'read-photo' | 'upload-photo';
export type GitHubFailureReason =
  | 'auth'
  | 'permissions'
  | 'branch-rules'
  | 'rate-limit'
  | 'not-found'
  | 'conflict'
  | 'validation'
  | 'unknown';
export class GitHubError extends Error {
  constructor(
    message: string,
    public status = 0,
    public reason: GitHubFailureReason = 'unknown',
    public operation?: GitHubOperation,
    public requestId?: string,
    public retryAt?: number,
  ) {
    super(message);
  }
}
const operationNames: Record<GitHubOperation, string> = {
  repository: '验证仓库访问',
  branch: '读取图片分支',
  'read-photo': '核对已有照片',
  'upload-photo': '上传照片',
};
export function githubOperation(path: string, method?: string): GitHubOperation {
  if (method === 'PUT') return 'upload-photo';
  if (path.includes('/contents/')) return 'read-photo';
  if (path.includes('/branches/')) return 'branch';
  return 'repository';
}
export function diagnoseGitHubError(
  status: number,
  headers: Headers,
  payload: unknown,
  operation: GitHubOperation,
  now = Date.now(),
): GitHubError {
  const body = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const message = typeof body.message === 'string' ? body.message.slice(0, 3000) : '';
  const details = Array.isArray(body.errors)
    ? body.errors
        .slice(0, 20)
        .map((value) => {
          if (typeof value === 'string') return value.slice(0, 500);
          if (!value || typeof value !== 'object') return '';
          const error = value as Record<string, unknown>;
          return [error.message, error.code]
            .filter((v) => typeof v === 'string')
            .join(' ')
            .slice(0, 500);
        })
        .join(' ')
    : '';
  const text = `${message} ${details}`;
  let reason: GitHubFailureReason = 'unknown';
  let advice = '';
  let retryAt: number | undefined;
  // 403 既可能是权限不足，也可能是限流；先读取官方响应信号，不把所有拒绝都归因于令牌。
  if (
    [403, 429].includes(status) &&
    (status === 429 ||
      headers.get('x-ratelimit-remaining') === '0' ||
      /rate limit|abuse detection|temporarily blocked/i.test(text))
  ) {
    reason = 'rate-limit';
    const retryAfter = headers.get('retry-after');
    const reset = headers.get('x-ratelimit-reset');
    const wait = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : 0;
    const primaryReset =
      headers.get('x-ratelimit-remaining') === '0' && reset && /^\d+$/.test(reset)
        ? Number(reset) * 1000
        : 0;
    retryAt = Math.max(now + (wait || 60_000), primaryReset);
    advice = `GitHub 请求已被限流，请约 ${Math.ceil((retryAt - now) / 1000)} 秒后重试。无需因此修改令牌权限。`;
  } else if (
    /protected branch|branch protection|repository rule|rule violations|must be made through a pull request|GH006|GH013|protected branch hook/i.test(
      text,
    )
  ) {
    reason = 'branch-rules';
    advice =
      '当前分支规则禁止直接上传。可在仓库连接中改用已存在、允许直接提交的图片分支，或请仓库管理员确认该分支的规则。';
  } else if (status === 401) {
    reason = 'auth';
    advice = 'GitHub 令牌无效、已过期或被撤销，请重新连接有效的 GitHub Personal access token。';
  } else if (
    /resource not accessible by (personal access token|integration)|insufficient (permission|scope)|write access.*not granted|must have.*write/i.test(
      text,
    )
  ) {
    reason = 'permissions';
    advice =
      '该令牌无权执行此请求。请核对 Resource owner 和所选仓库，并将 Repository permissions → Contents 设置为 Read and write，然后断开并重新连接。账号能读仓库不代表令牌能写入照片。';
  } else if (
    /SAML|single sign.on|SSO|organization.*(approval|policy)|pending approval/i.test(text)
  ) {
    reason = 'permissions';
    advice = '令牌受到组织授权或审批限制，请检查组织的令牌批准状态和 SSO 授权。';
  } else if (status === 403) {
    reason = 'permissions';
    advice =
      'GitHub 拒绝了请求。请核对令牌是否选中目标仓库、Contents 是否为 Read and write，以及分支是否允许直接提交。';
  } else if (status === 404) {
    reason = 'not-found';
    advice = '找不到目标仓库、分支或文件，或令牌无法访问它。请核对仓库名称、分支和令牌所选仓库。';
  } else if (status === 409 || /already_exists/i.test(text)) {
    reason = 'conflict';
    advice = '仓库内容发生并发更新，图片已保留，可重试以核对上传结果。';
  } else if (status === 422) {
    reason = 'validation';
    advice = 'GitHub 未接受这次文件写入，请检查分支规则和仓库设置后重试。';
  } else {
    advice = 'GitHub 暂时无法完成请求，图片和输入已保留，请稍后重试。';
  }
  // 不展示任意响应正文或请求头，只保留阶段、状态及安全的请求编号，防止凭证进入提示。
  const rawId = headers.get('x-github-request-id') || '';
  const requestId = /^[a-z\d:._-]{1,128}$/i.test(rawId) ? rawId : undefined;
  const suffix = requestId ? ` 请求编号：${requestId}。` : '';
  return new GitHubError(
    `${operationNames[operation]}失败（HTTP ${status}）：${advice}${suffix}`,
    status,
    reason,
    operation,
    requestId,
    retryAt,
  );
}
