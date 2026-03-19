// ============================================================
// OAuth Mock Apps - GitHub and GitLab integration UIs
// ============================================================

import { createSignal, Show, For, type JSX } from 'solid-js';
import type { AppProps } from '../core/types';
import { useTheme } from '../theme/ThemeProvider';
import './apps.css';

// --- SVG Logos ---

// GitHub Invertocat (from simple-icons, official path)
const GitHubLogo = (props: { size?: number }) => (
  <svg width={props.size ?? 32} height={props.size ?? 32} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
  </svg>
);

// GitLab tanuki (from simple-icons, official path)
const GitLabLogo = (props: { size?: number }) => (
  <svg width={props.size ?? 32} height={props.size ?? 32} viewBox="0 0 24 24" fill="#e24329" xmlns="http://www.w3.org/2000/svg">
    <path d="m23.6004 9.5927-.0337-.0862L20.3.9814a.851.851 0 0 0-.3362-.405.8748.8748 0 0 0-.9997.0539.8748.8748 0 0 0-.29.4399l-2.2055 6.748H7.5375l-2.2057-6.748a.8573.8573 0 0 0-.29-.4412.8748.8748 0 0 0-.9997-.0537.8585.8585 0 0 0-.3362.4049L.4332 9.5015l-.0325.0862a6.0657 6.0657 0 0 0 2.0119 7.0105l.0113.0087.03.0213 4.976 3.7264 2.462 1.8633 1.4995 1.1321a1.0085 1.0085 0 0 0 1.2197 0l1.4995-1.1321 2.4619-1.8633 5.006-3.7489.0125-.01a6.0682 6.0682 0 0 0 2.0094-7.003z"/>
  </svg>
);

// --- Mock data ---

const GITHUB_REPOS = [
  { name: 'kasm-ui', description: 'SolidJS desktop environment', stars: 342, language: 'TypeScript', lang_color: '#3178c6' },
  { name: 'neural-net', description: 'Lightweight neural network library', stars: 189, language: 'Python', lang_color: '#3572A5' },
  { name: 'dotfiles', description: 'Personal dev environment configs', stars: 45, language: 'Shell', lang_color: '#89e051' },
  { name: 'blog', description: 'Personal blog built with Astro', stars: 23, language: 'Astro', lang_color: '#ff5a03' },
  { name: 'rust-wasm-demo', description: 'WebAssembly experiments in Rust', stars: 112, language: 'Rust', lang_color: '#dea584' },
  { name: 'api-gateway', description: 'Microservice API gateway', stars: 78, language: 'Go', lang_color: '#00ADD8' },
];

const GITLAB_REPOS = [
  { name: 'infra-terraform', description: 'Infrastructure as code modules', stars: 56, language: 'HCL', lang_color: '#844fba' },
  { name: 'ci-pipelines', description: 'Shared CI/CD pipeline templates', stars: 134, language: 'YAML', lang_color: '#cb171e' },
  { name: 'data-pipeline', description: 'ETL data processing pipeline', stars: 89, language: 'Python', lang_color: '#3572A5' },
  { name: 'k8s-manifests', description: 'Kubernetes deployment manifests', stars: 67, language: 'YAML', lang_color: '#cb171e' },
  { name: 'ml-training', description: 'Machine learning model training', stars: 201, language: 'Python', lang_color: '#3572A5' },
  { name: 'frontend-monorepo', description: 'Shared frontend packages', stars: 45, language: 'TypeScript', lang_color: '#3178c6' },
];

type OAuthStep = 'login' | 'consent' | 'loading' | 'repos';

interface Scope {
  id: string;
  label: string;
  checked: boolean;
}

function OAuthApp(props: AppProps & {
  provider: 'GitHub' | 'GitLab';
  brandColor: string;
  brandBg: string;
  logo: JSX.Element;
  repos: typeof GITHUB_REPOS;
}) {
  const theme = useTheme();
  const tc = () => theme.colors;
  const [step, setStep] = createSignal<OAuthStep>('login');
  const [scopes, setScopes] = createSignal<Scope[]>([
    { id: 'repo', label: `Read access to repositories`, checked: true },
    { id: 'user', label: `Read access to user profile`, checked: true },
    { id: 'org', label: `Read access to organizations`, checked: false },
  ]);

  const toggleScope = (id: string) => {
    setScopes(prev => prev.map(s => s.id === id ? { ...s, checked: !s.checked } : s));
  };

  const handleAuthorize = () => {
    setStep('loading');
    setTimeout(() => setStep('repos'), 1500);
  };

  const btnStyle = (): JSX.CSSProperties => ({
    padding: '10px 24px',
    "font-size": '14px',
    "font-weight": '600',
    border: 'none',
    "border-radius": '6px',
    cursor: 'pointer',
    color: '#fff',
    background: props.brandColor,
    display: 'inline-flex',
    "align-items": 'center',
    gap: '8px',
  });

  return (
    <>
      <Show when={step() === 'login'}>
        <div class="kasm-app" style={{ background: props.brandBg, display: 'flex', "align-items": 'center', "justify-content": 'center' }}>
          <div style={{ "text-align": 'center', "max-width": '400px' }}>
            <div style={{ "margin-bottom": '24px', color: props.brandColor }}>{props.logo}</div>
            <h2 style={{ margin: '0 0 8px', color: tc().windowText }}>{props.provider}</h2>
            <p style={{ color: tc().textMuted, margin: '0 0 32px', "font-size": '14px' }}>
              Connect your {props.provider} account to access repositories and collaborate on code.
            </p>
            <button style={btnStyle()} onClick={() => setStep('consent')}>
              <span style={{ display: 'flex' }}>{props.provider === 'GitHub' ? <GitHubLogo size={18} /> : <GitLabLogo size={18} />}</span>
              Sign in with {props.provider}
            </button>
          </div>
        </div>
      </Show>

      <Show when={step() === 'consent'}>
        <div class="kasm-app" style={{ background: props.brandBg, display: 'flex', "align-items": 'center', "justify-content": 'center' }}>
          <div style={{
            background: tc().surfaceBg,
            border: `1px solid ${tc().surfaceBorder}`,
            "border-radius": '12px',
            padding: '32px',
            "max-width": '440px',
            width: '100%',
          }}>
            <div style={{ display: 'flex', "align-items": 'center', gap: '12px', "margin-bottom": '20px' }}>
              <span style={{ color: props.brandColor }}>{props.provider === 'GitHub' ? <GitHubLogo size={28} /> : <GitLabLogo size={28} />}</span>
              <div>
                <div style={{ "font-weight": '700', "font-size": '16px', color: tc().windowText }}>Authorize Kasm UI</div>
                <div style={{ color: tc().textMuted, "font-size": '12px' }}>to access your {props.provider} account</div>
              </div>
            </div>
            <div style={{ "border-top": `1px solid ${tc().surfaceBorder}`, "padding-top": '16px', "margin-bottom": '20px' }}>
              <div style={{ "font-size": '13px', "font-weight": '600', color: tc().windowText, "margin-bottom": '12px' }}>Requested permissions:</div>
              <For each={scopes()}>{(scope) => (
                <label style={{
                  display: 'flex',
                  "align-items": 'center',
                  gap: '10px',
                  padding: '8px 0',
                  cursor: 'pointer',
                  "font-size": '13px',
                  color: tc().windowText,
                }}>
                  <input
                    type="checkbox"
                    checked={scope.checked}
                    onChange={() => toggleScope(scope.id)}
                    style={{ "accent-color": props.brandColor }}
                  />
                  {scope.label}
                </label>
              )}</For>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button style={btnStyle()} onClick={handleAuthorize}>Authorize</button>
              <button
                style={{ ...btnStyle(), background: 'transparent', color: tc().textMuted, border: `1px solid ${tc().surfaceBorder}` }}
                onClick={() => setStep('login')}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Show>

      <Show when={step() === 'loading'}>
        <div class="kasm-app" style={{ background: props.brandBg, display: 'flex', "align-items": 'center', "justify-content": 'center' }}>
          <div style={{ "text-align": 'center' }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: `3px solid ${tc().surfaceBorder}`,
              "border-top-color": props.brandColor,
              "border-radius": '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ color: tc().textMuted, "font-size": '14px' }}>Connecting to {props.provider}...</div>
          </div>
        </div>
      </Show>

      <Show when={step() === 'repos'}>
        <div class="kasm-app" style={{ background: props.brandBg }}>
          <div style={{
            display: 'flex',
            "align-items": 'center',
            gap: '12px',
            padding: '10px 16px',
            background: tc().surfaceBg,
            "border-bottom": `1px solid ${tc().surfaceBorder}`,
          }}>
            <span style={{ display: 'flex', color: props.brandColor }}>{props.provider === 'GitHub' ? <GitHubLogo size={22} /> : <GitLabLogo size={22} />}</span>
            <span style={{ "font-weight": '700', "font-size": '14px', color: tc().windowText }}>{props.provider} Repositories</span>
            <span style={{
              "margin-left": 'auto',
              "font-size": '11px',
              padding: '2px 8px',
              "border-radius": '10px',
              background: props.brandColor,
              color: '#fff',
            }}>Connected</span>
            <button
              onClick={() => setStep('login')}
              style={{
                background: 'none',
                border: `1px solid ${tc().surfaceBorder}`,
                color: tc().textMuted,
                "border-radius": '4px',
                padding: '4px 10px',
                cursor: 'pointer',
                "font-size": '11px',
              }}
            >Sign out</button>
          </div>
          <div style={{ flex: '1', overflow: 'auto', padding: '16px' }}>
            <For each={props.repos}>{(repo) => (
              <div style={{
                background: tc().surfaceBg,
                border: `1px solid ${tc().surfaceBorder}`,
                "border-radius": '8px',
                padding: '16px',
                "margin-bottom": '10px',
                cursor: 'pointer',
              }}>
                <div style={{ display: 'flex', "align-items": 'center', gap: '8px', "margin-bottom": '6px' }}>
                  <span style={{ "font-weight": '700', "font-size": '14px', color: props.brandColor }}>{repo.name}</span>
                </div>
                <div style={{ color: tc().textMuted, "font-size": '13px', "margin-bottom": '10px' }}>{repo.description}</div>
                <div style={{ display: 'flex', gap: '16px', "font-size": '12px', color: tc().textMuted }}>
                  <span style={{ display: 'flex', "align-items": 'center', gap: '4px' }}>
                    <span style={{ width: '10px', height: '10px', "border-radius": '50%', background: repo.lang_color, display: 'inline-block' }} />
                    {repo.language}
                  </span>
                  <span>★ {repo.stars}</span>
                </div>
              </div>
            )}</For>
          </div>
        </div>
      </Show>
    </>
  );
}

// --- Exported components ---

export function GitHubApp(props: AppProps) {
  return (
    <OAuthApp
      windowId={props.windowId}
      onTitleChange={props.onTitleChange}
      provider="GitHub"
      brandColor="#238636"
      brandBg="#0d1117"
      logo={<GitHubLogo size={64} />}
      repos={GITHUB_REPOS}
    />
  );
}

export function GitLabApp(props: AppProps) {
  return (
    <OAuthApp
      windowId={props.windowId}
      onTitleChange={props.onTitleChange}
      provider="GitLab"
      brandColor="#fc6d26"
      brandBg="#1a1a2e"
      logo={<GitLabLogo size={64} />}
      repos={GITLAB_REPOS}
    />
  );
}
