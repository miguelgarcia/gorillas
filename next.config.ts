import type { NextConfig } from 'next';

const githubRepository = process.env.GITHUB_REPOSITORY?.split('/');
const githubOwner = githubRepository?.[0];
const githubRepositoryName = githubRepository?.[1];
const isGitHubPagesBuild = process.env.GITHUB_PAGES === 'true';
const isUserOrOrganizationSite = githubRepositoryName?.endsWith('.github.io');
const defaultBasePath =
  isGitHubPagesBuild && githubRepositoryName && !isUserOrOrganizationSite
    ? `/${githubRepositoryName}`
    : '';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? defaultBasePath;
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (isGitHubPagesBuild && githubOwner
    ? `https://${githubOwner}.github.io${basePath}`
    : 'https://miguelgarcia.github.io/gorillas');

const nextConfig: NextConfig = {
  output: 'export',
  assetPrefix: isGitHubPagesBuild ? siteUrl : undefined,
  trailingSlash: true,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_SITE_URL: siteUrl,
  },
};

export default nextConfig;
