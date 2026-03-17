// ============================================================
// OAuth Mock Apps - GitHub and GitLab integration UIs
// ============================================================

import { useState } from 'react';
import type { AppProps } from '../core/types';
import { useTheme } from '../theme/ThemeProvider';
import './apps.css';

// --- SVG Logos ---

const GitHubLogo = ({ size = 32 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.1.39-1.99 1.02-2.69-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.58 9.58 0 0112 6.8c.85.004 1.7.115 2.5.337 1.9-1.29 2.74-1.02 2.74-1.02.55 1.37.2 2.39.1 2.64.64.7 1.02 1.6 1.02 2.69 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.16.59.67.5A10.02 10.02 0 0022 12c0-5.523-4.477-10-10-10z"/>
  </svg>
);

const GitLabLogo = ({ size = 32 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 21.35l3.74-11.5h-7.48L12 21.35z" fill="#e24329"/>
    <path d="M12 21.35L8.26 9.85H2.74L12 21.35z" fill="#fc6d26"/>
    <path d="M2.74 9.85L1.13 14.8c-.15.45 0 .94.38 1.22L12 21.35 2.74 9.85z" fill="#fca326"/>
    <path d="M2.74 9.85h5.52L5.82 3.13c-.17-.52-.9-.52-1.07 0L2.74 9.85z" fill="#e24329"/>
    <path d="M12 21.35l3.74-11.5h5.52L12 21.35z" fill="#fc6d26"/>
    <path d="M21.26 9.85l1.61 4.95c.15.45 0 .94-.38 1.22L12 21.35l9.26-11.5z" fill="#fca326"/>
    <path d="M21.26 9.85h-5.52l2.44-6.72c.17-.52.9-.52 1.07 0l2.01 6.72z" fill="#e24329"/>
  </svg>
);

// --- Mock data ---

const GITHUB_REPOS = [
  { name: 'kasm-ui', description: 'React desktop environment', stars: 342, language: 'TypeScript', lang_color: '#3178c6' },
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

function OAuthApp({
  windowId,
  provider,
  brandColor,
  brandBg,
  logo,
  repos,
}: AppProps & {
  provider: 'GitHub' | 'GitLab';
  brandColor: string;
  brandBg: string;
  logo: React.ReactNode;
  repos: typeof GITHUB_REPOS;
}) {
  const theme = useTheme();
  const tc = theme.colors;
  const [step, setStep] = useState<OAuthStep>('login');
  const [scopes, setScopes] = useState<Scope[]>([
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

  const btnStyle: React.CSSProperties = {
    padding: '10px 24px',
    fontSize: 14,
    fontWeight: 600,
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    color: '#fff',
    background: brandColor,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
  };

  if (step === 'login') {
    return (
      <div className="kasm-app" style={{ background: brandBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ marginBottom: 24, color: brandColor }}>{logo}</div>
          <h2 style={{ margin: '0 0 8px', color: tc.windowText }}>{provider}</h2>
          <p style={{ color: tc.textMuted, margin: '0 0 32px', fontSize: 14 }}>
            Connect your {provider} account to access repositories and collaborate on code.
          </p>
          <button style={btnStyle} onClick={() => setStep('consent')}>
            <span style={{ display: 'flex' }}>{provider === 'GitHub' ? <GitHubLogo size={18} /> : <GitLabLogo size={18} />}</span>
            Sign in with {provider}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'consent') {
    return (
      <div className="kasm-app" style={{ background: brandBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          background: tc.surfaceBg,
          border: `1px solid ${tc.surfaceBorder}`,
          borderRadius: 12,
          padding: 32,
          maxWidth: 440,
          width: '100%',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <span style={{ color: brandColor }}>{provider === 'GitHub' ? <GitHubLogo size={28} /> : <GitLabLogo size={28} />}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: tc.windowText }}>Authorize Kasm UI</div>
              <div style={{ color: tc.textMuted, fontSize: 12 }}>to access your {provider} account</div>
            </div>
          </div>
          <div style={{ borderTop: `1px solid ${tc.surfaceBorder}`, paddingTop: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: tc.windowText, marginBottom: 12 }}>Requested permissions:</div>
            {scopes.map(scope => (
              <label key={scope.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 0',
                cursor: 'pointer',
                fontSize: 13,
                color: tc.windowText,
              }}>
                <input
                  type="checkbox"
                  checked={scope.checked}
                  onChange={() => toggleScope(scope.id)}
                  style={{ accentColor: brandColor }}
                />
                {scope.label}
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button style={btnStyle} onClick={handleAuthorize}>Authorize</button>
            <button
              style={{ ...btnStyle, background: 'transparent', color: tc.textMuted, border: `1px solid ${tc.surfaceBorder}` }}
              onClick={() => setStep('login')}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'loading') {
    return (
      <div className="kasm-app" style={{ background: brandBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40,
            height: 40,
            border: `3px solid ${tc.surfaceBorder}`,
            borderTopColor: brandColor,
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ color: tc.textMuted, fontSize: 14 }}>Connecting to {provider}...</div>
        </div>
      </div>
    );
  }

  // step === 'repos'
  return (
    <div className="kasm-app" style={{ background: brandBg }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        background: tc.surfaceBg,
        borderBottom: `1px solid ${tc.surfaceBorder}`,
      }}>
        <span style={{ display: 'flex', color: brandColor }}>{provider === 'GitHub' ? <GitHubLogo size={22} /> : <GitLabLogo size={22} />}</span>
        <span style={{ fontWeight: 700, fontSize: 14, color: tc.windowText }}>{provider} Repositories</span>
        <span style={{
          marginLeft: 'auto',
          fontSize: 11,
          padding: '2px 8px',
          borderRadius: 10,
          background: brandColor,
          color: '#fff',
        }}>Connected</span>
        <button
          onClick={() => setStep('login')}
          style={{
            background: 'none',
            border: `1px solid ${tc.surfaceBorder}`,
            color: tc.textMuted,
            borderRadius: 4,
            padding: '4px 10px',
            cursor: 'pointer',
            fontSize: 11,
          }}
        >Sign out</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {repos.map(repo => (
          <div key={repo.name} style={{
            background: tc.surfaceBg,
            border: `1px solid ${tc.surfaceBorder}`,
            borderRadius: 8,
            padding: 16,
            marginBottom: 10,
            cursor: 'pointer',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: brandColor }}>{repo.name}</span>
            </div>
            <div style={{ color: tc.textMuted, fontSize: 13, marginBottom: 10 }}>{repo.description}</div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: tc.textMuted }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: repo.lang_color, display: 'inline-block' }} />
                {repo.language}
              </span>
              <span>★ {repo.stars}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Exported components ---

export function GitHubApp({ windowId, onTitleChange }: AppProps) {
  return (
    <OAuthApp
      windowId={windowId}
      onTitleChange={onTitleChange}
      provider="GitHub"
      brandColor="#238636"
      brandBg="#0d1117"
      logo={<GitHubLogo size={64} />}
      repos={GITHUB_REPOS}
    />
  );
}

export function GitLabApp({ windowId, onTitleChange }: AppProps) {
  return (
    <OAuthApp
      windowId={windowId}
      onTitleChange={onTitleChange}
      provider="GitLab"
      brandColor="#fc6d26"
      brandBg="#1a1a2e"
      logo={<GitLabLogo size={64} />}
      repos={GITLAB_REPOS}
    />
  );
}
