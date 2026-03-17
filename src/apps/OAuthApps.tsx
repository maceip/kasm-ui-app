// ============================================================
// OAuth Mock Apps - GitHub and GitLab integration UIs
// ============================================================

import { useState } from 'react';
import type { AppProps } from '../core/types';
import { useTheme } from '../theme/ThemeProvider';
import './apps.css';

// --- SVG Logos ---

// GitHub Invertocat (from simple-icons, official path)
const GitHubLogo = ({ size = 32 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
  </svg>
);

// GitLab tanuki (from simple-icons, official path)
const GitLabLogo = ({ size = 32 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#e24329" xmlns="http://www.w3.org/2000/svg">
    <path d="m23.6004 9.5927-.0337-.0862L20.3.9814a.851.851 0 0 0-.3362-.405.8748.8748 0 0 0-.9997.0539.8748.8748 0 0 0-.29.4399l-2.2055 6.748H7.5375l-2.2057-6.748a.8573.8573 0 0 0-.29-.4412.8748.8748 0 0 0-.9997-.0537.8585.8585 0 0 0-.3362.4049L.4332 9.5015l-.0325.0862a6.0657 6.0657 0 0 0 2.0119 7.0105l.0113.0087.03.0213 4.976 3.7264 2.462 1.8633 1.4995 1.1321a1.0085 1.0085 0 0 0 1.2197 0l1.4995-1.1321 2.4619-1.8633 5.006-3.7489.0125-.01a6.0682 6.0682 0 0 0 2.0094-7.003z"/>
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
